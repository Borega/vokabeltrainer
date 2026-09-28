import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { levelFor, review } from '../src/scheduler.js';

const DAY = 86400000;
const t0 = new Date('2026-09-28T10:00:00Z');
const days = (row, from) => (new Date(row.due) - from) / DAY;

test('richtig beantwortete Wörter kommen in wachsenden Abständen wieder', () => {
  let row = review(undefined, 'good', t0);
  const intervals = [days(row, t0)];
  for (let i = 0; i < 3; i++) {
    const at = new Date(row.due);
    row = review(row, 'good', at);
    intervals.push(days(row, at));
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1], intervals.join(' < '));
  assert.ok(intervals.at(-1) > 30, `nach 4× richtig mehr als ein Monat Pause (${intervals.at(-1)})`);
});

test('nicht gewusst: am nächsten Tag wieder fällig, Stabilität sinkt', () => {
  let row = review(undefined, 'good', t0);
  row = review(row, 'good', new Date(row.due));
  const at = new Date(row.due);
  const before = row.stability;
  row = review(row, 'again', at);
  assert.equal(days(row, at), 1);
  assert.ok(row.stability < before);
  assert.equal(row.lapses, 1);
});

test('Pauken am selben Tag erhöht die Stabilität nicht', () => {
  const first = review(undefined, 'good', t0);
  const again = review(first, 'good', new Date(t0.getTime() + 60000));
  assert.ok(Math.abs(again.stability - first.stability) < 0.01);
});

test('Stufen: ab 14 Tagen Stabilität „sicher“ (3)', () => {
  assert.deepEqual([0, 0.5, 3, 13.9, 14, 45, 120].map(levelFor), [0, 1, 2, 2, 3, 4, 5]);
});

test('Migration rechnet alte Leitner-Kästchen in Startwerte um', async () => {
  const { MIGRATIONS } = await import('../src/db.js');
  // Datenbank im Zustand von Version 1 nachbauen
  const old = new DatabaseSync(':memory:');
  old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1);
    CREATE TABLE words (id INTEGER PRIMARY KEY); INSERT INTO words VALUES (1), (2);
    CREATE TABLE progress (user_id INTEGER, word_id INTEGER, direction TEXT, box INTEGER, right INTEGER,
    wrong INTEGER, last_seen TEXT, PRIMARY KEY (user_id, word_id, direction));
    INSERT INTO progress VALUES (1, 1, 'ab', 3, 3, 0, '2026-09-28T10:00:00.000Z'), (1, 2, 'ab', 1, 0, 1, '2026-09-28T10:00:00.000Z');`);
  old.exec(MIGRATIONS[1]);
  const rows = old.prepare('SELECT word_id, stability, due, state, reps FROM progress ORDER BY word_id').all();
  assert.equal(levelFor(rows[0].stability), 3, 'Kästchen 3 bleibt „sicher“');
  assert.equal(rows[0].due, '2026-10-12T10:00:00.000Z');
  assert.equal(rows[1].due, '2026-09-29T10:00:00.000Z');
  assert.equal(rows[0].state, 2);
  assert.equal(rows[0].reps, 3);
  // Migration 3 übernimmt den Stand als ersten Verlaufseintrag
  old.exec(MIGRATIONS[2]);
  const log = old.prepare('SELECT word_id, grade, stability, at FROM review_log ORDER BY word_id').all();
  assert.equal(log.length, 2);
  assert.equal(log[0].grade, 'import');
  assert.equal(log[0].stability, 14);
  assert.equal(log[0].at, '2026-09-28T10:00:00.000Z');
  // und FSRS kann mit den umgerechneten Werten weiterrechnen
  const next = review({ ...rows[0], difficulty: 5, scheduled_days: 14, lapses: 0, last_review: '2026-09-28T10:00:00.000Z' }, 'good', new Date(rows[0].due));
  assert.ok(next.stability > rows[0].stability);
});
