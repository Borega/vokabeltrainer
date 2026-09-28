// Prüft eingetippte Antworten. Wird im Browser und in den Tests verwendet.
//
// Regeln:
//  - Alternativen in der Lösung mit ";" oder "|" trennen: "big; large"
//  - Teile in Klammern sind optional: "(to) go" akzeptiert "go" und "to go"
//  - Leerzeichen und Satzzeichen am Ende (. ! ?) zählen nie
//  - Groß-/Kleinschreibung und Akzente (é, ü, ß …) je nach Listeneinstellung

export function normalize(s, { caseSensitive = false, accentSensitive = true } = {}) {
  let t = s.normalize('NFC').replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();
  t = t.replace(/[.!?]+$/, '').trim();
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

// Alle akzeptierten Schreibweisen einer Lösung.
export function variants(solution) {
  const out = new Set();
  for (const alt of solution.split(/[;|]/)) {
    const base = alt.trim();
    if (!base) continue;
    if (!/\(.*?\)/.test(base)) {
      out.add(base);
      continue;
    }
    out.add(base.replace(/[()]/g, ''));
    out.add(base.replace(/\s*\([^)]*\)\s*/g, ' '));
  }
  return [...out].map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

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

// Ergebnis: 'correct' | 'almost' (kleiner Tippfehler, zählt als falsch) | 'wrong'
export function checkAnswer(input, solution, options = {}) {
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
