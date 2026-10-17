// Wochenrückblick: reine Funktionen ohne Datenbank (siehe docs/gamification-plan.md, Schritt 3).
// Verglichen wird nur mit sich selbst: diese Woche gegen die letzte.

import { SAFE_LEVEL, levelFor } from './scheduler.js';
import { addDays, startOfDay } from './streak.js';

// Wie viele Einheiten (Wörter, Regeln) zu den Zeitpunkten times (ms, aufsteigend) sicher waren.
// rows: Antworten { unit, part, stability, at } nach at sortiert; part ist die Richtung (Regeln: leer).
// Eine Einheit ist sicher, wenn die letzte Antwort in einer ihrer Richtungen sicher war (wie bei den Abzeichen).
export function safeCountsAt(rows, times) {
  const latest = new Map(); // unit:part -> sicher?
  const counts = [];
  let i = 0;
  for (const t of times) {
    while (i < rows.length && Date.parse(rows[i].at) <= t) {
      const r = rows[i++];
      latest.set(`${r.unit}:${r.part ?? ''}`, levelFor(r.stability) >= SAFE_LEVEL);
    }
    const safe = new Set();
    for (const [k, isSafe] of latest) if (isSafe) safe.add(k.slice(0, k.lastIndexOf(':')));
    counts.push(safe.size);
  }
  return counts;
}

// Rückblick für die Woche von today (Montag bis Sonntag) und die Woche davor.
// days: Tage mit erreichtem Tagesziel ('JJJJ-MM-TT'), words/rules: Antworten wie bei safeCountsAt.
// Ergebnis: { days, safeWords, safeRules } für diese und last für die letzte Woche. „Sicher dazu“ ist die
// Zunahme (nie unter 0: Wer etwas vergisst, bekommt hier keinen Abzug angezeigt).
export function weekReview({ days, words, rules }, today, nowMs, timeZone) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  const lastMonday = addDays(monday, -7);
  const times = [startOfDay(lastMonday, timeZone), startOfDay(monday, timeZone), nowMs];
  const gain = (c) => [Math.max(0, c[1] - c[0]), Math.max(0, c[2] - c[1])];
  const [lastWords, thisWords] = gain(safeCountsAt(words, times));
  const [lastRules, thisRules] = gain(safeCountsAt(rules, times));
  const count = (from, to) => days.filter((d) => d >= from && d < to).length;
  return {
    days: count(monday, addDays(monday, 7)),
    safeWords: thisWords,
    safeRules: thisRules,
    last: { days: count(lastMonday, monday), safeWords: lastWords, safeRules: lastRules },
  };
}
