import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { TEMPLATE_DIR, loadTemplates, syncTemplates } from '../src/templates.js';

const templateLists = (db) => db.prepare('SELECT * FROM lists WHERE template IS NOT NULL ORDER BY template').all();

test('alle mitgelieferten Vorlagen sind gültig', () => {
  const { templates, errors } = loadTemplates();
  assert.deepEqual(errors, []);
  assert.ok(templates.length >= 28);
  assert.ok(templates.some((t) => t.lang === 'Deutsch') && templates.some((t) => t.lang === 'Englisch'));
});

test('Vorlagen anlegen, unverändert lassen, aktualisieren (IDs bleiben), entfernen', () => {
  const db = openDb(':memory:');
  const dir = mkdtempSync(join(tmpdir(), 'vt-vorlagen-'));
  try {
    cpSync(TEMPLATE_DIR, dir, { recursive: true });
    const first = syncTemplates(db, { dir });
    assert.equal(first.added, loadTemplates(dir).templates.length);
    const rows = templateLists(db);
    assert.ok(rows.every((r) => r.owner_id === null && r.shared === 1 && r.kind === 'grammar' && r.grade));
    assert.equal(rows.find((r) => r.lang_a === 'Deutsch').case_sensitive, 1, 'Deutsch: Großschreibung zählt');
    assert.equal(rows.find((r) => r.lang_a === 'Englisch').case_sensitive, 0);

    assert.deepEqual(syncTemplates(db, { dir }), { added: 0, updated: 0, removed: 0, errors: [] }, 'zweiter Start ändert nichts');

    // Eine Aufgabe ändern: dieselbe Regel, die übrigen Aufgaben behalten ihre ID
    const key = 'deutsch/02-dativ.txt';
    const list = templateLists(db).find((r) => r.template === key);
    const itemsBefore = db.prepare('SELECT i.id, i.source FROM items i JOIN rules r ON r.id = i.rule_id WHERE r.list_id = ? ORDER BY i.pos').all(list.id);
    const ruleBefore = db.prepare('SELECT id FROM rules WHERE list_id = ?').get(list.id).id;
    const file = join(dir, key);
    writeFileSync(file, readFileSync(file, 'utf8').replace('Ich helfe *dem* (der) Mann.', 'Ich helfe *dem* (der) alten Mann.'));
    assert.equal(syncTemplates(db, { dir }).updated, 1);
    const itemsAfter = db.prepare('SELECT i.id, i.source FROM items i JOIN rules r ON r.id = i.rule_id WHERE r.list_id = ? ORDER BY i.pos').all(list.id);
    assert.equal(db.prepare('SELECT id FROM rules WHERE list_id = ?').get(list.id).id, ruleBefore);
    assert.deepEqual(itemsAfter.map((i) => i.id), itemsBefore.map((i) => i.id), 'bearbeitete Aufgabe behält ihre ID');
    assert.match(itemsAfter[0].source, /alten Mann/);

    // Fehlerhafte Datei: übersprungen, bisherige Fassung bleibt
    writeFileSync(file, 'Kaputt\n## Dativ\nMerksatz: x\nAufgaben:\nIch helfe *dem Mann.');
    const broken = syncTemplates(db, { dir });
    assert.equal(broken.errors.length, 1);
    assert.equal(broken.removed, 0);
    assert.ok(templateLists(db).some((r) => r.template === key));

    // Aus vorlagen.json entfernt: Vorlage verschwindet, andere Listen ohne Besitzer:in bleiben
    db.prepare("INSERT INTO lists (owner_id, title, created_at, updated_at, shared) VALUES (NULL, 'Verwaist', 't', 't', 1)").run();
    const manifest = JSON.parse(readFileSync(join(dir, 'vorlagen.json'), 'utf8')).filter((e) => e.file !== key);
    writeFileSync(join(dir, 'vorlagen.json'), JSON.stringify(manifest));
    assert.equal(syncTemplates(db, { dir }).removed, 1);
    assert.ok(!templateLists(db).some((r) => r.template === key));

    assert.equal(syncTemplates(db, { dir, enabled: false }).removed, manifest.length, 'TEMPLATES=false entfernt alle');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM lists WHERE title = 'Verwaist'").get().n, 1);
    assert.equal(syncTemplates(db, { dir: join(dir, 'gibt-es-nicht') }), null, 'ohne Vorlagen bleibt alles');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

let server;
let base;
const db = openDb(':memory:');
before(async () => {
  syncTemplates(db);
  const app = createApp(db, {
    production: false, baseUrl: 'http://localhost', trustProxy: false, sessionDays: 1, rememberDays: 30,
    frameAncestors: "'self'", oidc: { issuer: '' }, hiddenGroups: [], devLogin: true,
  });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function login(name, { teacher = false, groups = '' } = {}) {
  const body = new URLSearchParams({ name, groups });
  if (teacher) body.set('teacher', 'on');
  const res = await fetch(`${base}/auth/dev-login`, { method: 'POST', body, redirect: 'manual' });
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return async (method, path, json) => {
    const r = await fetch(`${base}/api${path}`, {
      method, headers: { cookie, ...(json ? { 'content-type': 'application/json' } : {}) }, body: json ? JSON.stringify(json) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
}

test('Vorlagen für Lehrkräfte: geteilt, ansehen, kopieren – aber nicht ändern; Schüler:innen sehen sie nicht', async () => {
  const teacher = await login('Frau Vorlage', { teacher: true, groups: 'Klasse 6a' });
  const shared = (await teacher('GET', '/shared')).body;
  const dativ = shared.find((l) => l.title === 'Dativ');
  assert.ok(dativ.template);
  assert.equal(dativ.lang_a, 'Deutsch');
  assert.ok(dativ.item_count > 10);
  assert.equal((await teacher('GET', `/lists/${dativ.id}`)).status, 200);
  assert.equal((await teacher('PUT', `/lists/${dativ.id}`, { kind: 'grammar', title: 'x', grade: 5, rules: [] })).status, 403);
  assert.equal((await teacher('DELETE', `/lists/${dativ.id}`)).status, 403);
  const copy = await teacher('POST', `/lists/${dativ.id}/copy`, {});
  const mine = (await teacher('GET', `/lists/${copy.body.id}`)).body;
  assert.equal(mine.is_owner, true);
  assert.equal(mine.template, false);
  assert.equal(mine.copied_from, 'Vorlage: Dativ');
  assert.equal(mine.rules.length, 1);

  const student = await login('Schüler Vorlage', { groups: 'Klasse 6a' });
  assert.equal((await student('GET', `/lists/${dativ.id}`)).status, 403);
  assert.equal((await student('GET', '/shared')).status, 403);
});
