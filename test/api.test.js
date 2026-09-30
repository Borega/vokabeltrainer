import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

let server;
let base;
let db;

const config = {
  production: false,
  baseUrl: 'http://localhost',
  trustProxy: false,
  sessionDays: 1,
  rememberDays: 30,
  frameAncestors: "'self'",
  oidc: { issuer: '' },
  hiddenGroups: ['alle'],
  devLogin: true,
};

before(async () => {
  db = openDb(':memory:');
  const app = createApp(db, config);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
  config.baseUrl = base;
});

after(() => server.close());

async function login(name, { teacher = false, groups = '' } = {}) {
  const body = new URLSearchParams({ name, groups });
  if (teacher) body.set('teacher', 'on');
  const res = await fetch(`${base}/auth/dev-login`, { method: 'POST', body, redirect: 'manual' });
  assert.equal(res.status, 302);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return async (method, path, json) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { cookie, ...(json ? { 'content-type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
}

const listBody = {
  title: 'Unit 1',
  lang_a: 'Englisch',
  lang_b: 'Deutsch',
  mode: 'type',
  direction: 'ab',
  grade: 7,
  groups: [{ id: 'klasse.7b', name: 'Klasse 7b' }],
  words: [
    { a: 'dog', b: 'Hund' },
    { a: 'cat', b: 'Katze', note: 'animal' },
    { a: '', b: '' },
  ],
};

test('Planungs-Bibliothek für den Browser mit ihrem Lizenzhinweis', async () => {
  const res = await fetch(`${base}/vendor/ts-fsrs.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  const js = await res.text();
  assert.match(js.slice(0, 2000), /MIT License[\s\S]*Copyright/);
  const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);
  assert.equal(typeof mod.fsrs, 'function', 'bleibt ein gültiges Modul');
});

test('ohne Anmeldung kein Zugriff', async () => {
  const r = await fetch(`${base}/api/me`);
  assert.equal(r.status, 401);
});

test('kompletter Ablauf: Liste anlegen, lernen, auswerten', async () => {
  const teacher = await login('Frau Lehrer', { teacher: true, groups: 'Klasse 7b, Alle' });
  const student = await login('Schüler A', { groups: 'Klasse 7b' });
  const outsider = await login('Schüler B', { groups: 'Klasse 8a' });

  const me = await teacher('GET', '/me');
  assert.equal(me.body.isTeacher, true);
  assert.deepEqual(me.body.groups.map((g) => g.id), ['klasse.7b'], 'versteckte Gruppe "Alle" wird nicht angeboten');

  assert.equal((await student('POST', '/lists', listBody)).status, 403, 'Schüler:innen dürfen keine Listen anlegen');

  const created = await teacher('POST', '/lists', listBody);
  assert.equal(created.status, 201);
  const id = created.body.id;

  const lists = await student('GET', '/lists');
  assert.equal(lists.body.assigned.length, 1);
  assert.equal(lists.body.assigned[0].word_count, 2);
  assert.equal((await outsider('GET', '/lists')).body.assigned.length, 0);
  assert.equal((await outsider('GET', `/lists/${id}`)).status, 403);

  const list = await student('GET', `/lists/${id}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.groups, undefined, 'Gruppen nur für Ersteller:in sichtbar');
  const [dog, cat] = list.body.words;

  const res = await student('POST', `/lists/${id}/results`, {
    results: [
      { word_id: dog.id, direction: 'ab', correct: true },
      { word_id: dog.id, direction: 'ab', correct: true },
      { word_id: dog.id, direction: 'ab', correct: true },
      { word_id: cat.id, direction: 'ab', correct: false },
      { word_id: 999999, direction: 'ab', correct: true },
    ],
  });
  const dogProgress = res.body.progress.find((p) => p.word_id === dog.id);
  const catProgress = res.body.progress.find((p) => p.word_id === cat.id);
  // Dreimal am selben Tag richtig ist noch kein Langzeitlernen: Stufe 1, in ein paar Tagen wieder fällig
  assert.equal(dogProgress.box, 1);
  assert.ok(new Date(dogProgress.due) > new Date(Date.now() + 2 * 86400000));
  // Falsch: morgen wieder fällig
  assert.equal(catProgress.box, 1);
  const inHours = (new Date(catProgress.due) - Date.now()) / 3600000;
  assert.ok(inHours > 23 && inHours < 25, `fällig in ${inHours} h`);

  // Fällig-Zählung auf der Startseite
  const tomorrow = new Date(Date.now() + 1.5 * 86400000).toISOString();
  const summary = (await student('GET', `/lists?due_until=${tomorrow}`)).body.assigned[0].progress;
  assert.equal(summary.due, 1, 'nur cat ist bis übermorgen fällig');
  assert.equal((await student('GET', '/lists')).body.assigned[0].progress.due, 0, 'heute noch nichts fällig');
  assert.equal(res.body.progress.length, 2, 'fremde Wort-IDs werden ignoriert');

  const stats = await teacher('GET', `/lists/${id}/stats`);
  assert.equal(stats.status, 200);
  const [group] = stats.body.groups;
  assert.equal(group.students.length, 1);
  assert.equal(group.students[0].safe, 0);
  assert.equal(group.students[0].seen, 2);
  assert.equal(group.students[0].right, 3);
  assert.equal(group.students[0].wrong, 1);
  assert.equal(stats.body.hardest[0].a, 'cat');
  assert.equal((await student('GET', `/lists/${id}/stats`)).status, 403);

  // Bearbeiten: vorhandenes Wort behält seine ID und damit den Lernstand
  const upd = await teacher('PUT', `/lists/${id}`, {
    ...listBody,
    words: [{ id: dog.id, a: 'dog', b: 'Hund; Köter' }, { a: 'bird', b: 'Vogel' }],
  });
  assert.equal(upd.status, 200);
  const after = await student('GET', `/lists/${id}`);
  assert.equal(after.body.words.length, 2);
  assert.equal(after.body.words[0].id, dog.id);
  assert.equal(after.body.progress.length, 1, 'Lernstand des gelöschten Worts ist weg');

  assert.equal((await student('DELETE', `/lists/${id}`)).status, 403);
  assert.equal((await teacher('DELETE', `/lists/${id}`)).status, 200);
  assert.equal((await student('GET', `/lists/${id}`)).status, 404);
});

test('Validierung und CSRF-Schutz', async () => {
  const teacher = await login('Herr Test', { teacher: true, groups: 'Klasse 5a' });
  const bad = await teacher('POST', '/lists', { ...listBody, words: [{ a: 'nur links', b: '' }] });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Unvollständige Zeile/);

  const foreign = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(foreign.status, 403);
});

test('Listen für Kolleg:innen freigeben und kopieren', async () => {
  const owner = await login('Frau Teilt', { teacher: true, groups: 'Klasse 9c' });
  const colleague = await login('Herr Kopiert', { teacher: true, groups: 'Klasse 6a' });
  const student = await login('Schüler C', { groups: 'Klasse 6a' });

  const { body: { id } } = await owner('POST', '/lists', { ...listBody, title: 'Unit 9', groups: [] });

  // Nicht freigegeben: für Kolleg:innen unsichtbar
  assert.equal((await colleague('GET', '/shared')).body.some((l) => l.id === id), false);
  assert.equal((await colleague('GET', `/lists/${id}`)).status, 403);
  assert.equal((await colleague('POST', `/lists/${id}/copy`, {})).status, 403);

  // Freigeben
  await owner('PUT', `/lists/${id}`, { ...listBody, title: 'Unit 9', groups: [], shared: true });
  const shared = await colleague('GET', '/shared');
  const entry = shared.body.find((l) => l.id === id);
  assert.equal(entry.owner_name, 'Frau Teilt');
  assert.equal(entry.word_count, 2);
  assert.equal((await owner('GET', '/shared')).body.some((l) => l.id === id), false, 'eigene Listen erscheinen nicht');
  assert.equal((await student('GET', '/shared')).status, 403, 'nur für Lehrkräfte');
  assert.equal((await student('GET', `/lists/${id}`)).status, 403, 'Freigabe gilt nicht für Schüler:innen');

  const preview = await colleague('GET', `/lists/${id}`);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.can_copy, true);
  assert.equal(preview.body.is_owner, false);
  assert.equal((await colleague('PUT', `/lists/${id}`, listBody)).status, 403, 'Original bleibt geschützt');

  // Kopieren: eigene, unabhängige Liste ohne Gruppen und ohne Freigabe
  const copy = await colleague('POST', `/lists/${id}/copy`, {});
  assert.equal(copy.status, 201);
  const copied = await colleague('GET', `/lists/${copy.body.id}`);
  assert.equal(copied.body.is_owner, true);
  assert.equal(copied.body.title, 'Unit 9');
  assert.equal(copied.body.shared, false);
  assert.deepEqual(copied.body.groups, []);
  assert.equal(copied.body.copied_from, 'Unit 9 – Frau Teilt');
  assert.deepEqual(copied.body.words.map((w) => w.a), ['dog', 'cat']);

  await colleague('PUT', `/lists/${copy.body.id}`, { ...listBody, words: [{ a: 'fish', b: 'Fisch' }] });
  assert.equal((await owner('GET', `/lists/${id}`)).body.words.length, 2, 'Änderung an der Kopie lässt das Original unberührt');

  // Zurückziehen: nicht mehr sichtbar, Kopie bleibt
  await owner('PUT', `/lists/${id}`, { ...listBody, title: 'Unit 9', groups: [], shared: false });
  assert.equal((await colleague('GET', `/lists/${id}`)).status, 403);
  assert.equal((await colleague('GET', `/lists/${copy.body.id}`)).status, 200);
});

test('Migration ergänzt Spalten in bestehender Datenbank', async () => {
  const { MIGRATIONS, openDb } = await import('../src/db.js');
  const db = openDb(':memory:');
  const cols = db.prepare('PRAGMA table_info(lists)').all().map((c) => c.name);
  assert.ok(cols.includes('shared') && cols.includes('copied_from'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, MIGRATIONS.length);
  const pcols = db.prepare('PRAGMA table_info(progress)').all().map((c) => c.name);
  assert.ok(['stability', 'difficulty', 'due', 'state', 'last_review'].every((c) => pcols.includes(c)));
});

test('Migration 4 baut die Listentabelle neu auf, ohne Wörter zu verlieren', async () => {
  const { MIGRATIONS, openDb } = await import('../src/db.js');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try {
    // Datenbank im Stand von Version 3 anlegen (Schema + Migrationen 1–3), mit Fremdschlüsseln
    const fresh = openDb(dir);
    fresh.close();
    const old = new DatabaseSync(join(dir, 'vokabeltrainer.sqlite'));
    old.exec(`PRAGMA foreign_keys = OFF;
      DROP TABLE lists; DROP TABLE words; DROP TABLE review_log; DROP TABLE device_tokens;
      CREATE TABLE lists (id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title TEXT NOT NULL, lang_a TEXT NOT NULL DEFAULT '', lang_b TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'flip' CHECK (mode IN ('flip', 'type')), case_sensitive INTEGER NOT NULL DEFAULT 0,
        accent_sensitive INTEGER NOT NULL DEFAULT 1, direction TEXT NOT NULL DEFAULT 'ab', allow_switch INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE words (id INTEGER PRIMARY KEY, list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        pos INTEGER NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
      ${MIGRATIONS[0]}
      ${MIGRATIONS[2]}
      INSERT INTO lists (id, title, mode, shared, copied_from, created_at, updated_at) VALUES (7, 'Alt', 'type', 1, 'X', 't', 't');
      INSERT INTO words (list_id, pos, a, b) VALUES (7, 0, 'dog', 'Hund'), (7, 1, 'cat', 'Katze');
      PRAGMA user_version = 3;`);
    old.close();
    const db = openDb(dir);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, MIGRATIONS.length);
    assert.deepEqual({ ...db.prepare('SELECT mode, shared, copied_from FROM lists WHERE id = 7').get() }, { mode: 'type', shared: 1, copied_from: 'X' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM words WHERE list_id = 7').get().n, 2, 'Wörter bleiben erhalten');
    assert.equal(db.prepare("SELECT example FROM words LIMIT 1").get().example, '');
    db.prepare("UPDATE lists SET mode = 'auto' WHERE id = 7").run();
    assert.throws(() => db.prepare("UPDATE lists SET mode = 'quatsch' WHERE id = 7").run());
    // Fremdschlüssel wirken weiter: Liste löschen entfernt ihre Wörter
    db.prepare('DELETE FROM lists WHERE id = 7').run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM words').get().n, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Lernleiter und Auswählen, Beispielsätze, Übungsart im Verlauf', async () => {
  const teacher = await login('Frau Leiter', { teacher: true, groups: 'Klasse 6c' });
  const student = await login('Schülerin L', { groups: 'Klasse 6c' });
  const body = {
    ...listBody,
    mode: undefined,
    groups: [{ id: 'klasse.6c', name: 'Klasse 6c' }],
    words: [{ a: 'dog', b: 'Hund', example: 'The *dog* barks.' }, { a: 'cat', b: 'Katze' }],
  };
  const { body: { id } } = await teacher('POST', '/lists', body);
  let list = (await student('GET', `/lists/${id}`)).body;
  assert.equal(list.mode, 'auto', 'neue Listen nutzen standardmäßig die Lernleiter');
  assert.equal(list.words[0].example, 'The *dog* barks.');
  assert.equal(list.words[1].example, '');
  assert.equal((await teacher('PUT', `/lists/${id}`, { ...body, mode: 'choice', words: list.words })).status, 200);
  list = (await student('GET', `/lists/${id}`)).body;
  assert.equal(list.mode, 'choice');
  assert.equal(list.words[0].example, 'The *dog* barks.', 'Beispiel bleibt beim Speichern erhalten');

  const copy = await teacher('POST', `/lists/${id}/copy`, {});
  assert.equal((await teacher('GET', `/lists/${copy.body.id}`)).body.words[0].example, 'The *dog* barks.');

  await student('POST', `/lists/${id}/results`, {
    results: [
      { word_id: list.words[0].id, direction: 'ab', grade: 'hard', correct: true, exercise: 'choice' },
      { word_id: list.words[1].id, direction: 'ab', grade: 'good', correct: true, exercise: 'quatsch' },
    ],
  });
  const log = db.prepare('SELECT word_id, exercise FROM review_log WHERE word_id IN (?, ?) ORDER BY word_id')
    .all(list.words[0].id, list.words[1].id).map((r) => r.exercise);
  assert.deepEqual(log, ['choice', ''], 'unbekannte Übungsarten werden nicht gespeichert');
});

test('Offline: alle zugewiesenen Listen auf einmal, Antworten später mit Zeitpunkt und nur einmal', async () => {
  const teacher = await login('Frau Offline', { teacher: true, groups: 'Klasse 5a' });
  const student = await login('Schüler Offline', { groups: 'Klasse 5a' });
  const stranger = await login('Schülerin Fremd', { groups: 'Klasse 9z' });
  const group = [{ id: 'klasse.5a', name: 'Klasse 5a' }];
  const { body: { id: l1 } } = await teacher('POST', '/lists', { ...listBody, title: 'Offline 1', groups: group });
  const { body: { id: l2 } } = await teacher('POST', '/lists', { ...listBody, title: 'Offline 2', groups: group });

  const offline = (await student('GET', '/offline')).body;
  assert.deepEqual(offline.lists.map((l) => l.title).sort(), ['Offline 1', 'Offline 2']);
  assert.equal(offline.user.name, 'Schüler Offline');
  assert.equal(offline.lists[0].words.length, 2);
  assert.deepEqual((await stranger('GET', '/offline')).body.lists, []);

  const w1 = offline.lists.find((l) => l.id === l1).words[0];
  const w2 = offline.lists.find((l) => l.id === l2).words[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const results = [
    // absichtlich nicht chronologisch: der Server sortiert
    { id: 'b', list_id: l1, word_id: w1.id, direction: 'ab', grade: 'good', correct: true, at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'a', list_id: l1, word_id: w1.id, direction: 'ab', grade: 'good', correct: true, at: threeDaysAgo },
    { id: 'c', list_id: l2, word_id: w2.id, direction: 'ba', grade: 'again', correct: false, at: '2999-01-01T00:00:00Z' },
    { id: 'd', list_id: l2, word_id: w1.id, direction: 'ab', grade: 'good', correct: true }, // Wort gehört nicht zur Liste
  ];
  const res = await student('POST', '/results', { results });
  assert.equal(res.status, 200);
  const p1 = res.body.progress[l1].find((p) => p.word_id === w1.id);
  assert.equal(p1.right, 2);
  assert.equal(p1.reps, 2);
  assert.ok(p1.last_seen < new Date(Date.now() - 86000000).toISOString(), 'Zeitpunkt der Antwort, nicht der Übertragung');
  assert.ok(p1.stability > 3, 'Abstand zwischen den Antworten zählt: mehr als eine einzelne gute Antwort');
  const p2 = res.body.progress[l2].find((p) => p.word_id === w2.id);
  assert.ok(Date.parse(p2.last_seen) <= Date.now(), 'Zeitpunkt in der Zukunft wird auf jetzt gesetzt');
  assert.equal(res.body.progress[l2].length, 1);

  // Nochmal senden (Verbindung war abgerissen): ändert nichts
  const again = await student('POST', '/results', { results });
  assert.deepEqual(again.body.progress, {});
  assert.equal((await student('GET', `/lists/${l1}`)).body.progress[0].right, 2);

  // Fremde Listen: Antworten verfallen still
  const foreign = await stranger('POST', '/results', { results: [{ id: 'x', list_id: l1, word_id: w1.id, direction: 'ab', grade: 'good' }] });
  assert.deepEqual(foreign.body.progress, {});

  // Auswertung: aktiv laut Zeitpunkt der letzten Antwort
  const stats = (await teacher('GET', `/lists/${l1}/stats`)).body;
  assert.equal(stats.groups[0].students.find((st) => st.name === 'Schüler Offline').right, 2);
});

test('Angemeldet bleiben: Geräteschlüssel startet neue Sitzung, Abmelden löscht ihn', async () => {
  const student = await login('Schülerin Bleibt', { groups: 'Klasse 6a' });
  assert.equal((await fetch(`${base}/api/device-token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/config.json`).then((r) => r.json())).remember, true, 'Anmeldeseite bietet es an');
  const { body: { token, days } } = await student('POST', '/device-token', {});
  assert.equal(days, 30);
  assert.ok(token.length >= 40);
  assert.ok(!db.prepare('SELECT 1 FROM device_tokens WHERE hash = ?').get(token), 'nur der Hash wird gespeichert');

  const resume = (t, headers = {}) => fetch(`${base}/auth/resume`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ token: t }),
  });
  assert.equal((await resume('falsch')).status, 401);
  assert.equal((await resume(token, { origin: 'https://evil.example' })).status, 403, 'fremde Seiten dürfen nicht anmelden');
  const res = await resume(token);
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const me = await fetch(`${base}/api/me`, { headers: { cookie } }).then((r) => r.json());
  assert.equal(me.name, 'Schülerin Bleibt');

  // Abgelaufen (feste Laufzeit ab Anmeldung) → neu anmelden
  const { body: { token: old } } = await student('POST', '/device-token', {});
  db.prepare('UPDATE device_tokens SET expires = ? WHERE user_id = ?').run(Date.now() - 1, me.id);
  assert.equal((await resume(old)).status, 401);

  // Abmelden löscht den Schlüssel dieser Sitzung
  const { body: { token: fresh } } = await student('POST', '/device-token', {});
  const again = await resume(fresh);
  const cookie2 = again.headers.get('set-cookie').split(';')[0];
  await fetch(`${base}/auth/logout`, { method: 'POST', headers: { cookie: cookie2 }, redirect: 'manual' });
  assert.equal((await resume(fresh)).status, 401);
});

test('Angemeldet bleiben ausgeschaltet (REMEMBER_DAYS=0): nicht angeboten, keine Schlüssel', async () => {
  const off = createApp(openDb(':memory:'), { ...config, rememberDays: 0 });
  const srv = await new Promise((resolve) => { const s = off.listen(0, () => resolve(s)); });
  const url = `http://localhost:${srv.address().port}`;
  try {
    assert.equal((await fetch(`${url}/config.json`).then((r) => r.json())).remember, false);
    const res = await fetch(`${url}/auth/dev-login`, { method: 'POST', body: new URLSearchParams({ name: 'Ohne', groups: '' }), redirect: 'manual' });
    const cookie = res.headers.get('set-cookie').split(';')[0];
    const me = await fetch(`${url}/api/me`, { headers: { cookie } }).then((r) => r.json());
    assert.equal(me.remember, false);
    const token = await fetch(`${url}/api/device-token`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(token.status, 404);
    const resume = await fetch(`${url}/auth/resume`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'x' }) });
    assert.equal(resume.status, 401);
  } finally {
    srv.close();
  }
});

test('Abfrageart wechseln: standardmäßig erlaubt, pro Liste abschaltbar, beim Kopieren übernommen', async () => {
  const teacher = await login('Frau Wechsel', { teacher: true, groups: 'Klasse 9c' });
  const body = { ...listBody, groups: [{ id: 'klasse.9c', name: 'Klasse 9c' }] };
  const { body: { id } } = await teacher('POST', '/lists', body);
  assert.equal((await teacher('GET', `/lists/${id}`)).body.allow_mode_switch, true);
  await teacher('PUT', `/lists/${id}`, { ...body, allow_mode_switch: false });
  const list = (await teacher('GET', `/lists/${id}`)).body;
  assert.equal(list.allow_mode_switch, false);
  const copy = await teacher('POST', `/lists/${id}/copy`, {});
  assert.equal((await teacher('GET', `/lists/${copy.body.id}`)).body.allow_mode_switch, false);
  const offline = (await (await login('Schüler Wechsel', { groups: 'Klasse 9c' }))('GET', '/offline')).body;
  assert.equal(offline.lists.find((l) => l.id === id).allow_mode_switch, false, 'auch offline bekannt');
});

test('Jahrgangsstufe: Pflicht beim Speichern, in geteilten Listen und Kopien', async () => {
  const teacher = await login('Frau Jahrgang', { teacher: true, groups: 'Klasse 5a' });
  const colleague = await login('Herr Jahrgang', { teacher: true, groups: 'Klasse 6a' });
  for (const grade of [undefined, null, '', 0, 14, 6.5, 'sieben', true, [7], '0xA', '7e0', {}]) {
    const res = await teacher('POST', '/lists', { ...listBody, grade });
    assert.equal(res.status, 400, `grade ${JSON.stringify(grade)}`);
    assert.match(res.body.error, /Jahrgangsstufe/);
  }
  assert.equal((await teacher('POST', '/lists', { ...listBody, grade: '8' })).status, 201, 'Zahl als Text geht');
  const { body: { id } } = await teacher('POST', '/lists', { ...listBody, title: 'Jahrgang 5', grade: 5, shared: true });
  assert.equal((await teacher('GET', `/lists/${id}`)).body.grade, 5);
  const shared = (await colleague('GET', '/shared')).body.find((l) => l.id === id);
  assert.equal(shared.grade, 5);
  const copy = await colleague('POST', `/lists/${id}/copy`, {});
  assert.equal((await colleague('GET', `/lists/${copy.body.id}`)).body.grade, 5);
  // Alte Liste ohne Jahrgang: wird mit null geliefert, Speichern verlangt eine Angabe
  db.prepare('UPDATE lists SET grade = NULL WHERE id = ?').run(id);
  assert.equal((await teacher('GET', `/lists/${id}`)).body.grade, null);
  assert.equal((await teacher('PUT', `/lists/${id}`, { ...listBody })).status, 200);
  assert.equal((await teacher('PUT', `/lists/${id}`, { ...listBody, grade: null })).status, 400);
});

test('Noten: grade hat Vorrang, "fast" (hard) zählt als falsch, aber als erinnert', async () => {
  const teacher = await login('Frau Noten', { teacher: true, groups: 'Klasse 8b' });
  const student = await login('Schüler N', { groups: 'Klasse 8b' });
  const { body: { id } } = await teacher('POST', '/lists', { ...listBody, groups: [{ id: 'klasse.8b', name: 'Klasse 8b' }] });
  const [w1, w2] = (await student('GET', `/lists/${id}`)).body.words;
  const res = await student('POST', `/lists/${id}/results`, {
    results: [
      { word_id: w1.id, direction: 'ab', grade: 'hard', correct: false },
      { word_id: w2.id, direction: 'ba', grade: 'easy', correct: true },
    ],
  });
  const p1 = res.body.progress.find((p) => p.word_id === w1.id);
  const p2 = res.body.progress.find((p) => p.word_id === w2.id);
  assert.equal(p1.wrong, 1);
  assert.ok(p1.stability > 1 && p1.stability < p2.stability, 'hard < easy');
  assert.equal(p2.direction, 'ba');
  assert.ok(new Date(p2.due) > new Date(Date.now() + 5 * 86400000), 'leicht: erst in über 5 Tagen wieder');
});

test('Auswertung: Gruppenübersicht, Fälligkeit, Verlauf und Einzelansicht', async () => {
  const teacher = await login('Frau Statistik', { teacher: true, groups: 'Klasse 10a' });
  const other = await login('Herr Fremd', { teacher: true, groups: 'Klasse 10a' });
  const s1 = await login('Anna Zehn', { groups: 'Klasse 10a' });
  const s2 = await login('Ben Zehn', { groups: 'Klasse 10a' });
  const outsider = await login('Cem Elf', { groups: 'Klasse 11b' });
  const { body: { id } } = await teacher('POST', '/lists', { ...listBody, groups: [{ id: 'klasse.10a', name: 'Klasse 10a' }] });
  const [w1, w2] = (await s1('GET', `/lists/${id}`)).body.words;

  await s1('POST', `/lists/${id}/results`, { results: [
    { word_id: w1.id, direction: 'ab', grade: 'good', correct: true },
    { word_id: w2.id, direction: 'ab', grade: 'again', correct: false },
  ] });

  const stats = (await teacher('GET', `/lists/${id}/stats`)).body;
  const group = stats.groups[0];
  assert.deepEqual(
    { students: group.summary.students, active: group.summary.active_7d, seen: group.summary.seen_pct, due: group.summary.due },
    { students: 2, active: 1, seen: 50, due: 0 },
    'Anna hat 2 von 2 Wörtern geübt, Ben keins → Ø 50 %; heute noch nichts fällig',
  );
  assert.equal(group.history.length, 8);
  assert.equal(group.history.at(-1).reviews, 2, 'zwei Abfragen in der letzten Woche');
  assert.equal(group.history[0].reviews, 0);
  const anna = group.students.find((st) => st.name === 'Anna Zehn');
  const ben = group.students.find((st) => st.name === 'Ben Zehn');

  // Einzelansicht
  const detail = await teacher('GET', `/lists/${id}/stats/students/${anna.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.student.name, 'Anna Zehn');
  const d1 = detail.body.words.find((w) => w.id === w1.id);
  assert.equal(d1.ab.right, 1);
  assert.equal(d1.ba, null);
  assert.equal(detail.body.words.find((w) => w.id === w2.id).ab.wrong, 1);

  // Zugriffsschutz
  assert.equal((await other('GET', `/lists/${id}/stats/students/${anna.id}`)).status, 403, 'nur die Ersteller:in');
  assert.equal((await s1('GET', `/lists/${id}/stats/students/${anna.id}`)).status, 403, 'nicht für Schüler:innen');
  const outsiderId = (await outsider('GET', '/me')).body.id;
  assert.equal((await teacher('GET', `/lists/${id}/stats/students/${outsiderId}`)).status, 404, 'nur Mitglieder der Listengruppen');
  assert.equal((await teacher('GET', `/lists/${id}/stats/students/${ben.id}`)).body.words.every((w) => !w.ab && !w.ba), true);

  // Zurücksetzen löscht auch den Verlauf
  await s1('DELETE', `/lists/${id}/progress`);
  const after = (await teacher('GET', `/lists/${id}/stats`)).body.groups[0];
  assert.equal(after.history.at(-1).reviews, 0);
  assert.equal(after.summary.seen_pct, 0);
});
