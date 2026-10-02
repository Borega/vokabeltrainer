// Prüft eingetippte Antworten. Wird im Browser und in den Tests verwendet.
//
// Regeln:
//  - Alternativen in der Lösung mit ";" oder "|" trennen: "big; large"
//  - Teile in Klammern sind optional: "(to) go" akzeptiert "go" und "to go"; wer sie samt Klammern mitschreibt,
//    hat auch recht. Bei mehreren Klammern gilt jede Auswahl: "(to) buy (sth.)" → buy, to buy sth. …
//  - Englische Verben gelten auch ohne "to": "to go" akzeptiert "go" (nicht aber "to the left" → "the left")
//  - Endungen für die weibliche Form: "bueno/a", "trabajador, -a", "heureux, -euse" akzeptieren
//    die Grundform und die abgeleitete Form (buena, trabajadora, heureuse)
//  - Leerzeichen und Satzzeichen am Ende (. ! ? …) zählen nie, die spanischen ¿ und ¡ nirgends
//  - Groß-/Kleinschreibung und Akzente (é, ü, ß …) je nach Listeneinstellung

export function normalize(s, { caseSensitive = false, accentSensitive = true } = {}) {
  let t = s.normalize('NFC').replace(/[’`´]/g, "'").replace(/[¿¡]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/[.!?…]+$/, '').trim();
  if (!caseSensitive) t = t.toLocaleLowerCase('de');
  if (!accentSensitive) {
    t = t
      .replace(/ß/g, 'ss')
      .replace(/ẞ/g, 'SS')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .normalize('NFC');
  }
  return t;
}

// Grundbuchstabe ohne Akzent (é → e), zum Vergleichen von Endungen
const bare = (ch) => ch.normalize('NFD')[0].toLowerCase();

// Weibliche Form aus Grundform und Endung: bueno + a → buena, trabajador + a → trabajadora,
// heureux + euse → heureuse, actif + ive → active. Die Endung ersetzt ab dem letzten passenden Buchstaben.
// Spanisch: Betonte Endsilben verlieren den Akzent, wenn eine Silbe dazukommt (alemán → alemana, inglés → inglesa).
export function withEnding(base, ending) {
  if (ending.length === 1) {
    if (bare(base.at(-1)) === ending) return base;
    if (/[oe]$/i.test(base) && ending === 'a') return base.slice(0, -1) + ending;
    return unstress(base) + ending;
  }
  const chars = [...base];
  for (let i = chars.length - 1; i > 0; i--) {
    if (bare(chars[i]) === bare(ending[0])) return chars.slice(0, i).join('') + ending;
  }
  return base + ending;
}

// alemán → aleman, inglés → ingles (nur ein akzentuierter Vokal vor n/s am Wortende)
function unstress(word) {
  return word.replace(/([áéíóú])([ns])$/iu, (_, vowel, end) => vowel.normalize('NFD')[0] + end);
}

// "bueno/a", "bueno/-a", "trabajador, -a" → ["bueno", "buena"] (sonst leer)
const ENDING = /^(.*\p{L})\s*(?:\/-?|,\s*-)(\p{Ll}{1,5})$/u;
export function endingForms(text) {
  const m = text.match(ENDING);
  return m ? [m[1], withEnding(m[1], m[2])] : [];
}

// Jede Auswahl der optionalen Teile in Klammern: "(to) buy (sth.)" → to buy sth., to buy, buy sth., buy.
// Die vollständige Form steht vorn (daran orientieren sich die Tipps). Ab MAX_OPTIONAL Klammern nur alle oder keine.
const MAX_OPTIONAL = 4;
function optionalForms(base) {
  const groups = base.match(/\([^()]*\)/g) ?? [];
  if (!groups.length) return [base];
  const parts = base.split(/\([^()]*\)/);
  const pick = (keep) => parts.reduce((s, part, i) => s + part + (i < groups.length && keep(i) ? groups[i].slice(1, -1) : ''), '');
  if (groups.length > MAX_OPTIONAL) return [pick(() => true), pick(() => false)];
  const forms = [];
  for (let mask = 2 ** groups.length - 1; mask >= 0; mask--) forms.push(pick((i) => (mask >> i) & 1));
  return forms;
}

// Englische Verben stehen im Wörterbuch mit "to": "to go". Ohne "to" ist es auch richtig – außer bei
// Richtungsangaben wie "to the left", "to my right".
const INFINITIVE_TO = /^to\s+(?!(?:the|a|an|my|your|his|her|its|our|their|this|that|these|those|me|him|us|them)\b)(?=\S)/i;
const withoutTo = (s) => s.replace(INFINITIVE_TO, '');

// Alle akzeptierten Schreibweisen einer Lösung.
export function variants(solution) {
  const out = new Set();
  for (const alt of solution.split(/[;|]/)) {
    const base = alt.trim();
    if (!base) continue;
    for (const f of optionalForms(base).map((x) => x.replace(/\s+/g, ' ').trim())) {
      out.add(f);
      out.add(withoutTo(f));
      for (const e of endingForms(f)) out.add(e);
    }
  }
  return [...out].map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Wer die Klammern der Lösung mitschreibt ("go (to school)"), meint dieselben Wörter: Klammerzeichen fallen weg.
const unbracket = (s) => s.replace(/[()]/g, ' ');

export function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Warum „fast“? 'accents' (nur Akzente falsch), 'case' (nur Groß-/Kleinschreibung) oder null (Tippfehler)
export function almostReason(input, solution, options = {}) {
  const matches = (o) => variants(solution).map((v) => normalize(v, o)).includes(normalize(unbracket(input), o));
  if (options.accentSensitive !== false && matches({ ...options, accentSensitive: false })) return 'accents';
  if (options.caseSensitive && matches({ ...options, caseSensitive: false })) return 'case';
  return null;
}

// Ergebnis: 'correct' | 'almost' (kleiner Tippfehler, zählt als falsch) | 'wrong'
export function checkAnswer(input, solution, options = {}) {
  input = unbracket(input);
  const given = normalize(input, options);
  if (!given) return 'wrong';
  const expected = variants(solution).map((v) => normalize(v, options));
  if (expected.includes(given)) return 'correct';
  // Nur Groß-/Kleinschreibung oder Akzente falsch? Dann „fast“.
  const loose = { caseSensitive: false, accentSensitive: false };
  const givenLoose = normalize(input, loose);
  const expectedLoose = variants(solution).map((v) => normalize(v, loose));
  for (const e of expectedLoose) {
    const allowed = e.length <= 6 ? 1 : 2;
    if (levenshtein(givenLoose, e) <= allowed) return 'almost';
  }
  return 'wrong';
}
