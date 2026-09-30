// Geteilte Listen filtern und sortieren. Wird im Browser und in den Tests verwendet.

export const GRADES = Array.from({ length: 13 }, (_, i) => i + 1);
export const gradeLabel = (grade) => (grade ? `Jahrgang ${grade}` : 'ohne Jahrgang');

const key = (s) => (s ?? '').trim().toLocaleLowerCase('de');

// Sprachen der Listen für die Auswahl, häufigste zuerst: [{ value, label }]. value ist die vereinheitlichte
// Schreibweise (zum Merken und Vergleichen), label die erste gefundene zum Anzeigen. Jede Liste zählt pro Sprache
// einmal. Deutsch fehlt – fast jede Liste hat eine deutsche Seite.
export function languagesOf(lists) {
  const found = new Map();
  for (const list of lists) {
    const labels = new Map();
    for (const l of [list.lang_a, list.lang_b]) if (!labels.has(key(l))) labels.set(key(l), (l ?? '').trim());
    for (const [k, label] of labels) {
      if (!k || k === 'deutsch' || k === 'german') continue;
      const entry = found.get(k) ?? { value: k, label, n: 0 };
      entry.n++;
      found.set(k, entry);
    }
  }
  return [...found.values()]
    .sort((x, y) => y.n - x.n || x.label.localeCompare(y.label, 'de'))
    .map(({ value, label }) => ({ value, label }));
}

// lang: Sprache (auf einer der beiden Seiten), grade: Jahrgang als Zahl/Text, 'none' = ohne Angabe, '' = alle
export function filterLists(lists, { q = '', lang = '', grade = '' } = {}) {
  const query = key(q);
  return lists.filter((l) =>
    (!lang || [l.lang_a, l.lang_b].some((x) => key(x) === key(lang)))
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
