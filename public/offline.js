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

// Stand vom Server übernehmen – außer für Wörter, zu denen das Gerät schon eine neuere Antwort hat
// (die ist dann noch unterwegs und kommt mit der nächsten Übertragung an).
export function mergeProgress(local = [], server = []) {
  const merged = new Map(local.map((p) => [rowKey(p), p]));
  for (const p of server) {
    const mine = merged.get(rowKey(p));
    if (!mine || !mine.last_review || (p.last_review ?? '') >= mine.last_review) merged.set(rowKey(p), p);
  }
  return [...merged.values()];
}

// Kennzahlen für die Startseite wie in GET /api/lists: geübt, sicher, fällig bis until, zuletzt
export function summarize(progress = [], until = new Date()) {
  const seen = new Set();
  const safe = new Set();
  let due = 0;
  let last = null;
  for (const p of progress) {
    seen.add(p.word_id);
    if (p.box >= SAFE_LEVEL) safe.add(p.word_id);
    if (p.due && new Date(p.due) <= until) due++;
    if (p.last_seen && (!last || p.last_seen > last)) last = p.last_seen;
  }
  return { seen: seen.size, safe: safe.size, due, last_seen: last };
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
