// Übungsarten und ihre Bausteine. Wird im Browser und in den Tests verwendet.
//
// Lernleiter (Listenmodus „auto“): Die Aufgabe wird schwerer, je sicherer ein Wort sitzt.
//  - neu:            Wort kennenlernen, dann aus vier Antworten auswählen (Wiedererkennen)
//  - Stufe 1:        eintippen, Tipps auf Wunsch (erster Buchstabe, dann mehr)
//  - ab Stufe 2:     eintippen, teils im Beispielsatz (Lückentext) oder nach Gehör
// Leitidee: Aufgaben, die gerade noch lösbar sind, bringen am meisten (desirable difficulties,
// Bjork 1994); Wiedererkennen vor Selbst-Hervorbringen (Webb 2009, Nakata 2011).

import { endingForms, normalize, variants } from './check.js';

// Stufe, ab der Lückentexte und Hörübungen vorkommen (Stabilität ≥ 3 Tage, siehe scheduler.js)
export const ADVANCED_LEVEL = 2;

// Welche Übung kommt für diese Karte?
//  mode:      Listenmodus (auto | flip | type | choice)
//  level:     Stufe 0–5 in dieser Richtung, 0 = noch nie abgefragt
//  knownOther: in der Gegenrichtung schon gelernt (dann ist die Einführung überflüssig)
//  choiceOk / clozeOk / listenOk: ob die Übung für dieses Wort möglich ist
export function pickExercise({ mode, level = 0, knownOther = false, choiceOk, clozeOk, listenOk, random = Math.random }) {
  if (mode === 'flip') return 'flip';
  if (mode === 'type') return 'type';
  if (mode === 'choice') return choiceOk ? 'choice' : 'flip';
  // Lernleiter
  if (level === 0) {
    if (knownOther) return choiceOk ? 'choice' : 'type';
    return 'intro';
  }
  if (level >= ADVANCED_LEVEL) {
    const r = random();
    if (clozeOk && listenOk) return r < 0.4 ? 'cloze' : r < 0.7 ? 'listen' : 'type';
    if (clozeOk) return r < 0.5 ? 'cloze' : 'type';
    if (listenOk) return r < 0.35 ? 'listen' : 'type';
  }
  return 'type';
}

// Nach der Einführung eines neuen Worts folgt die erste Abfrage: Auswählen, wenn möglich.
export function afterIntro(choiceOk) {
  return choiceOk ? 'choice' : 'type';
}

// Bewertung für die Wiederholungsplanung.
//  Auswählen ist nur Wiedererkennen: richtig zählt als „hard“, damit „sicher“ weiterhin bedeutet,
//  dass das Wort selbst hervorgebracht werden kann.
//  Eintippen mit Tipp zählt ebenfalls als „hard“ (gewusst, aber mit Hilfe).
export function gradeFor(exercise, { correct, almost = false, hints = 0 }) {
  if (exercise === 'choice') return correct ? 'hard' : 'again';
  if (correct) return hints ? 'hard' : 'good';
  return almost ? 'hard' : 'again';
}

// ---------- Auswählen (Multiple Choice) ----------

const firstToken = (s) => s.trim().split(/\s+/)[0].toLowerCase();
// Signalwörter, die eine Wortart verraten: to go, the dog, der Hund, le chien, el perro …
const MARKERS = new Set([
  'to', 'the', 'a', 'an', 'der', 'die', 'das', 'ein', 'eine', 'sich',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'se', // Französisch
  'el', 'los', 'las', 'unos', 'unas', // Spanisch (la, un, una, se wie oben)
  'il', 'lo', 'gli', 'uno', // Italienisch
]);

// Signalwort am Anfang; französische Elision zählt als eigenes: l'arbre → "l'", s'appeler → "s'"
function markerOf(text) {
  const tok = firstToken(text).replace(/’/g, "'");
  const elided = tok.match(/^(l|d|s|qu|j|m|t|n)'/);
  if (elided) return `${elided[1]}'`;
  return MARKERS.has(tok) ? tok : '';
}

function shape(s) {
  const t = s.trim();
  return {
    len: t.length,
    words: t.split(/\s+/).length,
    marker: markerOf(t),
    upper: /^\p{Lu}/u.test(t),
  };
}

// Ähnlichkeit zweier Antworten im Aussehen – je kleiner, desto verwechselbarer.
// Plausible Ablenker machen Auswählen zu echtem Abrufen (Little et al. 2012).
function distance(x, y) {
  const a = shape(x), b = shape(y);
  return Math.abs(a.len - b.len) / Math.max(a.len, b.len, 1) * 3
    + Math.abs(a.words - b.words)
    + (a.marker === b.marker ? 0 : 2)
    + (a.upper === b.upper ? 0 : 1);
}

// Antwortmöglichkeiten: die richtige und bis zu count-1 Ablenker aus derselben Liste.
// words: alle Wörter der Liste, word: das abgefragte, side: 'a' | 'b' (Antwortseite)
// Ergebnis: { options: string[], correct: number } oder null, wenn es zu wenige Ablenker gibt.
export function choiceOptions(words, word, side, { count = 4, random = Math.random } = {}) {
  const answer = word[side];
  const key = (s) => normalize(s, { caseSensitive: false, accentSensitive: false });
  const taken = new Set([key(answer), ...variants(answer).map(key)]);
  const pool = [];
  for (const w of words) {
    if (w.id === word.id) continue;
    const text = w[side];
    const k = key(text);
    if (!k || taken.has(k) || variants(text).some((v) => taken.has(key(v)))) continue;
    taken.add(k);
    pool.push({ text, score: distance(answer, text) + random() * 1.5 });
  }
  if (pool.length < 1) return null;
  pool.sort((x, y) => x.score - y.score);
  const options = [answer, ...pool.slice(0, count - 1).map((p) => p.text)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, correct: options.indexOf(answer) };
}

// ---------- Tipps beim Eintippen ----------

const LETTER = /[\p{L}\p{N}]/u;

// Die Lösung, an der sich die Tipps orientieren: die erste Variante („big; large“ → „big“).
export function hintTarget(solution) {
  return variants(solution)[0] ?? solution.trim();
}

// Lösungsmuster mit den ersten n Buchstaben jedes Worts: hintPattern('to go', 1) → 't _   g _'
export function hintPattern(text, revealed) {
  return text.trim().split(/\s+/).map((word) => {
    let i = 0;
    return [...word].map((ch) => (LETTER.test(ch) ? (i++ < revealed ? ch : '_') : ch)).join(' ');
  }).join('   ');
}

// Wie viele Tipps es gibt: bis auf den letzten Buchstaben des längsten Worts.
export function maxHints(text) {
  const longest = Math.max(0, ...text.trim().split(/\s+/).map((w) => [...w].filter((c) => LETTER.test(c)).length));
  return Math.max(1, longest - 1);
}

// ---------- Lückentext ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lücke, die die Lehrkraft mit *Sternchen* markiert hat – etwa für gebeugte Formen:
// „Yesterday I *went* home.“
function markedGap(example) {
  const m = example.match(/^(.*?)\*([^*]+)\*(.*)$/s);
  return m ? { before: plainExample(m[1]), gap: m[2].trim(), after: plainExample(m[3]) } : null;
}

// Sonst wird die Lösung (eine ihrer Varianten, die längste zuerst) als ganzes Wort im Satz gesucht.
function foundGap(example, solution) {
  for (const c of variants(solution).sort((x, y) => y.length - x.length)) {
    const m = example.match(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(c)}(?![\\p{L}\\p{N}])`, 'iu'));
    if (m) return { before: example.slice(0, m.index), gap: m[0], after: example.slice(m.index + m[0].length) };
  }
  return null;
}

const loose = (s) => normalize(s, { caseSensitive: false, accentSensitive: false });

// Zu welcher Seite ('a' | 'b') gehört der Beispielsatz? Enthält er das Wort einer Seite, ist es diese.
// Bei einer markierten Lücke, die keiner Seite wörtlich entspricht (went ↔ (to) go), ist es die
// gelernte Sprache (siehe learnSide).
export function exampleSide(word, { langA, langB, learn } = {}) {
  const example = word.example?.trim();
  if (!example) return null;
  const marked = markedGap(example);
  if (!marked) return foundGap(example, word.a) ? 'a' : foundGap(example, word.b) ? 'b' : null;
  for (const side of ['a', 'b']) {
    if (variants(word[side]).some((v) => loose(v) === loose(marked.gap))) return side;
  }
  return learnSide({ lang_a: langA, lang_b: langB, learn_side: learn });
}

// Lückentext für die Antwortseite side: { before, gap, after } oder null.
// Die Lösung ist dann die Lücke (bei markierten Lücken ggf. eine gebeugte Form).
export function clozeFor(word, side, langs) {
  if (exampleSide(word, langs) !== side) return null;
  const example = word.example.trim();
  return markedGap(example) ?? foundGap(example, word[side]);
}

// ---------- Editor: Lücken markieren ----------

// Lücke für ein Wort der Liste im Beispielsatz markieren: „The dog barks.“ + „the dog“ → „The *dog* barks.“
// null, wenn schon markiert oder das Wort (bzw. eine seiner Varianten) nicht im Satz vorkommt.
export function markGap(example, word) {
  if (!example?.trim() || /\*[^*]+\*/.test(example) || !word?.trim()) return null;
  // Artikel nur als eigenes Wort („the dog“, nicht „today“) bzw. mit Apostroph („l'eau“)
  const withoutArticle = (v) => v.replace(/^(?:(?:the|to|a|an|le|la|les|un|une|el|los|las|il|lo|der|die|das)\s+|l['’])/i, '');
  const byLength = (list) => [...new Set(list)].filter(Boolean).sort((x, y) => y.length - x.length);
  const all = variants(word);
  // Erst ohne Artikel suchen – der Artikel bleibt im Satz als Hilfe stehen –, dann die vollständige Form
  for (const candidate of [...byLength(all.map(withoutArticle)), ...byLength(all)]) {
    const gap = foundGap(example, candidate);
    if (gap) return `${gap.before}*${gap.gap}*${gap.after}`;
  }
  return null;
}

// Wird aus dem Beispielsatz ein Lückentext? false, wenn weder markiert noch ein Wort der Zeile darin zu finden ist.
export function gapProblem(word) {
  const example = word.example?.trim();
  if (!example || /\*[^*]+\*/.test(example)) return false;
  return !foundGap(example, word.a) && !foundGap(example, word.b);
}

// Sonderzeichen je Sprache für die Leiste im Editor (nach Sprachkennung, siehe langTag)
const EDITOR_CHARS = {
  fr: 'é è ê ë à â æ ç î ï ô œ ù û ü ÿ « »',
  es: 'á é í ó ú ü ñ ¿ ¡',
  it: 'à è é ì í ò ó ù',
  pt: 'á â ã à ç é ê í ó ô õ ú',
  la: 'ā ē ī ō ū ȳ',
  pl: 'ą ć ę ł ń ó ś ź ż',
  tr: 'ç ğ ı İ ö ş ü',
  nl: 'é ë ï ó ö',
};
export function editorChars(tag) {
  return EDITOR_CHARS[(tag ?? '').split('-')[0]]?.split(' ') ?? [];
}

// Beispielsatz ohne Markierungen
export function plainExample(example) {
  return (example ?? '').replace(/\*/g, '');
}

// ---------- Aussprache ----------

// Text zum Vorlesen: Varianten nacheinander, Klammern weg („(to) go; walk“ → „to go, walk“),
// Endungen ausgeschrieben („bueno/a“ → „bueno, buena“)
export function speechText(solution) {
  return solution
    .split(/[;|]/)
    .map((s) => s.replace(/[()*]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((s) => endingForms(s).join(', ') || s)
    .join(', ');
}

// ---------- Sonderzeichen ----------

// Zeichen, die auf einer deutschen Tastatur fehlen oder umständlich sind
const EASY = /[\p{N}\s.,;:!?'"()\-\/*+&%$§=_<>[\]{}@#~|\\a-zA-ZäöüÄÖÜß]/u;

// Sonderzeichen der Antworten einer Liste (Seite side) für die Leiste unter dem Eingabefeld – Buchstaben sowie
// ¿ und ¡, die in den Wörtern tatsächlich vorkommen (z. B. é, ç, œ für Französisch; á, ñ, ¿ für Spanisch).
// Satzzeichen am Ende (. ! ? und Auslassungspunkte) braucht es nicht: Die Prüfung ignoriert sie.
export function specialChars(words, side) {
  const found = new Set();
  for (const w of words) {
    for (const ch of (w[side] ?? '').normalize('NFC')) {
      if (!EASY.test(ch) && /[\p{L}¿¡]/u.test(ch)) found.add(ch);
    }
  }
  const rank = (ch) => (/[¿¡]/.test(ch) ? 2 : /\p{Lu}/u.test(ch) ? 1 : 0);
  return [...found].sort((x, y) => rank(x) - rank(y) || x.localeCompare(y, 'fr'));
}

// ---------- Sprachen ----------

export const isGermanLabel = (label) => speechLang(label)?.startsWith('de') ?? false;

// Gleiche Sprache auf beiden Seiten (Deutsch ↔ Deutsch: Begriff ↔ Bedeutung)?
export function sameLanguage({ lang_a: a, lang_b: b } = {}) {
  if (!a?.trim() || !b?.trim()) return false;
  const tagA = langTag(a);
  return tagA ? tagA === langTag(b) : a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Welche Seite einer Vokabelliste ist die Sprache, die gelernt wird? Die Lehrkraft stellt es ein (learn_side,
// z. B. Deutsch bei DaZ: Deutsch ↔ Türkisch). Ältere Listen haben keine Angabe: dann die nicht deutsche Seite,
// im Zweifel Seite A. Grammatiklisten haben nur Seite A.
export function learnSide({ lang_a, lang_b, learn_side } = {}) {
  if (learn_side === 'a' || learn_side === 'b') return learn_side;
  return isGermanLabel(lang_a) && !isGermanLabel(lang_b) ? 'b' : 'a';
}

// Die gelernte(n) Sprache(n) einer Liste – zum Filtern geteilter Listen. Bei zwei verschiedenen Sprachen nur die
// gelernte Seite, bei Grammatik und Deutsch ↔ Deutsch die eine Sprache.
export function learnedLanguages(list) {
  const labels = [list.lang_a, list.lang_b].map((l) => (l ?? '').trim()).filter(Boolean);
  if (labels.length < 2 || sameLanguage(list)) return labels.slice(0, 1);
  return [(learnSide(list) === 'b' ? list.lang_b : list.lang_a).trim()];
}

const LANG_CODES = [
  [/^(englisch|english|en)\b.*\b(usa?|amerik|american)/, 'en-US'],
  [/^(englisch|english)/, 'en-GB'],
  [/^(deutsch|german)/, 'de-DE'],
  // Französisch aus Frankreich und Spanisch aus Spanien – so wie im Unterricht
  [/^(französisch|franzoesisch|french|français)/, 'fr-FR'],
  [/^(spanisch|spanish|español)/, 'es-ES'],
  [/^(italienisch|italian)/, 'it-IT'],
  [/^(portugiesisch|portuguese)/, 'pt-PT'],
  [/^(niederländisch|niederlaendisch|holländisch|dutch)/, 'nl-NL'],
  [/^(russisch|russian)/, 'ru-RU'],
  [/^(polnisch|polish)/, 'pl-PL'],
  [/^(türkisch|tuerkisch|turkish)/, 'tr-TR'],
  [/^(chinesisch|chinese)/, 'zh-CN'],
  [/^(japanisch|japanese)/, 'ja-JP'],
  [/^(schwedisch|swedish)/, 'sv-SE'],
  [/^(dänisch|daenisch|danish)/, 'da-DK'],
  [/^(norwegisch|norwegian)/, 'nb-NO'],
  [/^(ukrainisch|ukrainian)/, 'uk-UA'],
  [/^(arabisch|arabic)/, 'ar'],
  [/^(persisch|farsi|persian)/, 'fa-IR'],
  [/^(rumänisch|rumaenisch|romanian)/, 'ro-RO'],
  [/^(bulgarisch|bulgarian)/, 'bg-BG'],
  [/^(albanisch|albanian)/, 'sq-AL'],
  [/^(kroatisch|croatian)/, 'hr-HR'],
  [/^(serbisch|serbian)/, 'sr-RS'],
  [/^(neugriechisch|griechisch|greek)/, 'el-GR'],
];

// Sprachkennung (BCP 47) für lang-Attribute (Screenreader, Rechtschreibung) – unabhängig davon, ob es eine
// Stimme gibt: Latein und Altgriechisch werden nicht vorgelesen, sind aber trotzdem ausgezeichnet.
const LANG_TAGS = [[/^(latein|latin)/, 'la'], [/^altgriech/, 'grc'], [/^(kurdisch|kurdish)/, 'ku']];
export function langTag(label) {
  const lower = (label ?? '').trim().toLowerCase();
  return LANG_TAGS.find(([re]) => re.test(lower))?.[1] ?? speechLang(label);
}

// Sprachcode für die Sprachausgabe aus der Sprachbezeichnung der Liste. Latein und Altgriechisch
// haben keine Stimme und bekommen null. Ein Code wie „en-US“ wird direkt übernommen.
export function speechLang(label) {
  const t = (label ?? '').trim();
  if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(t)) {
    // Auch als Code immer europäisches Französisch und Spanisch
    if (/^fr\b/.test(t)) return 'fr-FR';
    if (/^es\b/.test(t)) return 'es-ES';
    return t;
  }
  const lower = t.toLowerCase();
  if (/^(latein|latin|altgriechisch)/.test(lower)) return null;
  return LANG_CODES.find(([re]) => re.test(lower))?.[1] ?? null;
}
