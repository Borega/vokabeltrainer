import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, computeStreak, endOfDay, localDay, startOfDay, weekOf } from '../src/streak.js';

const TZ = 'Europe/Berlin';
const done = (day, next_due = null) => ({ day, done: true, had_due: true, next_due });
const partial = (day, next_due) => ({ day, done: false, had_due: true, next_due });
const free = (day, next_due = null) => ({ day, done: false, had_due: false, next_due });

test('Kalendertag in der Schulzeitzone, auch kurz vor und nach Mitternacht', () => {
  assert.equal(localDay(Date.parse('2026-10-01T21:59:59Z'), TZ), '2026-10-01'); // 23:59:59 MESZ
  assert.equal(localDay(Date.parse('2026-10-01T22:00:00Z'), TZ), '2026-10-02'); // 00:00:00 MESZ
  assert.equal(localDay(Date.parse('2026-01-15T23:30:00Z'), TZ), '2026-01-16'); // 00:30 MEZ
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('Tagesbeginn und -ende, auch an Tagen mit Zeitumstellung', () => {
  assert.equal(new Date(startOfDay('2026-10-01', TZ)).toISOString(), '2026-09-30T22:00:00.000Z');
  assert.equal(new Date(endOfDay('2026-10-01', TZ)).toISOString(), '2026-10-01T21:59:59.999Z');
  // 25.10.2026: Ende der Sommerzeit, der Tag hat 25 Stunden
  assert.equal((endOfDay('2026-10-25', TZ) + 1 - startOfDay('2026-10-25', TZ)) / 3600000, 25);
  // 29.03.2026: Beginn der Sommerzeit, der Tag hat 23 Stunden
  assert.equal((endOfDay('2026-03-29', TZ) + 1 - startOfDay('2026-03-29', TZ)) / 3600000, 23);
  assert.equal(localDay(startOfDay('2026-03-29', TZ), TZ), '2026-03-29');
  assert.equal(localDay(endOfDay('2026-03-29', TZ), TZ), '2026-03-29');
  assert.equal(new Date(startOfDay('2026-01-15', 'UTC')).toISOString(), '2026-01-15T00:00:00.000Z');
});

test('ohne Lerntage: keine Serie', () => {
  assert.deepEqual(computeStreak([], '2026-10-01', TZ), { current: 0, best: 0, total: 0 });
});

test('aufeinanderfolgende Tage zählen; heute ohne Antwort bricht die Serie nicht', () => {
  const rows = [done('2026-09-29', '2026-09-30T08:00:00Z'), done('2026-09-30', '2026-10-01T08:00:00Z')];
  assert.deepEqual(computeStreak(rows, '2026-09-30', TZ), { current: 2, best: 2, total: 2 });
  assert.deepEqual(computeStreak(rows, '2026-10-01', TZ), { current: 2, best: 2, total: 2 });
});

test('Tage ohne Fälliges sind frei: sie zählen nicht, brechen aber nicht', () => {
  // Montag alles erledigt, das nächste ist erst am Donnerstag fällig
  const rows = [done('2026-09-28', '2026-10-01T06:00:00Z'), done('2026-10-01')];
  assert.deepEqual(computeStreak(rows, '2026-10-01', TZ), { current: 2, best: 2, total: 2 });
});

test('war etwas fällig und nichts getan, ist der Tag verpasst: ein Tag wird überbrückt, zwei in der Woche brechen', () => {
  // Fällig ab 1.10., dort nichts getan, am 2.10. wieder gelernt: der 1.10. wird überbrückt
  const one = [done('2026-09-29', '2026-10-01T06:00:00Z'), done('2026-10-02')];
  assert.deepEqual(computeStreak(one, '2026-10-02', TZ), { current: 2, best: 2, total: 2 });
  const two = [done('2026-09-29', '2026-09-30T06:00:00Z'), done('2026-10-03')];
  // Fällig ab 30.9.: 30.9. überbrückt, 1.10. innerhalb von 7 Tagen: Bruch
  assert.deepEqual(computeStreak(two, '2026-10-03', TZ), { current: 1, best: 1, total: 2 });
});

test('Überbrückung wieder frei, wenn sie 7 Tage zurückliegt', () => {
  // Alles täglich fällig. Verpasst: 3.10. (überbrückt) und 10.10. (7 Tage später, wieder überbrückt)
  const rows = [];
  for (let day = '2026-10-01'; day <= '2026-10-12'; day = addDays(day, 1)) {
    if (day !== '2026-10-03' && day !== '2026-10-10') rows.push(done(day, `${addDays(day, 1)}T06:00:00Z`));
  }
  assert.deepEqual(computeStreak(rows, '2026-10-12', TZ), { current: 10, best: 10, total: 10 });
});

test('angefangen, aber nicht geschafft, zählt als verpasst; heute noch nicht', () => {
  const rows = [done('2026-10-01', '2026-10-02T06:00:00Z'), partial('2026-10-02', '2026-10-02T09:00:00Z'), partial('2026-10-03', '2026-10-03T09:00:00Z')];
  // 2.10. überbrückt, 3.10. ist heute und noch offen
  assert.deepEqual(computeStreak(rows, '2026-10-03', TZ), { current: 1, best: 1, total: 1 });
  // am 4.10. ist der 3.10. der zweite verpasste Tag in der Woche
  assert.deepEqual(computeStreak(rows, '2026-10-04', TZ), { current: 0, best: 1, total: 1 });
});

test('Üben an einem freien Tag zählt nicht und bricht nicht', () => {
  const rows = [done('2026-10-01', '2026-10-05T06:00:00Z'), free('2026-10-02', '2026-10-05T06:00:00Z')];
  assert.deepEqual(computeStreak(rows, '2026-10-04', TZ), { current: 1, best: 1, total: 1 });
});

test('beste Serie bleibt nach einem Abbruch, Lerntage insgesamt auch', () => {
  const rows = [];
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) rows.push(done(day, `${addDays(day, 1)}T06:00:00Z`));
  rows.push(done('2026-09-20', '2026-09-21T06:00:00Z'));
  const s = computeStreak(rows, '2026-09-20', TZ);
  assert.deepEqual(s, { current: 1, best: 4, total: 5 });
});

test('Woche: Montag bis Sonntag mit erledigten Tagen und heute', () => {
  const rows = [done('2026-09-28'), done('2026-09-30'), done('2026-09-20')];
  const week = weekOf(rows, '2026-10-01'); // Donnerstag
  assert.deepEqual(week.map((d) => d.day), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(week.map((d) => d.done), [true, false, true, false, false, false, false]);
  assert.deepEqual(week.map((d) => d.today), [false, false, false, true, false, false, false]);
  assert.deepEqual(week.map((d) => d.future), [false, false, false, false, true, true, true]);
  // Sonntag gehört zur Woche davor
  assert.equal(weekOf([], '2026-10-04')[0].day, '2026-09-28');
});
