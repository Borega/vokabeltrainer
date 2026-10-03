import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

// Piper nachbilden: liefert für jeden Text ein kleines „Audio“ und zählt die Aufrufe
const piperCalls = [];
let piperDown = false;
const piper = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    if (piperDown) { res.writeHead(500).end(); return; }
    const { text, voice } = JSON.parse(body);
    piperCalls.push({ text, voice, url: req.url });
    res.writeHead(200, { 'content-type': 'audio/wav' }).end(Buffer.from(`RIFF-${voice}-${text}`));
  });
});

const dataDir = mkdtempSync(join(tmpdir(), 'tts-test-'));
const config = {
  production: false,
  baseUrl: 'http://localhost',
  trustProxy: false,
  sessionDays: 1,
  rememberDays: 30,
  frameAncestors: "'self'",
  oidc: { issuer: '' },
  hiddenGroups: [],
  devLogin: true,
  dataDir,
  tts: { url: '', voices: ['de_DE-thorsten-high', 'en_GB-alba-medium'], cacheMb: 2000 },
};

let server;
let base;
let cookie;

before(async () => {
  await new Promise((resolve) => piper.listen(0, resolve));
  config.tts.url = `http://localhost:${piper.address().port}`;
  const app = createApp(openDb(':memory:'), config);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}`;
  config.baseUrl = base;
  const res = await fetch(`${base}/auth/dev-login`, { method: 'POST', body: new URLSearchParams({ name: 'Mia', groups: '' }), redirect: 'manual' });
  cookie = res.headers.get('set-cookie').split(';')[0];
});

after(() => {
  server.close();
  piper.close();
  rmSync(dataDir, { recursive: true, force: true });
});

const get = (voice, text, withCookie = true) =>
  fetch(`${base}/api/tts?${new URLSearchParams({ voice, text })}`, { headers: withCookie ? { cookie } : {} });

test('config.json nennt die eingerichteten Stimmen', async () => {
  assert.deepEqual((await (await fetch(`${base}/config.json`)).json()).tts, config.tts.voices);
});

test('Audio gibt es nur nach der Anmeldung und nur für eingerichtete Stimmen', async () => {
  assert.equal((await get('de_DE-thorsten-high', 'Haus', false)).status, 401);
  assert.equal((await get('de_DE-unbekannt-high', 'Haus')).status, 400, 'Piper würde still eine andere Stimme nehmen');
  assert.equal((await get('de_DE-thorsten-high', '')).status, 400);
  assert.equal((await get('de_DE-thorsten-high', 'x'.repeat(301))).status, 400);
  assert.equal(piperCalls.length, 0);
});

test('jedes Wort wird nur einmal erzeugt und danach aus dem Speicher geliefert', async () => {
  const first = await get('de_DE-thorsten-high', 'das Haus');
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('content-type'), 'audio/wav');
  assert.match(first.headers.get('cache-control'), /immutable/);
  assert.equal(await first.text(), 'RIFF-de_DE-thorsten-high-das Haus');
  assert.deepEqual(piperCalls.map((c) => [c.voice, c.text, c.url]), [['de_DE-thorsten-high', 'das Haus', '/synthesize']]);

  assert.equal(await (await get('de_DE-thorsten-high', 'das Haus')).text(), 'RIFF-de_DE-thorsten-high-das Haus');
  assert.equal(piperCalls.length, 1, 'zweites Abspielen kommt aus dem Speicher');

  await get('en_GB-alba-medium', 'das Haus');
  assert.equal(piperCalls.length, 2, 'andere Stimme, andere Datei');
  assert.equal(readdirSync(join(dataDir, 'tts')).filter((f) => f.endsWith('.wav')).length, 2);
});

test('gleichzeitige Anfragen für denselben Text erzeugen nur eine Datei', async () => {
  const before = piperCalls.length;
  const all = await Promise.all([1, 2, 3].map(() => get('en_GB-alba-medium', 'the house')));
  assert.deepEqual(all.map((r) => r.status), [200, 200, 200]);
  assert.equal(piperCalls.length - before, 1);
});

test('ist Piper nicht erreichbar, gibt es einen Fehler und nichts im Speicher', async () => {
  piperDown = true;
  const res = await get('de_DE-thorsten-high', 'neu');
  assert.equal(res.status, 502);
  assert.equal(res.headers.get('cache-control'), null, 'Fehler dürfen nicht zwischengespeichert werden');
  piperDown = false;
  assert.equal((await get('de_DE-thorsten-high', 'neu')).status, 200, 'danach klappt es wieder');
});
