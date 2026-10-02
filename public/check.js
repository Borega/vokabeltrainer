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
// Die vollständige Form steht vorn (daran orientieren sich die Tipps). Ab MAX_OPTIONAL Klammern (2^8 = 256 Formen)
// gelten nur noch alle oder keine – so viele optionale Teile in einer Lösung sind kein sinnvoller Eintrag.
const MAX_OPTIONAL = 8;
// Klammern, die zur Formel gehören und nichts Weglassbares sind: mit Rechenzeichen darin "(a - b)", vor einem
// Rechenzeichen "(x) / 2", vor einer Hochzahl oder Zahl "(x)^2", "(x)⁴", "Ca(OH)2". Alle anderen Klammern sind optionale
// Zusätze ("(to)", "(irr)", "(sth.)"). In Formelfächern (options.literalParens) ist gar nichts optional.
const GROUPING_INSIDE = /[+*×÷=^<>±√−]|\s[-/]\s/;
const GROUPING_AFTER = /^(?:[\^\d¹²³⁰-⁹₀-₉]|\s*[+*×÷−^=<>]|\s+[-/]\s)/;
function optionalGroups(base, literal = false) {
  if (literal) return [];
  return [...base.matchAll(/\([^()]*\)/g)]
    .filter((m) => !GROUPING_INSIDE.test(m[0]) && !GROUPING_AFTER.test(base.slice(m.index + m[0].length)));
}

function optionalForms(base, literal) {
  const groups = optionalGroups(base, literal);
  if (!groups.length) return [base];
  const pick = (keep) => {
    let out = '';
    let last = 0;
    groups.forEach((m, i) => {
      out += base.slice(last, m.index) + (keep(i) ? m[0].slice(1, -1) : '');
      last = m.index + m[0].length;
    });
    return out + base.slice(last);
  };
  if (groups.length > MAX_OPTIONAL) return [pick(() => true), pick(() => false)];
  const forms = [];
  for (let mask = 2 ** groups.length - 1; mask >= 0; mask--) forms.push(pick((i) => (mask >> i) & 1));
  return forms;
}

// Englische Verben stehen im Wörterbuch mit "to": "to go". Ohne "to" ist es auch richtig – außer bei Richtungs- und
// Zielangaben, in denen "to" zur Antwort gehört: Artikel und Possessiva ("to the left"), Pronomen ("to you"),
// häufige Ziele ("to school", "to bed") und Eigennamen ("to Berlin", an der Großschreibung erkannt). Das ist eine
// Faustregel: Einem Eintrag sieht man nicht an, ob er ein Verb ist.
const NOT_INFINITIVE = new Set(`the a an my your his her its our their this that these those some any every each no
  me you him us them it myself yourself himself herself itself ourselves themselves one another
  school bed town home church class university college court prison hospital market city country station airport`
  .split(/\s+/));
function withoutTo(s) {
  const m = s.match(/^to\s+(\S+)/i);
  if (!m) return s;
  const word = m[1].replace(/[^\p{L}\p{N}'-]+$/u, '');
  if (NOT_INFINITIVE.has(word.toLowerCase()) || /^\p{Lu}/u.test(word)) return s;
  return s.slice(m[0].length - m[1].length);
}

// Alle akzeptierten Schreibweisen einer Lösung.
export function variants(solution, { literalParens = false } = {}) {
  const out = new Set();
  for (const alt of solution.split(/[;|]/)) {
    const base = alt.trim();
    if (!base) continue;
    for (const f of optionalForms(base, literalParens).map((x) => x.replace(/\s+/g, ' ').trim())) {
      out.add(f);
      out.add(withoutTo(f));
      for (const e of endingForms(f)) out.add(e);
    }
    // Die Lösung genau so, wie sie dasteht – etwa eine Formel "(a + b)^2"
    if (base.includes('(')) out.add(base);
  }
  return [...out].map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Wer die Klammern einer Lösung mitschreibt ("go (to school)"), meint dieselben Wörter: Dann fallen die Klammerzeichen
// weg. Hat die Lösung keine Klammern, zählt die Eingabe, wie sie ist ("2 * (3 + 4)" ist nicht "2 * 3 + 4").
const inputForms = (input, solution, literal) => (solution.split(/[;|]/).some((alt) => optionalGroups(alt, literal).length)
  ? [input, input.replace(/[()]/g, ' ')]
  : [input]);

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
  const matches = (o) => {
    const expected = variants(solution, options).map((v) => normalize(v, o));
    return inputForms(input, solution, options.literalParens).some((f) => expected.includes(normalize(f, o)));
  };
  if (options.accentSensitive !== false && matches({ ...options, accentSensitive: false })) return 'accents';
  if (options.caseSensitive && matches({ ...options, caseSensitive: false })) return 'case';
  return null;
}

// Ergebnis: 'correct' | 'almost' (kleiner Tippfehler, zählt als falsch) | 'wrong'
export function checkAnswer(input, solution, options = {}) {
  const results = inputForms(input, solution, options.literalParens).map((f) => checkForm(f, solution, options));
  return ['correct', 'almost'].find((r) => results.includes(r)) ?? 'wrong';
}

function checkForm(input, solution, options) {
  const given = normalize(input, options);
  if (!given) return 'wrong';
  const expected = variants(solution, options).map((v) => normalize(v, options));
  if (expected.includes(given)) return 'correct';
  // Nur Groß-/Kleinschreibung oder Akzente falsch? Dann „fast“.
  const loose = { caseSensitive: false, accentSensitive: false };
  const givenLoose = normalize(input, loose);
  const expectedLoose = variants(solution, options).map((v) => normalize(v, loose));
  for (const e of expectedLoose) {
    const allowed = e.length <= 6 ? 1 : 2;
    if (levenshtein(givenLoose, e) <= allowed) return 'almost';
  }
  return 'wrong';
}
