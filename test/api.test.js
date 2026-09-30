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
      DROP TABLE grammar_log; DROP TABLE rule_progress; DROP TABLE items; DROP TABLE rules;
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
    assert.equal(db.prepare('SELECT kind FROM lists WHERE id = 7').get().kind, 'vocab', 'bestehende Listen sind Vokabellisten');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rules').get().n, 0);
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

// ---------- Grammatik ----------

const grammarBody = {
  kind: 'grammar',
  title: 'Present perfect',
  lang_a: 'Englisch',
  grade: 8,
  groups: [{ id: 'klasse.8g', name: 'Klasse 8g' }],
  rules: [
    {
      title: 'since / for',
      summary: 'Mit since/for steht das present perfect.',
      explanation: 'Mit *since* und *for* …',
      discover: false,
      items: [
        { source: 'She *has lived* (live) here since 2010.\n! lived = Die Handlung dauert bis jetzt an.' },
        { source: 'They {have known|knew} each other since school.' },
        { source: 'Fehler: He have worked here. → He has worked here.' },
      ],
    },
    { title: 'Simple past', summary: 'Mit yesterday steht das simple past.', items: [{ source: 'I *went* (go) home yesterday.' }] },
  ],
};

async function grammarList(teacher, body = grammarBody) {
  const created = await teacher('POST', '/lists', body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body.id;
}

test('Grammatikliste anlegen, lesen und Rechte', async () => {
  const teacher = await login('Frau Grammatik', { teacher: true, groups: 'Klasse 8g' });
  const student = await login('Schüler G', { groups: 'Klasse 8g' });
  const outsider = await login('Schülerin Fremd G', { groups: 'Klasse 9z' });
  const id = await grammarList(teacher);

  assert.equal((await student('POST', '/lists', grammarBody)).status, 403, 'nur Lehrkräfte');
  const home = (await student('GET', '/lists')).body.assigned.find((l) => l.id === id);
  assert.deepEqual({ kind: home.kind, rules: home.rule_count, items: home.item_count, due: home.progress.due }, { kind: 'grammar', rules: 2, items: 4, due: 0 });
  assert.equal((await outsider('GET', '/lists')).body.assigned.length, 0);
  assert.equal((await outsider('GET', `/lists/${id}`)).status, 403);

  const detail = (await student('GET', `/lists/${id}`)).body;
  assert.equal(detail.kind, 'grammar');
  assert.equal(detail.words, undefined);
  assert.deepEqual(detail.progress, []);
  assert.deepEqual(detail.rules.map((r) => r.title), ['since / for', 'Simple past']);
  assert.equal(detail.rules[0].items.length, 3);
  assert.equal(detail.rules[0].items[0].source, 'She *has lived* (live) here since 2010.\n! lived = Die Handlung dauert bis jetzt an.');
  assert.equal(detail.rules[0].items[0].seen, null);
  assert.equal(detail.rules[0].discover, false);
  assert.equal(detail.groups, undefined, 'Gruppen nur für die Ersteller:in');
  assert.equal(detail.lang_b, '');

  const vocab = (await teacher('POST', '/lists', listBody)).body.id;
  const vocabDetail = (await teacher('GET', `/lists/${vocab}`)).body;
  assert.equal(vocabDetail.kind, 'vocab');
  assert.equal(vocabDetail.rules, undefined);
  assert.equal((await teacher('GET', '/lists')).body.own.find((l) => l.id === vocab).kind, 'vocab');
});

test('Grammatikliste: Prüfung beim Speichern mit Ort des Fehlers', async () => {
  const teacher = await login('Herr Prüfer', { teacher: true, groups: 'Klasse 8g' });
  const post = (patch) => teacher('POST', '/lists', { ...grammarBody, ...patch });
  const rule = grammarBody.rules[1];
  const cases = [
    [{ rules: [] }, /keine Regeln/],
    [{ rules: undefined }, /Regeln fehlen/],
    [{ rules: [{ ...rule, title: '' }] }, /Regel 1: Bitte einen Titel/],
    [{ rules: [{ ...rule, summary: '' }] }, /Der Merksatz fehlt/],
    [{ rules: [{ ...rule, items: [] }] }, /noch keine Aufgaben/],
    [{ rules: [rule, { ...rule, title: 'Zwei', items: [{ source: 'ok *x* y' }, { source: 'ohne Lücke' }] }] }, /Regel „Zwei“, Aufgabe 2: Keine Lücke/],
    [{ rules: [{ ...rule, items: [{ source: 'Ordnen: nur ein Teil' }] }] }, /Mindestens zwei Satzteile/],
    [{ rules: [{ ...rule, items: [{ source: 'Wir *gehen*.\n! = leer' }] }] }, /falsche Antwort/],
    [{ rules: Array.from({ length: 101 }, () => rule) }, /Höchstens 100 Regeln/],
    [{ rules: [{ ...rule, title: 'x'.repeat(201) }] }, /Titel der Regel ist zu lang/],
    [{ grade: undefined }, /Jahrgangsstufe/],
  ];
  for (const [patch, re] of cases) {
    const res = await post(patch);
    assert.equal(res.status, 400, JSON.stringify(patch).slice(0, 80));
    assert.match(res.body.error, re);
  }
  // Leerzeilen und Ränder werden bereinigt gespeichert
  const id = (await post({ rules: [{ ...rule, items: [{ source: '  Wir *gehen*. \n\n  ! gehen = x  ' }, { source: '   ' }] }] })).body.id;
  assert.equal((await teacher('GET', `/lists/${id}`)).body.rules[0].items.length, 1, 'leere Aufgaben fallen weg');
  assert.equal((await teacher('GET', `/lists/${id}`)).body.rules[0].items[0].source, 'Wir *gehen*.\n! gehen = x');

  // Die Art einer Liste bleibt
  const vocab = (await teacher('POST', '/lists', listBody)).body.id;
  assert.equal((await teacher('PUT', `/lists/${vocab}`, grammarBody)).status, 400);
  assert.match((await teacher('PUT', `/lists/${id}`, listBody)).body.error, /lässt sich nicht ändern/);
});

test('Grammatikliste bearbeiten: Regeln und Aufgaben behalten ihre ID', async () => {
  const teacher = await login('Frau Editor G', { teacher: true, groups: 'Klasse 8g' });
  const student = await login('Schüler Editor G', { groups: 'Klasse 8g' });
  const id = await grammarList(teacher);
  const before = (await teacher('GET', `/lists/${id}`)).body.rules;
  const [r1, r2] = before;
  const [a, b] = r1.items;

  // Lernstand und Verlauf anlegen
  await student('POST', `/lists/${id}/results`, { results: [{
    rule_id: r1.id, grade: 'good', items: [{ item_id: a.id, exercise: 'gap', grade: 'good' }, { item_id: b.id, exercise: 'choice', grade: 'hard' }],
  }, { rule_id: r2.id, grade: 'good', items: [{ item_id: r2.items[0].id, exercise: 'gap', grade: 'good' }] }] });

  const edited = {
    ...grammarBody,
    rules: [
      // Reihenfolge der Regeln getauscht, erste Aufgabe bearbeitet, zweite gelöscht, eine neu
      { id: r2.id, title: 'Simple past (neu benannt)', summary: r2.summary, items: [{ id: r2.items[0].id, source: r2.items[0].source }] },
      { id: r1.id, title: r1.title, summary: r1.summary, explanation: 'Neu erklärt.', discover: true, items: [
        { id: a.id, source: 'She *has lived* (live) here since 2012.' },
        { source: 'Neue *Aufgabe* hier.' },
      ] },
    ],
  };
  assert.equal((await teacher('PUT', `/lists/${id}`, edited)).status, 200);
  const after = (await student('GET', `/lists/${id}`)).body;
  assert.deepEqual(after.rules.map((r) => r.id), [r2.id, r1.id], 'Reihenfolge der Lehrkraft');
  assert.equal(after.rules[0].title, 'Simple past (neu benannt)');
  assert.equal(after.rules[1].discover, true);
  assert.equal(after.rules[1].explanation, 'Neu erklärt.');
  assert.equal(after.rules[1].items[0].id, a.id, 'bearbeitete Aufgabe behält die ID');
  assert.equal(after.rules[1].items[0].source, 'She *has lived* (live) here since 2012.');
  assert.ok(after.rules[1].items[0].seen, 'und den Zeitpunkt der letzten Bearbeitung');
  assert.equal(after.rules[1].items[1].seen, null, 'neue Aufgabe');
  assert.equal(after.progress.length, 2, 'Lernstand der Regeln bleibt');
  // gelöschte Aufgabe: der Verlauf bleibt, ohne Verknüpfung
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM items WHERE id = ?').get(b.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM grammar_log WHERE item_id IS NULL AND exercise = ?').get('choice').n >= 1, true);

  // Regel löschen: Lernstand der Regel verschwindet mit
  assert.equal((await teacher('PUT', `/lists/${id}`, { ...edited, rules: [edited.rules[1]] })).status, 200);
  const last = (await student('GET', `/lists/${id}`)).body;
  assert.equal(last.rules.length, 1);
  assert.deepEqual(last.progress.map((p) => p.rule_id), [r1.id]);

  // fremde IDs werden nicht übernommen
  const other = await grammarList(teacher, { ...grammarBody, title: 'Andere' });
  const otherRules = (await teacher('GET', `/lists/${other}`)).body.rules;
  await teacher('PUT', `/lists/${id}`, { ...edited, rules: [{ ...edited.rules[1], id: otherRules[0].id, items: [{ id: otherRules[0].items[0].id, source: 'Fremde *ID* bleibt fremd.' }] }] });
  const untouched = (await teacher('GET', `/lists/${other}`)).body.rules[0];
  assert.equal(untouched.title, 'since / for', 'Regel einer anderen Liste bleibt unverändert');
  assert.equal(untouched.items[0].source.startsWith('She *has lived*'), true);
});

test('Grammatik: Ergebnisse einer Runde – eine Bewertung pro Regel, Aufgaben einzeln im Verlauf', async () => {
  const teacher = await login('Frau Ergebnis G', { teacher: true, groups: 'Klasse 8g' });
  const student = await login('Schüler Ergebnis G', { groups: 'Klasse 8g' });
  const stranger = await login('Schülerin Ergebnis Fremd', { groups: 'Klasse 1x' });
  const id = await grammarList(teacher);
  const [r1, r2] = (await student('GET', `/lists/${id}`)).body.rules;
  const [a, b, c] = r1.items;

  const round = {
    id: 'runde-1', rule_id: r1.id, grade: 'hard', at: new Date(Date.now() - 3 * 86400000).toISOString(),
    items: [
      { item_id: a.id, exercise: 'gap', grade: 'good', attempts: 1 },
      { item_id: b.id, exercise: 'choice', grade: 'hard', attempts: 2, answer: '  knew  ' },
      { item_id: c.id, exercise: 'error', grade: 'again', attempts: 2, answer: 'He have worked here.' },
      { item_id: r2.items[0].id, exercise: 'gap', grade: 'good' }, // gehört zu einer anderen Regel
      { item_id: a.id, exercise: 'quatsch', grade: 'unbekannt' }, // ungültige Bewertung: fällt weg
    ],
  };
  const res = await student('POST', `/lists/${id}/results`, { results: [round] });
  assert.equal(res.status, 200);
  assert.equal(res.body.progress.length, 1);
  const p = res.body.progress[0];
  assert.equal(p.rule_id, r1.id);
  assert.deepEqual({ right: p.right, wrong: p.wrong, reps: p.reps }, { right: 3, wrong: 1, reps: 1 }, 'Aufgaben gezählt, eine Bewertung für die Regel');
  assert.ok(p.stability > 0 && p.due && p.box >= 1);
  assert.equal(Date.parse(p.last_seen) < Date.now() - 2 * 86400000, true, 'Zeitpunkt der Runde');

  const log = db.prepare('SELECT item_id, grade, exercise, attempts, answer, stability, client_id FROM grammar_log WHERE rule_id = ? ORDER BY id').all(r1.id);
  assert.equal(log.length, 5, '4 Aufgaben + 1 Zeile für die Regel');
  assert.deepEqual(log.slice(0, 2).map((l) => [l.item_id, l.grade, l.exercise, l.attempts, l.answer]), [
    [a.id, 'good', 'gap', 1, null],
    [b.id, 'hard', 'choice', 2, 'knew'],
  ]);
  assert.equal(log[3].item_id, null, 'Aufgabe einer anderen Regel wird nicht verknüpft');
  assert.equal(log[4].exercise, 'round');
  assert.equal(log[4].grade, 'hard');
  assert.equal(log[4].client_id, 'runde-1');
  assert.equal(log[4].stability, p.stability);
  assert.equal(log.slice(0, 4).every((l) => l.stability === null && l.client_id === null), true);

  // doppelt gesendet: nichts ändert sich
  const again = await student('POST', '/results', { results: [{ ...round, list_id: id }] });
  assert.deepEqual(again.body.progress, {});
  assert.equal((await student('GET', `/lists/${id}`)).body.progress[0].reps, 1);

  // Offline-Sammelübertragung mit Zukunftsdatum und falscher Regel
  const offline = await student('POST', '/results', { results: [
    { id: 'runde-2', list_id: id, rule_id: r2.id, grade: 'again', at: '2999-01-01T00:00:00Z', items: [{ item_id: r2.items[0].id, exercise: 'gap', grade: 'again', attempts: 2, answer: 'went' }] },
    { id: 'runde-3', list_id: id, rule_id: r2.id + 999, grade: 'good', items: [] },
    { id: 'runde-4', list_id: id, rule_id: r1.id, items: [] }, // weder Bewertung noch Aufgaben
    { id: 'runde-5', list_id: id, word_id: a.id, direction: 'ab', grade: 'good' }, // Vokabel-Eintrag für Grammatikliste
  ] });
  assert.deepEqual(Object.keys(offline.body.progress), [String(id)]);
  const p2 = offline.body.progress[id].find((x) => x.rule_id === r2.id);
  assert.ok(Date.parse(p2.last_seen) <= Date.now(), 'Zukunft wird auf jetzt gesetzt');
  assert.equal(p2.wrong, 1);
  const tomorrow = (Date.parse(p2.due) - Date.now()) / 3600000;
  assert.ok(tomorrow > 23 && tomorrow < 25, 'nicht gewusst: morgen wieder');
  assert.equal(offline.body.progress[id].length, 2);

  // Fremde Personen: Antwort verfällt
  const foreign = await stranger('POST', '/results', { results: [{ id: 'x', list_id: id, rule_id: r1.id, grade: 'good', items: [] }] });
  assert.deepEqual(foreign.body.progress, {});

  // Startseite: fällige Regeln
  const due = (await student('GET', `/lists?due_until=${encodeURIComponent(new Date(Date.now() + 3 * 86400000).toISOString())}`)).body.assigned.find((l) => l.id === id);
  assert.equal(due.progress.seen, 2);
  assert.ok(due.progress.due >= 1);

  // Noch mal dieselbe Regel: Abstand zählt, Zähler wachsen
  const second = await student('POST', `/lists/${id}/results`, { results: [{ rule_id: r1.id, grade: 'good', at: new Date().toISOString(), items: [{ item_id: a.id, exercise: 'gap', grade: 'good' }] }] });
  const p3 = second.body.progress.find((x) => x.rule_id === r1.id);
  assert.equal(p3.reps, 2);
  assert.equal(p3.right, 4);
  assert.ok(p3.stability > p.stability);

  // Aufgabenzeitpunkt für die Auswahl
  const rules = (await student('GET', `/lists/${id}`)).body.rules;
  assert.ok(rules[0].items.find((i) => i.id === a.id).seen);
  assert.equal(rules[0].items.find((i) => i.id === c.id).seen !== null, true);
});

test('Grammatik: offline geladen, kopiert, zurückgesetzt, mit dem Konto gelöscht', async () => {
  const teacher = await login('Frau Kopie G', { teacher: true, groups: 'Klasse 8g' });
  const colleague = await login('Herr Kopie G', { teacher: true, groups: 'Klasse 6z' });
  const student = await login('Schüler Kopie G', { groups: 'Klasse 8g' });
  const mate = await login('Mitschülerin Kopie G', { groups: 'Klasse 8g' });
  const id = await grammarList(teacher, { ...grammarBody, title: 'Geteilt G', shared: true });
  const rules = (await student('GET', `/lists/${id}`)).body.rules;

  const offline = (await student('GET', '/offline')).body.lists.find((l) => l.id === id);
  assert.equal(offline.kind, 'grammar');
  assert.equal(offline.rules.length, 2);
  assert.equal(offline.rules[0].items[0].source.startsWith('She *has lived*'), true);

  // Kopie: Regeln und Aufgaben, eigene IDs, unabhängig
  const shared = (await colleague('GET', '/shared')).body.find((l) => l.id === id);
  assert.deepEqual({ kind: shared.kind, rules: shared.rule_count, items: shared.item_count }, { kind: 'grammar', rules: 2, items: 4 });
  const copy = await colleague('POST', `/lists/${id}/copy`, {});
  assert.equal(copy.status, 201);
  const copied = (await colleague('GET', `/lists/${copy.body.id}`)).body;
  assert.equal(copied.kind, 'grammar');
  assert.equal(copied.rules.length, 2);
  assert.deepEqual(copied.rules.map((r) => r.items.length), [3, 1]);
  assert.equal(copied.rules[0].items[0].source, rules[0].items[0].source);
  assert.notEqual(copied.rules[0].id, rules[0].id);
  assert.equal(copied.lang_a, 'Englisch');
  assert.equal(copied.grade, 8);
  await colleague('PUT', `/lists/${copy.body.id}`, { ...grammarBody, title: 'Kopie', groups: [], rules: [grammarBody.rules[1]] });
  assert.equal((await teacher('GET', `/lists/${id}`)).body.rules.length, 2, 'Original bleibt unberührt');

  // Zurücksetzen: nur der eigene Lernstand
  for (const who of [student, mate]) {
    await who('POST', `/lists/${id}/results`, { results: [{ rule_id: rules[0].id, grade: 'good', items: [{ item_id: rules[0].items[0].id, exercise: 'gap', grade: 'good' }] }] });
  }
  assert.equal((await student('DELETE', `/lists/${id}/progress`)).status, 200);
  assert.deepEqual((await student('GET', `/lists/${id}`)).body.progress, []);
  assert.equal((await student('GET', `/lists/${id}`)).body.rules[0].items[0].seen, null, 'Verlauf ist weg');
  assert.equal((await mate('GET', `/lists/${id}`)).body.progress.length, 1, 'Mitschülerin behält ihren Stand');

  // Konto löschen (RETENTION_DAYS): Lernstand und Verlauf gehen mit
  const mateId = (await mate('GET', '/me')).body.id;
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM rule_progress WHERE user_id = ?').get(mateId).n > 0);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM grammar_log WHERE user_id = ?').get(mateId).n > 0);
  db.prepare('DELETE FROM users WHERE id = ?').run(mateId);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rule_progress WHERE user_id = ?').get(mateId).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM grammar_log WHERE user_id = ?').get(mateId).n, 0);

  // Liste löschen nimmt Regeln, Aufgaben, Lernstand und Verlauf mit
  assert.equal((await teacher('DELETE', `/lists/${id}`)).status, 200);
  for (const table of ['rules', 'rule_progress', 'grammar_log']) {
    const column = table === 'rules' ? 'id' : 'rule_id';
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IN (?, ?)`).get(rules[0].id, rules[1].id).n, 0, table);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM items WHERE rule_id IN (?, ?)').get(rules[0].id, rules[1].id).n, 0, 'items');
});

test('Grammatik-Auswertung: Gruppen, schwierige Regeln, häufige Fehler ohne Namen, Einzelansicht', async () => {
  const teacher = await login('Frau Auswertung G', { teacher: true, groups: 'Klasse 8h' });
  const other = await login('Herr Auswertung G', { teacher: true, groups: 'Klasse 8h' });
  const s1 = await login('Anna Grammatik', { groups: 'Klasse 8h' });
  const s2 = await login('Ben Grammatik', { groups: 'Klasse 8h' });
  const s3 = await login('Cem Grammatik', { groups: 'Klasse 8h' });
  const outsider = await login('Dana Fremd', { groups: 'Klasse 5q' });
  const id = await grammarList(teacher, { ...grammarBody, groups: [{ id: 'klasse.8h', name: 'Klasse 8h' }] });
  const [r1, r2] = (await s1('GET', `/lists/${id}`)).body.rules;
  const [a, b] = r1.items;
  const wrong = (item, answer) => ({ item_id: item.id, exercise: 'gap', grade: 'again', attempts: 2, answer });

  await s1('POST', `/lists/${id}/results`, { results: [
    { rule_id: r1.id, grade: 'again', items: [wrong(a, 'lived'), { item_id: b.id, exercise: 'choice', grade: 'good' }] },
    { rule_id: r2.id, grade: 'good', items: [{ item_id: r2.items[0].id, exercise: 'gap', grade: 'good' }] },
  ] });
  await s2('POST', `/lists/${id}/results`, { results: [{ rule_id: r1.id, grade: 'hard', items: [wrong(a, 'Lived'), wrong(b, 'knew')] }] });
  await s3('POST', `/lists/${id}/results`, { results: [{ rule_id: r1.id, grade: 'again', items: [wrong(a, 'has live')] }] });

  const stats = await teacher('GET', `/lists/${id}/stats`);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.rule_count, 2);
  const group = stats.body.groups[0];
  assert.equal(group.summary.students, 3);
  assert.equal(group.summary.active_7d, 3);
  assert.equal(group.summary.seen_pct, Math.round(((2 / 2 + 1 / 2 + 1 / 2) / 3) * 1000) / 10, 'Ø geübte Regeln');
  assert.equal(group.history.length, 8);
  assert.equal(group.history.at(-1).reviews, 6, 'Aufgaben der letzten Woche, nicht die Rundenzeilen');
  const anna = group.students.find((st) => st.name === 'Anna Grammatik');
  assert.deepEqual({ seen: anna.seen, right: anna.right, wrong: anna.wrong }, { seen: 2, right: 2, wrong: 1 });
  assert.equal(group.students.some((st) => st.name === 'Dana Fremd'), false);

  assert.equal(stats.body.hardest[0].title, 'since / for');
  // Häufigste Fehler: „lived“ und „Lived“ zusammengefasst, ohne Namen
  assert.deepEqual(stats.body.errors.map((e) => [e.item_id, e.answer.toLowerCase(), e.count]).sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1].localeCompare(y[1])), [
    [a.id, 'lived', 2], [a.id, 'has live', 1], [b.id, 'knew', 1],
  ].sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1].localeCompare(y[1])));
  assert.ok(stats.body.errors[0].source.startsWith('She *has lived*'));
  assert.equal(stats.body.errors[0].rule_title, 'since / for');
  assert.equal(JSON.stringify(stats.body.errors).includes('Anna'), false, 'keine Namen in der Fehlerliste');

  // Einzelansicht mit den Antworten der Person
  const detail = await teacher('GET', `/lists/${id}/stats/students/${anna.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.student.name, 'Anna Grammatik');
  assert.deepEqual(detail.body.rules.map((r) => [r.title, r.progress?.rule_id === r.id]), [['since / for', true], ['Simple past', true]]);
  assert.deepEqual(detail.body.errors.map((e) => e.answer), ['lived']);
  assert.equal(detail.body.history.length, 8);
  const ben = group.students.find((st) => st.name === 'Ben Grammatik');
  assert.deepEqual((await teacher('GET', `/lists/${id}/stats/students/${ben.id}`)).body.errors.map((e) => e.answer).sort(), ['Lived', 'knew']);
  assert.equal((await other('GET', `/lists/${id}/stats`)).status, 403, 'nur die Ersteller:in');
  assert.equal((await s1('GET', `/lists/${id}/stats`)).status, 403);
  const outsiderId = (await outsider('GET', '/me')).body.id;
  assert.equal((await teacher('GET', `/lists/${id}/stats/students/${outsiderId}`)).status, 404);

  // Häufiger Fehler → Hinweis anlegen
  const add = (body, who = teacher) => who('POST', `/lists/${id}/feedback`, body);
  const ok = await add({ item_id: a.id, answer: 'has live', text: 'Das Partizip braucht -ed.' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.source, `${a.source}\n! has live = Das Partizip braucht -ed.`);
  const again = await add({ item_id: a.id, answer: 'HAS LIVE', text: 'Anders erklärt.' });
  assert.equal(again.body.source, `${a.source}\n! HAS LIVE = Anders erklärt.`, 'gleiche Antwort ersetzt den Hinweis');
  assert.equal((await teacher('GET', `/lists/${id}`)).body.rules[0].items[0].source, again.body.source);
  assert.equal((await add({ item_id: a.id, answer: 'a|b', text: 'x' })).status, 400);
  assert.equal((await add({ item_id: a.id, answer: 'a=b', text: 'x' })).status, 400);
  assert.equal((await add({ item_id: a.id, answer: 'x', text: '' })).status, 400);
  assert.equal((await add({ item_id: 999999, answer: 'x', text: 'y' })).status, 404);
  assert.equal((await add({ item_id: a.id, answer: 'x', text: 'y' }, other)).status, 403);
  assert.equal((await add({ item_id: a.id, answer: 'x', text: 'y' }, s1)).status, 403);
  // Groß-/Kleinschreibung auch bei Akzenten und Umlauten zusammenfassen (SQLites LOWER kennt nur ASCII)
  await s1('POST', `/lists/${id}/results`, { results: [{ rule_id: r2.id, grade: 'again', items: [wrong(r2.items[0], 'Étais'), wrong(r2.items[0], 'étais'), wrong(r2.items[0], 'Ärger')] }] });
  const accented = (await teacher('GET', `/lists/${id}/stats`)).body.errors.filter((e) => e.item_id === r2.items[0].id);
  assert.deepEqual(accented.map((e) => [e.answer.toLowerCase(), e.count]).sort(), [['ärger', 1], ['étais', 2]]);

  const vocab = (await teacher('POST', '/lists', listBody)).body.id;
  assert.equal((await teacher('POST', `/lists/${vocab}/feedback`, { item_id: 1, answer: 'x', text: 'y' })).status, 400);
});

test('Migration 9: Stand 8 → 9, Vokabellisten bleiben unverändert', async () => {
  const { MIGRATIONS, openDb } = await import('../src/db.js');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  let migrated = null;
  try {
    openDb(dir).close();
    const old = new DatabaseSync(join(dir, 'vokabeltrainer.sqlite'));
    old.exec(`PRAGMA foreign_keys = OFF;
      DROP TABLE grammar_log; DROP TABLE rule_progress; DROP TABLE items; DROP TABLE rules;
      ALTER TABLE lists DROP COLUMN kind;
      INSERT INTO lists (id, title, mode, created_at, updated_at) VALUES (3, 'Alt', 'type', 't', 't');
      INSERT INTO words (list_id, pos, a, b) VALUES (3, 0, 'dog', 'Hund');
      PRAGMA user_version = 8;`);
    old.close();
    assert.equal(MIGRATIONS.length, 9);
    migrated = openDb(dir);
    assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 9);
    assert.deepEqual({ ...migrated.prepare('SELECT kind, title, mode FROM lists WHERE id = 3').get() }, { kind: 'vocab', title: 'Alt', mode: 'type' });
    assert.equal(migrated.prepare('SELECT COUNT(*) AS n FROM words WHERE list_id = 3').get().n, 1);
    assert.throws(() => migrated.prepare("UPDATE lists SET kind = 'quatsch' WHERE id = 3").run(), 'nur vocab oder grammar');
    const tables = migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
    for (const t of ['rules', 'items', 'rule_progress', 'grammar_log']) assert.ok(tables.includes(t), t);
  } finally {
    migrated?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
