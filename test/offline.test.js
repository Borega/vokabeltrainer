import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { answer, mergeProgress, newId, summarize } from '../public/offline.js';
import { review } from '../src/scheduler.js';

const t0 = '2026-09-28T10:00:00.000Z';
const day = (n) => new Date(Date.parse(t0) + n * 86400000).toISOString();

test('Antwort auf dem Gerät ergibt denselben Stand wie auf dem Server', () => {
  const first = answer(undefined, { word_id: 1, direction: 'ab', grade: 'good', correct: true, at: t0 }, review);
  const serverFirst = review(undefined, 'good', new Date(t0));
  assert.equal(first.stability, serverFirst.stability);
  assert.equal(first.right, 1);
  assert.equal(first.last_seen, t0);
  const second = answer(first, { word_id: 1, direction: 'ab', grade: 'again', correct: false, at: day(3) }, review);
  assert.equal(second.right, 1);
  assert.equal(second.wrong, 1);
  assert.equal(second.lapses, 1);
  assert.equal(second.due, day(4), 'nicht gewusst: morgen wieder');
});

test('Abgleich: Server gewinnt, außer das Gerät hat eine neuere Antwort', () => {
  const local = [
    { word_id: 1, direction: 'ab', last_review: day(2), box: 2 }, // neuer als der Server
    { word_id: 2, direction: 'ab', last_review: day(1), box: 1 },
    { word_id: 3, direction: 'ba', last_review: day(1), box: 1 }, // nur auf dem Gerät
  ];
  const server = [
    { word_id: 1, direction: 'ab', last_review: day(1), box: 1 },
    { word_id: 2, direction: 'ab', last_review: day(1), box: 3 }, // gleich alt: Server
    { word_id: 4, direction: 'ab', last_review: day(0), box: 1 }, // von einem anderen Gerät
  ];
  const merged = new Map(mergeProgress(local, server).map((p) => [`${p.word_id}:${p.direction}`, p.box]));
  assert.deepEqual(Object.fromEntries(merged), { '1:ab': 2, '2:ab': 3, '3:ba': 1, '4:ab': 1 });
});

test('Kennzahlen wie auf dem Server: geübt, sicher, fällig', () => {
  const progress = [
    { word_id: 1, direction: 'ab', box: 3, due: day(10), last_seen: day(0) },
    { word_id: 1, direction: 'ba', box: 1, due: day(1), last_seen: day(1) },
    { word_id: 2, direction: 'ab', box: 0, due: day(0), last_seen: day(0) },
  ];
  assert.deepEqual(summarize(progress, new Date(day(1))), { seen: 2, safe: 1, due: 2, last_seen: day(1) });
  assert.deepEqual(summarize([], new Date()), { seen: 0, safe: 0, due: 0, last_seen: null });
});

test('IDs für Antworten sind eindeutig', () => {
  const ids = new Set(Array.from({ length: 1000 }, newId));
  assert.equal(ids.size, 1000);
});

test('Service Worker hält alle Dateien vor, die die App zum Starten braucht', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const routes = ['/', '/config.json', '/vendor/ts-fsrs.js']; // liefert der Server
  for (const path of shell) {
    if (!routes.includes(path)) assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} fehlt`);
  }
  // alle Module der App, die app.js lädt, sind dabei
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  for (const [, file] of app.matchAll(/from '\.\/([\w/.-]+)'/g)) assert.ok(shell.includes(`/${file}`), `/${file} fehlt im Service Worker`);
});
