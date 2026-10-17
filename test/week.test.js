import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeCountsAt, weekReview } from '../src/week.js';

const TZ = 'Europe/Berlin';
const SAFE = 30; // Stabilität in Tagen: sicher
const SHAKY = 2;
const at = (iso, unit, stability, part = 'ab') => ({ unit, part, stability, at: iso });

test('sicher zählt nach der letzten Antwort; eine Richtung genügt', () => {
  const rows = [
    at('2026-10-01T10:00:00Z', 1, SAFE),
    at('2026-10-02T10:00:00Z', 2, SAFE, 'ba'),
    at('2026-10-02T11:00:00Z', 2, SHAKY, 'ab'),
    at('2026-10-03T10:00:00Z', 1, SHAKY), // vergessen
  ];
  const t = (iso) => Date.parse(iso);
  assert.deepEqual(safeCountsAt(rows, [t('2026-09-30T00:00:00Z'), t('2026-10-02T12:00:00Z'), t('2026-10-04T00:00:00Z')]), [0, 2, 1]);
});

test('Wochenrückblick: Lerntage und Zunahme sicherer Wörter, diese gegen letzte Woche', () => {
  // Mittwoch, 14.10.2026: diese Woche ab Mo 12.10., letzte ab Mo 5.10.
  const words = [
    at('2026-10-06T10:00:00Z', 1, SAFE),
    at('2026-10-07T10:00:00Z', 2, SAFE),
    at('2026-10-12T10:00:00Z', 3, SAFE),
    at('2026-10-13T10:00:00Z', 4, SAFE),
    at('2026-10-13T11:00:00Z', 5, SAFE),
  ];
  const rules = [at('2026-10-13T10:00:00Z', 9, SAFE, '')];
  const days = ['2026-10-05', '2026-10-06', '2026-10-12', '2026-10-13', '2026-10-14'];
  const review = weekReview({ days, words, rules }, '2026-10-14', Date.parse('2026-10-14T12:00:00Z'), TZ);
  assert.deepEqual(review, { days: 3, safeWords: 3, safeRules: 1, last: { days: 2, safeWords: 2, safeRules: 0 } });
});

test('Wochenrückblick: Vergessenes ergibt keinen negativen Wert', () => {
  const words = [at('2026-10-06T10:00:00Z', 1, SAFE), at('2026-10-13T10:00:00Z', 1, SHAKY)];
  const review = weekReview({ days: [], words, rules: [] }, '2026-10-14', Date.parse('2026-10-14T12:00:00Z'), TZ);
  assert.equal(review.safeWords, 0);
  assert.equal(review.last.safeWords, 1);
});
