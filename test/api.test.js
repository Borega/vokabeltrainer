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
  assert.equal(dogProgress.box, 3);
  assert.equal(res.body.progress.find((p) => p.word_id === cat.id).box, 1);
  assert.equal(res.body.progress.length, 2, 'fremde Wort-IDs werden ignoriert');

  const stats = await teacher('GET', `/lists/${id}/stats`);
  assert.equal(stats.status, 200);
  const [group] = stats.body.groups;
  assert.equal(group.students.length, 1);
  assert.equal(group.students[0].safe, 1);
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
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
});
