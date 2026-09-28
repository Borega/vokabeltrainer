import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

let server;
let base;

const config = {
  production: false,
  baseUrl: 'http://localhost',
  trustProxy: false,
  sessionDays: 1,
  frameAncestors: "'self'",
  oidc: { issuer: '' },
  hiddenGroups: ['alle'],
  devLogin: true,
};

before(async () => {
  const app = createApp(openDb(':memory:'), config);
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
  groups: [{ id: 'klasse.7b', name: 'Klasse 7b' }],
  words: [
    { a: 'dog', b: 'Hund' },
    { a: 'cat', b: 'Katze', note: 'animal' },
    { a: '', b: '' },
  ],
};

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
  const { openDb } = await import('../src/db.js');
  const db = openDb(':memory:');
  const cols = db.prepare('PRAGMA table_info(lists)').all().map((c) => c.name);
  assert.ok(cols.includes('shared') && cols.includes('copied_from'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  const pcols = db.prepare('PRAGMA table_info(progress)').all().map((c) => c.name);
  assert.ok(['stability', 'difficulty', 'due', 'state', 'last_review'].every((c) => pcols.includes(c)));
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
