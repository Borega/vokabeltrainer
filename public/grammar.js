// Grammatikaufgaben: Textsyntax der Lehrkräfte, Prüfung, Rückmeldung, Aufgabenauswahl und Bewertung.
// Reine Funktionen – werden im Browser, vom Server (Prüfung beim Speichern) und in den Tests verwendet.
//
// Eine Aufgabe steht in einer Zeile, darunter optional Hinweise mit „!“:
//   She *has lived* (live) here since 2010.          Lücke: *richtig|Variante* (Grundform), mehrere pro Satz
//   They {have known|knew|are knowing} each other.   Auswählen: die erste Form ist die richtige
//   Fehler: He have worked here. → He has worked here.
//   Ordnen: I / have never been / to Spain
//   Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years. | I’ve known her for three years.
//   Umformen: Ins Passiv: They built the house. → The house was built.
//   ! knew = Seit wann? Mit „since“ steht das present perfect.   Hinweis für genau diese falsche Antwort
//   ! Achte auf das Signalwort.                                  Hinweis für jede falsche Antwort
//
// Geprüft wird wie bei Vokabeln (check.js: Groß-/Kleinschreibung, Akzente), nur strenger bei Tippfehlern:
// In einer Grammatikübung ist ein „Tippfehler“ oft die falsche Form (knew ↔ know, lived ↔ live).

import { normalize } from './check.js';

export const KIND_LABELS = {
  choice: 'Auswählen',
  gap: 'Lücke',
  error: 'Fehler finden',
  order: 'Satzbau',
  translate: 'Umformen / Übersetzen',
};
// Bezeichnung der Aufgabenart in der Lernansicht (Umformen und Übersetzen sind beide „translate“)
export const TYPE_LABELS = { ...KIND_LABELS, translate: 'Übersetzen', transform: 'Umformen', gap: 'Lücke füllen' };

export const LIMITS = { rules: 100, items: 2000, title: 200, summary: 300, explanation: 4000, source: 1200 };

// ---------- Aufgaben lesen ----------

// Text eines Regel-Felds → einzelne Aufgaben. Hinweiszeilen („!“) gehören zur Aufgabe darüber.
// lines: Zeilennummern im Text (1-basiert), damit Fehlermeldungen auf die richtige Zeile zeigen.
export function splitItems(text) {
  const items = [];
  const errors = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('!')) {
      const last = items.at(-1);
      if (last) {
        last.source += `\n${line}`;
        last.lines.push(i + 1);
      } else {
        errors.push({ line: i + 1, error: 'Ein Hinweis mit „!“ gehört unter eine Aufgabe.' });
      }
      return;
    }
    items.push({ source: line, lines: [i + 1] });
  });
  return { items, errors };
}

const PREFIXES = [
  [/^fehler(?: finden)?\s*:\s*/i, 'error'],
  [/^ordnen\s*:\s*/i, 'order'],
  [/^(?:ü|ue)bersetzen\s*:\s*/i, 'translate'],
  [/^umformen\s*:\s*/i, 'transform'],
];
const ARROW = /\s*(?:→|->)\s*/;
// *Lücke* mit optionalem (Hinweis) direkt dahinter – oder {Auswahl|…}
const GAP = /\*([^*]*)\*(?:[ \t]?\(([^()]*)\))?|\{([^{}]*)\}/g;

const fail = (error, part = 0) => ({ error, part });
const list = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);
const clip = (s, max = 40) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
// Eine Antwort ohne Buchstaben und Ziffern (nur Satzzeichen) ließe sich nie eintippen: Die Prüfung ignoriert sie
const hasWord = (s) => /[\p{L}\p{N}]/u.test(s);

// Aufgabe (Zeile plus Hinweiszeilen) lesen. Ergebnis: { type, feedback, … } oder { error, part } –
// part ist die Zeile der Aufgabe (0 = Aufgabenzeile, 1 = erster Hinweis …).
// type: 'gap' | 'choice' | 'error' | 'order' | 'translate' | 'transform'
export function parseItem(source) {
  const lines = String(source ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return fail('Die Aufgabe ist leer.');
  if (lines[0].startsWith('!')) return fail('Ein Hinweis mit „!“ gehört unter eine Aufgabe.');
  if (lines.join('\n').length > LIMITS.source) return fail(`Die Aufgabe ist zu lang (max. ${LIMITS.source} Zeichen).`);
  const task = lines[0];
  let type = null;
  let body = task;
  for (const [re, t] of PREFIXES) {
    const m = task.match(re);
    if (m) {
      type = t;
      body = task.slice(m[0].length);
      break;
    }
  }
  const parsed = type ? parseSpecial(type, body) : parseGapLine(body);
  if (parsed.error) return parsed;
  const feedback = [];
  for (const [i, line] of lines.slice(1).entries()) {
    if (!line.startsWith('!')) return fail('Hinweise beginnen mit „!“ – jede Aufgabe steht in einer Zeile.', i + 1);
    const text = line.slice(1).trim();
    if (!text) return fail('Der Hinweis ist leer.', i + 1);
    const eq = text.indexOf('=');
    if (eq < 0) {
      feedback.push({ keys: null, text });
      continue;
    }
    const keys = list(text.slice(0, eq));
    const hint = text.slice(eq + 1).trim();
    if (!keys.length || !hint) return fail('Erwartet: „! falsche Antwort = Hinweis“ (oder nur „! Hinweis“).', i + 1);
    feedback.push({ keys, text: hint });
  }
  return { ...parsed, feedback, source: lines.join('\n') };
}

function parseGapLine(text) {
  const parts = [];
  const gaps = [];
  let options = null;
  let last = 0;
  for (const m of text.matchAll(GAP)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[3] !== undefined) {
      if (options) return fail('Nur eine Auswahl { … } pro Aufgabe.');
      const raw = m[3].split('|').map((o) => o.trim());
      if (raw.some((o) => !o)) return fail('Eine Antwortmöglichkeit in { … } ist leer.');
      if (!raw.every(hasWord)) return fail('Eine Antwortmöglichkeit in { … } enthält kein Wort.');
      if (raw.length < 2 || raw.length > 4) return fail('Eine Auswahl braucht 2 bis 4 Antworten: {richtig|falsch|falsch}.');
      if (new Set(raw.map(loose)).size !== raw.length) return fail('Eine Antwort steht zweimal in { … }.');
      options = raw;
      gaps.push({ answers: [raw[0]], hint: '' });
    } else {
      const answers = list(m[1]);
      if (!answers.length) return fail('Die Lücke zwischen den Sternchen ist leer.');
      if (!answers.every(hasWord)) return fail('Die Lücke enthält kein Wort – nur Satzzeichen lassen sich nicht eintippen.');
      gaps.push({ answers, hint: (m[2] ?? '').trim() });
    }
    parts.push({ gap: gaps.length - 1 });
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  if (parts.some((p) => p.text && /[*{}]/.test(p.text))) return fail('Ein Sternchen oder eine geschweifte Klammer ist nicht geschlossen.');
  if (!gaps.length) {
    return fail('Keine Lücke gefunden: Markiere die gesuchte Form mit *Sternchen* oder biete mit {richtig|falsch} Formen zur Wahl an.');
  }
  if (options && gaps.length > 1) return fail('Auswahl { … } und Lücke * … * lassen sich in einer Aufgabe nicht mischen.');
  return { type: options ? 'choice' : 'gap', parts, gaps, ...(options ? { options } : {}) };
}

function splitArrow(body) {
  const m = body.match(ARROW);
  if (!m) return null;
  return [body.slice(0, m.index).trim(), body.slice(m.index + m[0].length).trim()];
}

function parseSpecial(type, body) {
  if (type === 'order') {
    const orders = body.split('|').map((o) => o.split('/').map((c) => c.trim()));
    if (orders.some((chunks) => chunks.some((c) => !c))) return fail('Ordnen: Ein Satzteil ist leer – Teile mit „/“ trennen.');
    if (orders[0].length < 2) return fail('Ordnen: Mindestens zwei Satzteile mit „/“ trennen: Ordnen: I / have never been / to Spain');
    const tiles = (chunks) => chunks.map(loose).sort().join('\n');
    if (orders.some((chunks) => tiles(chunks) !== tiles(orders[0]))) return fail('Ordnen: Alle Reihenfolgen nach „|“ müssen dieselben Satzteile haben.');
    return { type, orders, chunks: orders[0] };
  }
  const sides = splitArrow(body);
  const example = { error: 'Fehler: falscher Satz → richtiger Satz', translate: 'Übersetzen: Ausgangssatz → Lösung', transform: 'Umformen: Anweisung und Satz → Lösung' }[type];
  if (!sides || !sides[0] || !sides[1]) return fail(`Erwartet: ${example} (mit → oder ->).`);
  const solutions = list(sides[1]);
  if (!solutions.length) return fail(`Erwartet: ${example} (mit → oder ->).`);
  if (!solutions.every(hasWord)) return fail('Die Lösung enthält kein Wort – nur Satzzeichen lassen sich nicht eintippen.');
  if (type === 'error') {
    if (solutions.flatMap(expand).some((s) => clean(s) === clean(sides[0]))) return fail('Fehler: Der falsche Satz ist mit der Lösung identisch.');
    return { type, given: sides[0], solutions };
  }
  return { type, prompt: sides[0], solutions };
}

// ---------- Prüfen ----------

const loose = (s) => normalize(String(s), { caseSensitive: false, accentSensitive: false });
const LOOSE = { caseSensitive: false, accentSensitive: false };
// Kommas und Anführungszeichen zählen nicht – es geht um die Form, nicht um die Zeichensetzung
const clean = (s, options = LOOSE) => normalize(String(s).replace(/[,;:"„“”«»]/g, ' '), options);

// Alle Schreibweisen einer Lösung: Teile in Klammern sind optional – „(have) known“ → „have known“, „known“
export function expand(answer) {
  const a = String(answer).trim();
  const forms = /\(.*?\)/.test(a) ? [a.replace(/[()]/g, ''), a.replace(/\s*\([^)]*\)\s*/g, ' ')] : [a];
  return [...new Set(forms.map((f) => f.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

// Ein Tippfehler im eigentlichen Sinn: zwei vertauschte Buchstaben oder ein ausgelassener/doppelter Buchstabe
// mitten im Wort. Ersetzte Buchstaben (knew ↔ know) und geänderte Anfänge oder Endungen (here ↔ there,
// lived ↔ live) sind in einer Grammatikübung Fehler, keine Tippfehler.
function tokenTypo(a, b) {
  if (a === b) return false;
  if (a.length === b.length) {
    if (a.length < 3) return false;
    const i = [...a].findIndex((ch, k) => ch !== b[k]);
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (long.length < 5) return false;
  const i = [...short].findIndex((ch, k) => ch !== long[k]);
  return i >= 1 && short.slice(i) === long.slice(i + 1);
}

function isTypo(given, expected) {
  const g = given.split(' ');
  const e = expected.split(' ');
  if (g.length !== e.length) return false;
  const differing = g.map((tok, i) => [tok, e[i]]).filter(([x, y]) => x !== y);
  return differing.length === 1 && tokenTypo(...differing[0]);
}

// Eingabe gegen mögliche Lösungen. Ergebnis: { state: 'correct' | 'almost' | 'wrong', reason?, match? }
// 'almost' = nur Akzent, Groß-/Kleinschreibung oder ein Tippfehler; zählt für die Planung als „hard“.
export function checkText(input, answers, options = {}) {
  return checkVariants(input, answers.flatMap(expand), options);
}

// Wie checkText, aber die Schreibweisen stehen schon fest (Klammern gelten wörtlich)
function checkVariants(input, variants, options) {
  const given = clean(input, options);
  if (!given) return { state: 'wrong' };
  const exact = variants.find((v) => clean(v, options) === given);
  if (exact !== undefined) return { state: 'correct', match: exact };
  const givenLoose = clean(input);
  for (const v of variants) {
    if (clean(v) !== givenLoose) continue;
    const noAccents = { ...options, accentSensitive: false };
    const reason = options.accentSensitive !== false && clean(v, noAccents) === clean(input, noAccents) ? 'accents' : 'case';
    return { state: 'almost', reason, match: v };
  }
  const typo = variants.find((v) => isTypo(givenLoose, clean(v)));
  return typo !== undefined ? { state: 'almost', reason: 'typo', match: typo } : { state: 'wrong' };
}

const worst = (states) => (states.includes('wrong') ? 'wrong' : states.includes('almost') ? 'almost' : 'correct');

// Lücken einer Aufgabe: inputs[i] gehört zur i-ten Lücke. Ergebnis: { state, gaps: [{ state, reason?, match? }] }
export function checkGaps(item, inputs, options = {}) {
  const gaps = item.gaps.map((gap, i) => checkText(inputs[i] ?? '', gap.answers, options));
  return { state: worst(gaps.map((g) => g.state)), gaps };
}

// Fehler finden, Übersetzen, Umformen: ganzer Satz. Bei „Fehler“ zählt der unveränderte Satz nie.
export function checkSentence(item, input, options = {}) {
  if (item.type === 'error' && clean(input, options) === clean(item.given, options)) return { state: 'wrong', unchanged: true };
  return checkText(input, item.solutions, options);
}

// Satzbau: chunks = gewählte Satzteile in der gewählten Reihenfolge
export function checkOrder(item, chunks, options = {}) {
  // Satzteile gelten wörtlich: Klammern darin sind keine optionalen Teile
  const result = checkVariants(chunks.join(' '), item.orders.map((o) => o.join(' ')), options);
  return { state: result.state === 'correct' ? 'correct' : 'wrong' };
}

// Die Lösung, die der Eingabe am nächsten kommt (für die Markierung der Fehlerstelle)
export function closestSolution(item, input, options = {}) {
  const candidates = item.type === 'order' ? item.orders.map((o) => o.join(' ')) : item.solutions.flatMap(expand);
  const given = clean(input, options);
  const score = (c) => tokenDistance(given.split(' '), clean(c, options).split(' '));
  return candidates.map((text) => ({ text, d: score(text) })).sort((x, y) => x.d - y.d)[0]?.text ?? '';
}

// ---------- Fehlerstelle markieren ----------

const tokens = (s) => String(s).trim().split(/\s+/).filter(Boolean);

function lcsTable(a, b, same) {
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = same(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  return t;
}

function tokenDistance(a, b) {
  return a.length + b.length - 2 * lcsTable(a, b, (x, y) => x === y)[0][0];
}

// Wortweiser Vergleich: welche Wörter der Eingabe stimmen mit der Lösung überein?
// Ergebnis: { given: [{ text, ok }], expected: [{ text, ok }] } – ok = Wort kommt an dieser Stelle in beiden vor.
export function diffWords(given, expected, options = {}) {
  const a = tokens(given);
  const b = tokens(expected);
  const key = (tok) => clean(tok, options);
  const same = (x, y) => key(x) === key(y);
  const t = lcsTable(a, b, same);
  const out = { given: a.map((text) => ({ text, ok: false })), expected: b.map((text) => ({ text, ok: false })) };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      out.given[i++].ok = true;
      out.expected[j++].ok = true;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return out;
}

// Satzteile, die in der Reihenfolge an der falschen Stelle stehen (Satzbau): Liste von Wahrheitswerten
export function orderMarks(chunks, expected, options = {}) {
  const want = expected.map((c) => clean(c, options));
  return chunks.map((c, i) => clean(c, options) === want[i]);
}

// ---------- Rückmeldung ----------

// Hinweis nach einer falschen Antwort: passender „! falsch = Hinweis“ der Lehrkraft, sonst ein allgemeiner
// Hinweis der Aufgabe, sonst der Merksatz der Regel. answers: die falschen Eingaben (bei Lücken je Lücke).
// Ergebnis: { text, source: 'item' | 'rule' }
export function feedbackFor(item, answers, rule) {
  const given = (Array.isArray(answers) ? answers : [answers]).map((a) => clean(a ?? '')).filter(Boolean);
  // Der genaueste Treffer gewinnt: gleiche Antwort vor „kommt als Wort vor“, dann der längere Schlüssel
  let best = null;
  for (const fb of item.feedback ?? []) {
    for (const raw of fb.keys ?? []) {
      const key = clean(raw);
      if (!key) continue;
      for (const a of given) {
        const score = a === key ? 1000 + key.length : ` ${a} `.includes(` ${key} `) ? key.length : 0;
        if (score > (best?.score ?? 0)) best = { score, text: fb.text };
      }
    }
  }
  if (best) return { text: best.text, source: 'item' };
  const general = (item.feedback ?? []).find((fb) => !fb.keys);
  if (general) return { text: general.text, source: 'item' };
  return { text: rule?.summary ?? '', source: 'rule' };
}

// ---------- Anzeige ----------

// Satz der Aufgabe mit der gesuchten Form als Lösung: [{ text, mark }] – mark = hier stand die Lücke
export function segments(item) {
  if (item.parts) {
    return item.parts.map((p) => (p.gap === undefined
      ? { text: p.text, mark: false }
      : { text: expand(item.gaps[p.gap].answers[0])[0], mark: true }));
  }
  const text = item.type === 'order' ? item.orders[0].join(' ') : expand(item.solutions[0])[0];
  return [{ text, mark: false }];
}

// Der ganze richtige Satz (zum Anzeigen und Vorlesen)
export function solutionText(item) {
  return segments(item).map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
}

// Satzbau: Satzteile in zufälliger Reihenfolge (nie gleich der richtigen, wenn es anders geht)
export function shuffledChunks(item, random = Math.random) {
  const chunks = [...item.chunks];
  const right = chunks.join('\n');
  for (let attempt = 0; attempt < 10; attempt++) {
    shuffle(chunks, random);
    if (chunks.join('\n') !== right || new Set(chunks.map(loose)).size < 2) break;
  }
  return chunks;
}

function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Aufgabenarten und Auswahl ----------

// Ablenker für eine Auswahl, die aus einer Lückenaufgabe wird: die falschen Antworten aus den Hinweisen
function distractors(item) {
  const seen = new Set(item.gaps[0].answers.flatMap(expand).map(loose));
  const out = [];
  for (const fb of item.feedback ?? []) {
    for (const key of fb.keys ?? []) {
      const k = loose(key);
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(key);
      }
    }
  }
  return out.slice(0, 3);
}

// Welche Übungsarten ('choice' | 'gap' | 'error' | 'order' | 'translate') lässt die Aufgabe zu?
// Eine Lückenaufgabe wird auch zur Auswahl, wenn ihre Hinweise falsche Antworten nennen (typische Fehler).
// Eine Auswahl wird nie zur Lücke: Ohne Grundform gäbe es mehrere richtige Antworten.
export function capabilities(item) {
  switch (item.type) {
    case 'choice': return ['choice'];
    case 'gap': return item.gaps.length === 1 && distractors(item).length ? ['gap', 'choice'] : ['gap'];
    case 'error': return ['error'];
    case 'order': return ['order'];
    default: return ['translate'];
  }
}

// Aufgabe in der Form der Übungsart – oder null, wenn sie dafür nicht taugt
export function asKind(item, kind) {
  if (!capabilities(item).includes(kind)) return null;
  if (kind === 'choice' && item.type === 'gap') {
    return { ...item, type: 'choice', options: [expand(item.gaps[0].answers[0])[0], ...distractors(item)] };
  }
  return item;
}

// Antwortmöglichkeiten gemischt: { options, correct } (correct = Index der richtigen)
export function choiceOrder(item, random = Math.random) {
  const options = item.options.map((text, i) => ({ text, right: i === 0 }));
  shuffle(options, random);
  return { options: options.map((o) => o.text), correct: options.findIndex((o) => o.right) };
}

const FALLBACK = ['gap', 'choice', 'order', 'translate', 'error'];

// Übungsarten der Einführung einer neuen Regel: erst Auswählen, dann Lücke (geblockt)
export function introKinds(kinds, n = 4) {
  const want = ['choice', 'choice', 'gap', 'gap', 'gap', 'gap'].slice(0, n);
  return want.map((k) => (kinds.includes(k) ? k : FALLBACK.find((f) => kinds.includes(f))));
}

// Welche Übungsart kommt als Nächstes für eine Regel?
//  level: Stufe der Regel (0 neu, 1 Anfang, ab 2 „lernt“), kinds: was die Aufgaben der Regel hergeben,
//  previous: zuletzt für diese Regel gewählte Art (Abwechslung), retry: Wiederholung nach einem Fehler
export function pickKind({ level = 0, kinds, previous = null, retry = false, random = Math.random }) {
  if (!kinds.length) return null;
  // Nach einem Fehler auf der unteren Stufe: Auswählen als Ausweichlösung, damit die Runde mit Erfolg endet
  if (retry && level <= 1 && kinds.includes('choice')) return 'choice';
  let pool;
  if (level <= 1) {
    // Anfang: vor allem Lücke, dazu Satzbau; Auswählen nur, wenn sonst nichts geht
    pool = ['gap', 'gap', 'gap', 'order'].filter((k) => kinds.includes(k));
  } else {
    // ab „lernt“: Lücke, Fehler finden, Satzbau, Umformen/Übersetzen im Wechsel
    pool = ['gap', 'error', 'order', 'translate'].filter((k) => kinds.includes(k));
  }
  if (!pool.length) pool = FALLBACK.filter((k) => kinds.includes(k));
  const distinct = [...new Set(pool)];
  const choices = distinct.length > 1 ? pool.filter((k) => k !== previous) : pool;
  return choices[Math.floor(random() * choices.length)] ?? pool[0];
}

// Aufgaben auswählen: die am längsten nicht bearbeiteten zuerst (nie bearbeitete vor allen anderen), bei
// Gleichstand zufällig; die zuletzt bearbeitete nur, wenn es nicht anders geht.
//  entries: [{ id, … }], seen: { id → Zeitpunkt der letzten Bearbeitung }
export function pickItems(entries, seen, n, { random = Math.random, avoid = null } = {}) {
  const ranked = entries
    .map((entry) => ({ entry, at: seen[entry.id] ?? '', r: random() }))
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.r - y.r))
    .map((x) => x.entry);
  if (avoid != null && ranked.length > n) {
    const i = ranked.findIndex((e) => e.id === avoid);
    if (i >= 0 && i < n) ranked.push(...ranked.splice(i, 1));
  }
  return ranked.slice(0, n);
}

// Zuletzt bearbeitete Aufgabe einer Regel (oder null, wenn noch keine bearbeitet wurde)
export function lastItem(entries, seen) {
  let best = null;
  for (const e of entries) if (seen[e.id] && (!best || seen[e.id] > seen[best.id])) best = e;
  return best?.id ?? null;
}

// ---------- Runde zusammenstellen ----------

// Gemischt, aber dieselbe Regel nie direkt hintereinander, wenn es anders geht: immer aus der Regel mit den
// meisten übrigen Aufgaben wählen, die nicht gerade dran war (sonst bliebe am Ende eine Regel übrig).
const mixOrder = (tasks, random) => {
  const left = shuffle([...tasks], random);
  const out = [];
  while (left.length) {
    const previous = out.at(-1)?.ruleId;
    const counts = new Map();
    for (const t of left) counts.set(t.ruleId, (counts.get(t.ruleId) ?? 0) + 1);
    let candidates = [...counts].filter(([id]) => id !== previous);
    if (!candidates.length) candidates = [...counts];
    const most = Math.max(...candidates.map(([, n]) => n));
    const top = candidates.filter(([, n]) => n === most);
    const [ruleId] = top[Math.floor(random() * top.length)];
    out.push(...left.splice(left.findIndex((t) => t.ruleId === ruleId), 1));
  }
  return out;
};

// Aufgaben einer Regel für eine Runde.
//  rule: { id, items: [{ id, item }] } (nur gültige Aufgaben), level: Stufe, n: Anzahl
function tasksForRule(rule, { level, n, seen, random }) {
  const usable = rule.items.filter((e) => capabilities(e.item).length);
  const kinds = [...new Set(usable.flatMap((e) => capabilities(e.item)))];
  if (!kinds.length) return [];
  const count = Math.min(n, usable.length);
  const plan = [];
  let previous = null;
  const intro = level === 0 ? introKinds(kinds, count) : null;
  for (let i = 0; i < count; i++) {
    previous = intro ? intro[i] : pickKind({ level, kinds, previous, random });
    plan.push(previous);
  }
  const avoid = lastItem(usable, seen);
  // Fehler finden, Umformen und Übersetzen gibt es erst ab „lernt“ (Stufe 2)
  const allowed = level >= 2 ? null : ['gap', 'choice', 'order'];
  const used = new Set();
  const tasks = [];
  for (const kind of plan) {
    const fits = usable.filter((e) => !used.has(e.id) && capabilities(e.item).includes(kind));
    // Keine freie Aufgabe für diese Art mehr: eine andere Art, die zur Stufe passt – sonst weniger Aufgaben
    let pool = fits;
    if (!pool.length) {
      pool = usable.filter((e) => !used.has(e.id) && (!allowed || capabilities(e.item).some((k) => allowed.includes(k))));
      if (!pool.length && !tasks.length) pool = usable.filter((e) => !used.has(e.id));
    }
    const [entry] = pickItems(pool, seen, 1, { random, avoid: pool.length > 1 ? avoid : null });
    if (!entry) break;
    used.add(entry.id);
    const own = capabilities(entry.item);
    tasks.push({ ruleId: rule.id, itemId: entry.id, kind: fits.length ? kind : own.find((k) => !allowed || allowed.includes(k)) ?? own[0] });
  }
  if (level === 0 && tasks.length) tasks[0].card = true;
  return tasks;
}

// Runde zusammenstellen.
//  rules: alle Regeln der Liste in der Reihenfolge der Lehrkraft, je { id, items: [{ id, item }] }
//  progress: Map Regel-ID → Lernstand (nur Regeln, die schon geübt wurden)
//  seen: { Aufgaben-ID → Zeitpunkt der letzten Bearbeitung }
//  mode 'due': fällige Regeln (älteste zuerst, höchstens maxRules) gemischt, dazu höchstens eine neue Regel
//     als geschlossener Block vorweg
//  mode 'free': die Regeln aus ruleIds, nach Regeln geordnet (blocked) oder gemischt; neue Regeln als Block vorweg
// Ergebnis: { tasks: [{ ruleId, itemId, kind, card? }], newRuleId } – card: vor dieser Aufgabe die Regelkarte zeigen
export function buildRound({ rules, progress, seen = {}, mode = 'due', ruleIds = [], perRule = 2, maxRules = 5, until = new Date(), blocked = false, random = Math.random }) {
  const usable = (r) => r.items.length > 0;
  const rowOf = (r) => progress.get(r.id);
  const levelOf = (r) => rowOf(r)?.box ?? 0;
  let chosen;
  let newRule = null;
  if (mode === 'due') {
    chosen = rules
      .filter((r) => usable(r) && rowOf(r)?.due && new Date(rowOf(r).due) <= until)
      .sort((x, y) => new Date(rowOf(x).due) - new Date(rowOf(y).due))
      .slice(0, maxRules);
    newRule = rules.find((r) => usable(r) && !rowOf(r)) ?? null;
  } else {
    const wanted = new Set(ruleIds);
    chosen = rules.filter((r) => wanted.has(r.id) && usable(r));
  }
  const fresh = mode === 'due' ? (newRule ? [newRule] : []) : chosen.filter((r) => !rowOf(r));
  const known = mode === 'due' ? chosen : chosen.filter((r) => rowOf(r));
  const freshTasks = fresh.flatMap((r) => tasksForRule(r, { level: 0, n: Math.max(perRule, 4), seen, random }));
  const knownTasks = known.map((r) => tasksForRule(r, { level: levelOf(r), n: perRule, seen, random }));
  const tasks = blocked ? knownTasks.flat() : mixOrder(knownTasks.flat(), random);
  return { tasks: [...freshTasks, ...tasks], newRuleId: newRule?.id ?? null };
}

// Regeln, die heute fällig sind (oder früher): Anzahl für die Anzeige
export function dueRuleCount(rules, progress, until) {
  return rules.filter((r) => r.items.length && progress.get(r.id)?.due && new Date(progress.get(r.id).due) <= until).length;
}

// Regelkarte: bis zu n Beispielsätze aus den Aufgaben der Regel mit hervorgehobener Form (bevorzugt Lücken)
export function pickExamples(entries, n = 3, random = Math.random) {
  const withGap = entries.filter((e) => e.item.parts);
  const pool = shuffle([...(withGap.length >= n ? withGap : entries)], random);
  return pool.slice(0, n).map((e) => ({ id: e.id, segments: segments(e.item) }));
}

// ---------- Bewertung ----------

const ORDER = ['again', 'hard', 'good', 'easy'];

// Bewertung einer Aufgabe für die Planung.
//  correct:  am Ende richtig (auch nach Hinweis oder „Ich hatte recht“)
//  attempts: 1 oder 2 Versuche
//  helped:   Regel vor der Antwort nachgelesen
//  almost:   erster Versuch nur ein Akzent-, Schreib- oder Tippfehler (wird als Fast-richtig gezeigt)
// Auswählen ist nur Wiedererkennen und zählt höchstens als „hard“ – wie bei Vokabeln.
export function gradeFor(kind, { correct, attempts = 1, helped = false, almost = false }) {
  if (almost) return 'hard';
  if (!correct) return 'again';
  if (kind === 'choice' || attempts > 1 || helped) return 'hard';
  return 'good';
}

// Pro Regel und Runde zählt eine Bewertung: die schlechteste. Mehrere Bewertungen am selben Tag würden die
// Stabilität kaum erhöhen, ein einzelnes „again“ sie aber senken.
export function roundGrade(grades) {
  const rank = grades.map((g) => ORDER.indexOf(g)).filter((i) => i >= 0);
  return rank.length ? ORDER[Math.min(...rank)] : null;
}

// ---------- Regeln prüfen (Server beim Speichern, Editor) ----------

// rules: [{ title, summary, explanation, items: [{ source }] }]. Ergebnis: null oder die erste Fehlermeldung.
export function validateRules(rules) {
  if (!Array.isArray(rules) || !rules.length) return 'Die Liste enthält keine Regeln.';
  if (rules.length > LIMITS.rules) return `Höchstens ${LIMITS.rules} Regeln pro Liste.`;
  let total = 0;
  for (const [i, rule] of rules.entries()) {
    const name = rule.title ? `Regel „${clip(rule.title)}“` : `Regel ${i + 1}`;
    if (!rule.title) return `${name}: Bitte einen Titel angeben.`;
    if (!rule.summary) return `${name}: Der Merksatz fehlt – eine Zeile, die die Regel zusammenfasst.`;
    if (!rule.items.length) return `${name} hat noch keine Aufgaben.`;
    total += rule.items.length;
    for (const [k, item] of rule.items.entries()) {
      const parsed = parseItem(item.source);
      if (parsed.error) return `${name}, Aufgabe ${k + 1}: ${parsed.error}`;
    }
  }
  if (total > LIMITS.items) return `Höchstens ${LIMITS.items} Aufgaben pro Liste.`;
  return null;
}

// ---------- Aufgaben beim Bearbeiten wiedererkennen ----------

const wordSet = (s) => new Set(tokens(loose(String(s).split('\n')[0].replace(/[*{}|/()]/g, ' '))));

// Die gesuchten Formen einer Aufgabe (*…*): Wechselt die Lösung, ist es eine andere Aufgabe
const gapsOf = (s) => [...String(s).split('\n')[0].matchAll(/\*([^*]*)\*/g)].map((m) => loose(m[1])).join('|');

function similarity(a, b) {
  if (gapsOf(a) !== gapsOf(b)) return 0;
  const x = wordSet(a);
  const y = wordSet(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

// Beim Speichern: Welche Aufgabe im Textfeld ist welche gespeicherte? IDs bleiben erhalten, damit Lernstand
// und Fehlerstatistik nicht verloren gehen. Erst gleicher Text, dann die ähnlichste übrige Aufgabe mit
// derselben gesuchten Form und mindestens 60 % gleichen Wörtern (eine bearbeitete Zeile), sonst neu.
// old: [{ id, source }], sources: Texte der Aufgaben im Feld. Ergebnis: Liste gleicher Länge mit ID oder null.
export function matchItems(old, sources) {
  const ids = sources.map(() => null);
  const free = new Set(old.map((_, i) => i));
  sources.forEach((source, i) => {
    const j = [...free].find((k) => old[k].source === source);
    if (j !== undefined) {
      ids[i] = old[j].id;
      free.delete(j);
    }
  });
  sources.forEach((source, i) => {
    if (ids[i] != null) return;
    let best = null;
    for (const k of free) {
      const s = similarity(old[k].source, source);
      if (s >= 0.6 && (!best || s > best.s)) best = { k, s };
    }
    if (best) {
      ids[i] = old[best.k].id;
      free.delete(best.k);
    }
  });
  return ids;
}

// ---------- Textdatei: Import und Export ----------

// Regeln als Textdatei:
//   ## Titel der Regel
//   Merksatz: eine Zeile
//   Entdecken: ja            (optional: erst Beispiele und eine Frage, dann die Regel)
//   Erklärung:
//   mehrere Zeilen …
//   Aufgaben:
//   She *has lived* here.
export function rulesToText(rules) {
  return `${rules.map((r) => [
    `## ${r.title}`,
    `Merksatz: ${r.summary}`,
    r.discover ? 'Entdecken: ja' : null,
    r.explanation ? `Erklärung:\n${r.explanation.trim()}` : null,
    `Aufgaben:\n${r.tasks}`.trimEnd(),
  ].filter((x) => x != null).join('\n')).join('\n\n')}\n`;
}

// Gegenstück zu rulesToText. Ergebnis: { rules: [{ title, summary, explanation, discover, tasks }], errors: [{ line, error }] }
export function parseRulesText(text) {
  const rules = [];
  const errors = [];
  let rule = null;
  let section = null;
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    const head = line.match(/^##\s*(.*)$/);
    if (head) {
      if (!head[1].trim()) errors.push({ line: i + 1, error: 'Die Regel hat keinen Titel (## Titel).' });
      rule = { title: head[1].trim(), summary: '', explanation: '', discover: false, tasks: '' };
      rules.push(rule);
      section = null;
      return;
    }
    if (!rule) {
      if (line.trim()) errors.push({ line: i + 1, error: 'Vor der ersten Regel steht Text – jede Regel beginnt mit „## Titel“.' });
      return;
    }
    const field = line.match(/^(Merksatz|Entdecken|Erklärung|Aufgaben)\s*:\s*(.*)$/i);
    if (field) {
      const name = field[1].toLowerCase();
      const value = field[2].trim();
      if (name === 'merksatz') {
        rule.summary = value;
        section = null;
      } else if (name === 'entdecken') {
        rule.discover = /^(ja|1|true|yes|an)$/i.test(value);
        section = null;
      } else {
        section = name === 'aufgaben' ? 'tasks' : 'explanation';
        if (value) rule[section] += `${value}\n`;
      }
      return;
    }
    if (section) rule[section] += `${line}\n`;
    else if (line.trim()) errors.push({ line: i + 1, error: 'Unerwartete Zeile – erwartet: Merksatz:, Entdecken:, Erklärung: oder Aufgaben:.' });
  });
  for (const r of rules) {
    r.explanation = r.explanation.trim();
    r.tasks = r.tasks.trim();
  }
  return { rules, errors };
}

// Frage für „Entdecken“: eine Zeile der Erklärung, die mit „?“ beginnt. Rest: die Erklärung selbst.
export function splitExplanation(explanation) {
  const lines = String(explanation ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim().startsWith('?'));
  if (at < 0) return { question: '', text: String(explanation ?? '').trim() };
  const question = lines[at].trim().replace(/^\?\s*/, '');
  lines.splice(at, 1);
  return { question, text: lines.join('\n').trim() };
}
