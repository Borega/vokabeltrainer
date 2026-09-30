// Lernen ohne Internet: Lernstand auf dem Gerät fortschreiben und mit dem Server abgleichen.
// Reine Funktionen – werden im Browser und in den Tests verwendet. Speicher: store.js, Planung: schedule.js.

import { SAFE_LEVEL } from './schedule.js';

const rowKey = (p) => `${p.word_id}:${p.direction}`;

// Neuer Lernstand eines Worts nach einer Antwort, genauso wie ihn der Server berechnet.
export function answer(row, { word_id, direction, grade, correct, at }, review) {
  return {
    ...row,
    word_id,
    direction,
    right: (row?.right ?? 0) + (correct ? 1 : 0),
    wrong: (row?.wrong ?? 0) + (correct ? 0 : 1),
    last_seen: at,
    ...review(row, grade, new Date(at)),
  };
}

// Stand vom Server übernehmen. Nur Wörter, zu denen noch eine Antwort auf dem Gerät wartet (pendingKeys:
// Set aus "<word_id>:<direction>"), behalten den Stand vom Gerät – die Antwort kommt mit der nächsten
// Übertragung an. Sonst hat der Server recht, auch wenn dort Zeilen fehlen (z. B. auf einem anderen Gerät
// zurückgesetzt). wordIds (optional): Wörter der Liste; Zeilen gelöschter Wörter fallen weg.
export function mergeProgress(local = [], server = [], pendingKeys = new Set(), wordIds = null) {
  const merged = new Map(server.map((p) => [rowKey(p), p]));
  for (const p of local) if (pendingKeys.has(rowKey(p))) merged.set(rowKey(p), p);
  const rows = [...merged.values()];
  return wordIds ? rows.filter((p) => wordIds.has(p.word_id)) : rows;
}

// Kennzahlen für die Startseite wie in GET /api/lists: geübt, sicher, fällig bis until, zuletzt.
// unit: Spalte, die das Wort bzw. die Regel bezeichnet ('word_id' oder 'rule_id')
export function summarize(progress = [], until = new Date(), unit = 'word_id') {
  const seen = new Set();
  const safe = new Set();
  let due = 0;
  let last = null;
  for (const p of progress) {
    seen.add(p[unit]);
    if (p.box >= SAFE_LEVEL) safe.add(p[unit]);
    if (p.due && new Date(p.due) <= until) due++;
    if (p.last_seen && (!last || p.last_seen > last)) last = p.last_seen;
  }
  return { seen: seen.size, safe: safe.size, due, last_seen: last };
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------- Grammatik: Lernstand je Regel ----------

export const ruleKey = (ruleId) => `r${ruleId}`;

// Neuer Lernstand einer Regel nach einer Runde, genauso wie ihn der Server berechnet (src/api.js, applyRound).
// entry: { rule_id, grade (die Bewertung der Runde), items: [{ grade, … }], at }
export function answerRule(row, { rule_id, grade, items = [], at }, review) {
  const right = items.length ? items.filter((i) => i.grade !== 'again').length : grade === 'again' ? 0 : 1;
  const wrong = items.length ? items.length - right : grade === 'again' ? 1 : 0;
  return {
    ...row,
    rule_id,
    right: (row?.right ?? 0) + right,
    wrong: (row?.wrong ?? 0) + wrong,
    last_seen: at,
    ...review(row, grade, new Date(at)),
  };
}

// Wie mergeProgress, je Regel: pendingKeys enthält ruleKey(rule_id) für Regeln mit wartender Runde,
// ruleIds (optional) die Regeln der Liste.
export function mergeRuleProgress(local = [], server = [], pendingKeys = new Set(), ruleIds = null) {
  const merged = new Map(server.map((p) => [p.rule_id, p]));
  for (const p of local) if (pendingKeys.has(ruleKey(p.rule_id))) merged.set(p.rule_id, p);
  const rows = [...merged.values()];
  return ruleIds ? rows.filter((p) => ruleIds.has(p.rule_id)) : rows;
}
