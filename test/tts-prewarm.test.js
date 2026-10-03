import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { openDb } from '../src/db.js';
import { prewarm, spokenTexts } from '../src/tts-prewarm.js';

const calls = [];
let down = false;
const piper = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    if (down) { res.writeHead(500).end(); return; }
    const { text, voice } = JSON.parse(body);
    calls.push(`${voice}: ${text}`);
    res.writeHead(200).end(Buffer.from('wav'));
  });
});

const dataDir = mkdtempSync(join(tmpdir(), 'prewarm-test-'));
const voices = ['en_GB-alba-medium', 'en_GB-cori-high', 'de_DE-thorsten-high', 'fr_FR-siwis-medium'];
const cfg = { dataDir, timezone: 'Europe/Berlin', tts: { url: '', voices, cacheMb: 2000, prewarmHour: 3 } };
const quiet = { log() {}, warn() {}, error() {} };
const db = openDb(':memory:');

before(async () => {
  await new Promise((resolve) => piper.listen(0, resolve));
  cfg.tts.url = `http://localhost:${piper.address().port}`;
  const list = (title, lang_a, lang_b, learn_side = '', kind = 'vocab') =>
    db.prepare("INSERT INTO lists (title, lang_a, lang_b, learn_side, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', '')")
      .run(title, lang_a, lang_b, learn_side, kind).lastInsertRowid;
  const word = (listId, pos, a, b) => db.prepare('INSERT INTO words (list_id, pos, a, b) VALUES (?, ?, ?, ?)').run(listId, pos, a, b);

  const en = list('Unit 1', 'Englisch', 'Deutsch');
  word(en, 0, '(to) go; walk', 'gehen');
  const daz = list('DaZ', 'Deutsch', 'Türkisch', 'a'); // Deutsch wird gelernt: Deutsch ja, Türkisch keine Stimme
  word(daz, 0, 'das Haus', 'ev');
  const la = list('Latein', 'Latein', 'Deutsch');
  word(la, 0, 'amicus', 'Freund');
  const gr = list('Grammatik', 'Französisch', '', '', 'grammar');
  const rule = db.prepare("INSERT INTO rules (list_id, pos, title, summary) VALUES (?, 0, 'R', 'S')").run(gr).lastInsertRowid;
  db.prepare('INSERT INTO items (rule_id, pos, source) VALUES (?, 0, ?)').run(rule, 'Je *vais* (aller) à Paris.');
});

after(() => {
  piper.close();
  rmSync(dataDir, { recursive: true, force: true });
});

const jobs = () => spokenTexts(db, voices).map((j) => `${j.voice}: ${j.text}`).sort();

test('Texte wie in der Oberfläche: gelernte Seite, alle Stimmen der Sprache, Grammatik als ganzer Satz', () => {
  assert.deepEqual(jobs(), [
    'de_DE-thorsten-high: das Haus',
    'en_GB-alba-medium: to go, walk',
    'en_GB-cori-high: to go, walk',
    'fr_FR-siwis-medium: Je vais à Paris.',
  ]);
});

test('nur fehlende Dateien werden erzeugt, beim zweiten Lauf nichts mehr', async () => {
  const first = await prewarm(db, cfg, quiet);
  assert.equal(first.total, 4);
  assert.equal(first.created, 4);
  assert.deepEqual([...calls].sort(), jobs());
  assert.equal(readdirSync(join(dataDir, 'tts')).length, 4);

  calls.length = 0;
  const second = await prewarm(db, cfg, quiet);
  assert.equal(second.created, 0);
  assert.equal(calls.length, 0);
});

test('neues Wort kommt dazu; Piper nicht erreichbar bricht den Lauf ab, der nächste holt es nach', async () => {
  db.prepare("INSERT INTO words (list_id, pos, a, b) VALUES (1, 1, 'dog', 'Hund')").run();
  down = true;
  const failed = await prewarm(db, cfg, quiet);
  assert.equal(failed.created, 0);
  assert.match(failed.stopped, /500/);
  down = false;
  calls.length = 0;
  const again = await prewarm(db, cfg, quiet);
  assert.equal(again.created, 2, 'dog in beiden englischen Stimmen');
  assert.deepEqual([...calls].sort(), ['en_GB-alba-medium: dog', 'en_GB-cori-high: dog']);
});

test('ohne Piper passiert nichts', async () => {
  assert.equal(await prewarm(db, { ...cfg, tts: { ...cfg.tts, url: '' } }, quiet), null);
});
