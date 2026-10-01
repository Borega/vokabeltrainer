import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BADGES, collection, newlyEarned, titleOf } from '../src/badges.js';

const none = { safeWords: 0, bothWays: 0, safeRules: 0, listsMastered: 0, days: 0, longRecall: false, errorFixed: false };

test('Kennungen sind eindeutig und jedes Abzeichen hat Titel und Text', () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  for (const b of BADGES) assert.ok(b.title && b.text && typeof b.test === 'function', b.id);
});

test('ohne Können keine Abzeichen', () => {
  assert.deepEqual(newlyEarned(none, new Set()), []);
});

test('Schwellen: 10, 50 und 150 sichere Wörter', () => {
  assert.deepEqual(newlyEarned({ ...none, safeWords: 9 }, new Set()), []);
  assert.deepEqual(newlyEarned({ ...none, safeWords: 10 }, new Set()), ['woerter-10']);
  assert.deepEqual(newlyEarned({ ...none, safeWords: 60 }, new Set()), ['woerter-10', 'woerter-50']);
  assert.deepEqual(newlyEarned({ ...none, safeWords: 150 }, new Set(['woerter-10'])), ['woerter-50', 'woerter-150'], 'Vorhandene kommen nicht noch einmal');
});

test('Lerntage, Regeln, Liste und die versteckten Abzeichen', () => {
  assert.deepEqual(newlyEarned({ ...none, days: 7 }, new Set()), ['lerntage-7']);
  assert.deepEqual(newlyEarned({ ...none, days: 100 }, new Set()), ['lerntage-7', 'lerntage-30', 'lerntage-100']);
  assert.deepEqual(newlyEarned({ ...none, safeRules: 5 }, new Set()), ['regel-1', 'regeln-5']);
  assert.deepEqual(newlyEarned({ ...none, listsMastered: 1 }, new Set()), ['liste']);
  assert.deepEqual(newlyEarned({ ...none, longRecall: true }, new Set()), ['langzeit']);
  assert.deepEqual(newlyEarned({ ...none, errorFixed: true }, new Set()), ['fehler']);
  assert.deepEqual(newlyEarned({ ...none, bothWays: 10 }, new Set()), ['beide']);
});

test('Sammlung: Fortschritt bei offenen Abzeichen, versteckte verraten nichts', () => {
  const c = collection({ ...none, safeWords: 6, days: 2 }, new Map([['lerntage-7', '2026-10-01T10:00:00.000Z'], ['fehler', '2026-10-01T10:00:00.000Z']]));
  const byId = Object.fromEntries(c.map((b) => [b.id, b]));
  assert.deepEqual(byId['woerter-10'].progress, { value: 6, max: 10 });
  assert.equal(byId['woerter-10'].earned_at, null);
  // erreicht: kein Fortschritt mehr, mit Zeitpunkt
  assert.equal(byId['lerntage-7'].progress, null);
  assert.equal(byId['lerntage-7'].earned_at, '2026-10-01T10:00:00.000Z');
  // versteckt und nicht erreicht: weder Titel noch Text noch Fortschritt
  assert.deepEqual(byId.langzeit, { id: 'langzeit', hidden: true, earned_at: null, title: 'Verstecktes Abzeichen', text: 'Wird verraten, sobald du es hast.', progress: null });
  assert.equal(byId.beide.title, 'Verstecktes Abzeichen');
  // versteckt und erreicht: wird gezeigt
  assert.equal(byId.fehler.title, 'Fehler besiegt');
  assert.equal(byId.fehler.hidden, true);
  assert.equal(c.length, BADGES.length);
});

test('Titel zu einer Kennung', () => {
  assert.equal(titleOf('liste'), 'Liste gemeistert');
});
