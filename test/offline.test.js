import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { answer, answerRule, mergeProgress, mergeRuleProgress, newId, ruleKey, summarize } from '../public/offline.js';
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

test('Abgleich: Server gewinnt, außer zum Wort wartet noch eine Antwort auf dem Gerät', () => {
  const local = [
    { word_id: 1, direction: 'ab', last_review: day(2), box: 2 }, // Antwort wartet noch
    { word_id: 2, direction: 'ab', last_review: day(3), box: 1 }, // neuer, aber schon übertragen (Uhr vorgestellt)
    { word_id: 3, direction: 'ba', last_review: day(1), box: 1 }, // wartet, Server kennt das Wort noch nicht
    { word_id: 5, direction: 'ab', last_review: day(1), box: 4 }, // auf anderem Gerät zurückgesetzt
  ];
  const server = [
    { word_id: 1, direction: 'ab', last_review: day(1), box: 1 },
    { word_id: 2, direction: 'ab', last_review: day(1), box: 3 },
    { word_id: 4, direction: 'ab', last_review: day(0), box: 1 }, // von einem anderen Gerät
  ];
  const pending = new Set(['1:ab', '3:ba']);
  const boxes = (rows) => Object.fromEntries(rows.map((p) => [`${p.word_id}:${p.direction}`, p.box]));
  assert.deepEqual(boxes(mergeProgress(local, server, pending)), { '1:ab': 2, '2:ab': 3, '3:ba': 1, '4:ab': 1 });
  // Nichts wartet: Server hat in allem recht
  assert.deepEqual(boxes(mergeProgress(local, server)), { '1:ab': 1, '2:ab': 3, '4:ab': 1 });
  // Wort aus der Liste gelöscht: Zeile fällt weg
  assert.deepEqual(boxes(mergeProgress(local, server, pending, new Set([1, 2, 3]))), { '1:ab': 2, '2:ab': 3, '3:ba': 1 });
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

test('Grammatik: Stand einer Regel auf dem Gerät wie auf dem Server', () => {
  const items = [{ grade: 'good' }, { grade: 'hard' }, { grade: 'again' }];
  const first = answerRule(undefined, { rule_id: 4, grade: 'again', items, at: t0 }, review);
  const serverFirst = review(undefined, 'again', new Date(t0));
  assert.equal(first.stability, serverFirst.stability);
  assert.deepEqual({ rule_id: first.rule_id, right: first.right, wrong: first.wrong, last_seen: first.last_seen }, { rule_id: 4, right: 2, wrong: 1, last_seen: t0 });
  assert.equal(first.due, day(1), 'nicht gewusst: morgen wieder');
  const second = answerRule(first, { rule_id: 4, grade: 'good', items: [{ grade: 'good' }, { grade: 'good' }], at: day(2) }, review);
  assert.deepEqual({ right: second.right, wrong: second.wrong, reps: second.reps, lapses: second.lapses }, { right: 4, wrong: 1, reps: 2, lapses: 0 });
  assert.ok(second.stability > first.stability);
  // ohne Aufgaben zählt die Bewertung der Runde
  assert.equal(answerRule(undefined, { rule_id: 1, grade: 'good', at: t0 }, review).right, 1);
  assert.equal(answerRule(undefined, { rule_id: 1, grade: 'again', at: t0 }, review).wrong, 1);
});

test('Grammatik: Abgleich je Regel – Server gewinnt, außer die Regel hat eine wartende Runde', () => {
  const local = [
    { rule_id: 1, last_review: day(2), box: 2 }, // Runde wartet noch
    { rule_id: 2, last_review: day(3), box: 1 }, // schon übertragen
    { rule_id: 5, last_review: day(1), box: 4 }, // auf anderem Gerät zurückgesetzt
  ];
  const server = [
    { rule_id: 1, last_review: day(1), box: 1 },
    { rule_id: 2, last_review: day(1), box: 3 },
    { rule_id: 4, last_review: day(0), box: 1 }, // von einem anderen Gerät
  ];
  const boxes = (rows) => Object.fromEntries(rows.map((p) => [p.rule_id, p.box]));
  assert.deepEqual(boxes(mergeRuleProgress(local, server, new Set([ruleKey(1)]))), { 1: 2, 2: 3, 4: 1 });
  assert.deepEqual(boxes(mergeRuleProgress(local, server)), { 1: 1, 2: 3, 4: 1 });
  assert.deepEqual(boxes(mergeRuleProgress(local, server, new Set([ruleKey(1)]), new Set([1, 2]))), { 1: 2, 2: 3 }, 'gelöschte Regel fällt weg');
  assert.notEqual(ruleKey(1), ruleKey(11));
});

test('Kennzahlen für Grammatiklisten zählen Regeln', () => {
  const progress = [
    { rule_id: 1, box: 3, due: day(10), last_seen: day(0) },
    { rule_id: 2, box: 1, due: day(1), last_seen: day(1) },
    { rule_id: 3, box: 1, due: day(0), last_seen: day(0) },
  ];
  assert.deepEqual(summarize(progress, new Date(day(1))), { seen: 3, safe: 1, due: 2, last_seen: day(1) });
});
