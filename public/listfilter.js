// Geteilte Listen filtern und sortieren. Wird im Browser und in den Tests verwendet.

import { learnedLanguages } from './exercises.js';

export const GRADES = Array.from({ length: 13 }, (_, i) => i + 1);
export const gradeLabel = (grade) => (grade ? `Jahrgang ${grade}` : 'ohne Jahrgang');

// Fach einer Liste (Schlüssel wird gespeichert). Sprachen sind der Standard und gelten für alle älteren Listen;
// bei den anderen Fächern ist die Liste meist Deutsch ↔ Deutsch (Begriff ↔ Bedeutung).
export const DEFAULT_SUBJECT = 'sprachen';
export const SUBJECTS = {
  sprachen: 'Sprachen',
  biologie: 'Biologie',
  geschichte: 'Geschichte',
  erdkunde: 'Erdkunde',
  politik: 'Politik / Gesellschaft',
  religion: 'Religion / Ethik',
  chemie: 'Chemie',
  physik: 'Physik',
  mathematik: 'Mathematik',
  sonstiges: 'Sonstiges',
};
export const subjectLabel = (subject) => SUBJECTS[subject] ?? SUBJECTS[DEFAULT_SUBJECT];

const key = (s) => (s ?? '').trim().toLocaleLowerCase('de');

// Sprachen der Listen für die Auswahl, häufigste zuerst: [{ value, label }]. value ist die vereinheitlichte
// Schreibweise (zum Merken und Vergleichen), label die erste gefundene zum Anzeigen. Es zählt die gelernte
// Sprache (siehe learnedLanguages): Deutsch nur bei Listen für den Deutschunterricht und DaZ, nicht bei
// Englisch ↔ Deutsch.
export function languagesOf(lists) {
  const found = new Map();
  for (const list of lists) {
    const labels = new Map(learnedLanguages(list).map((l) => [key(l), l]));
    for (const [k, label] of labels) {
      if (!k) continue;
      const entry = found.get(k) ?? { value: k, label, n: 0 };
      entry.n++;
      found.set(k, entry);
    }
  }
  return [...found.values()]
    .sort((x, y) => y.n - x.n || x.label.localeCompare(y.label, 'de'))
    .map(({ value, label }) => ({ value, label }));
}

export const KINDS = { vocab: 'Vokabeln', grammar: 'Grammatik' };

// lang: gelernte Sprache, grade: Jahrgang als Zahl/Text, 'none' = ohne Angabe, '' = alle,
// kind: 'vocab' | 'grammar' | '' (alle), subject: Schlüssel aus SUBJECTS | '' (alle)
export function filterLists(lists, { q = '', lang = '', grade = '', kind = '', subject = '' } = {}) {
  const query = key(q);
  return lists.filter((l) =>
    (!kind || (l.kind ?? 'vocab') === kind)
    && (!subject || (l.subject || DEFAULT_SUBJECT) === subject)
    && (!lang || learnedLanguages(l).some((x) => key(x) === key(lang)))
    && (grade === '' || (grade === 'none' ? !l.grade : l.grade === Number(grade)))
    && (!query || [l.title, l.lang_a, l.lang_b, l.owner_name].some((t) => key(t).includes(query))));
}

export const SORTS = { recent: 'Zuletzt geändert', grade: 'Jahrgang', title: 'Titel' };

export function sortLists(lists, by = 'recent') {
  const byTitle = (x, y) => x.title.localeCompare(y.title, 'de', { numeric: true });
  const out = [...lists];
  if (by === 'title') return out.sort(byTitle);
  if (by === 'grade') return out.sort((x, y) => (x.grade ?? 99) - (y.grade ?? 99) || byTitle(x, y));
  return out.sort((x, y) => (y.updated_at ?? '').localeCompare(x.updated_at ?? ''));
}
