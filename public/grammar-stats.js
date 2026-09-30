// Auswertung für Grammatiklisten (Lehrkräfte): Kennzahlen je Gruppe, schwierige Regeln, häufigste Fehler mit
// Hinweis per Klick, Einzelansicht einer Schülerin / eines Schülers.
// Die Fehlerliste zeigt Anzahlen je Antwort ohne Namen; die Antworten einer Person stehen nur in ihrer Einzelansicht.

import { normalize } from './check.js';
import { langTag } from './exercises.js';
import { parseItem, segments } from './grammar.js';
import {
  LEVEL_NAMES, exportGroupsCsv, groupPanels, historyPanel, levelChip, pct, sortableTable, statTiles,
} from './stats-ui.js';
import { formatDate, h, toast, view } from './ui.js';

const loose = (s) => normalize(String(s), { caseSensitive: false, accentSensitive: false });
const KIND_LABELS = { gap: 'Lücke', choice: 'Auswählen', error: 'Fehler finden', order: 'Satzbau', translate: 'Übersetzen', transform: 'Umformen' };

// Aufgabe als Satz mit hervorgehobener Lösung (oder der Rohtext, wenn die Zeile nicht lesbar ist)
function taskNode(source, lang) {
  const parsed = parseItem(source ?? '');
  if (parsed.error) return h('span', { class: 'muted' }, source ?? '(Aufgabe gelöscht)');
  return h('span', { class: 'sentence-ex', lang },
    h('span', { class: 'chip' }, KIND_LABELS[parsed.type]), ' ',
    segments(parsed).map((s) => (s.mark ? h('b', { class: 'form' }, s.text) : s.text)));
}

// Gibt es schon einen Hinweis der Lehrkraft für genau diese Antwort?
function hasHint(source, answer) {
  const parsed = parseItem(source ?? '');
  if (parsed.error) return false;
  return parsed.feedback.some((fb) => fb.keys?.some((k) => loose(k) === loose(answer)));
}

export async function renderGrammarStats(ctx, stats, id) {
  const n = stats.rule_count;
  const lang = langTag(stats.list.lang_a);

  const groups = groupPanels(stats.groups, {
    listId: id,
    total: n,
    unit: { of: 'Regeln', many: 'Regeln', safeLabel: 'Ø sichere Regeln (%)', hint: 'Auf einen Namen klicken, um den Stand pro Regel und die Antworten der Person zu sehen.' },
  });
  const exportCsv = () => exportGroupsCsv(stats.list.title, stats.groups, n, 'Regeln');

  // Aus einem häufigen Fehler einen Hinweis machen: „! Antwort = Hinweis“ unter der Aufgabe
  async function addHint(error) {
    const text = prompt(`Hinweis für die Antwort „${error.answer}“ – er erscheint, wenn jemand genau das eingibt:`, '');
    if (!text?.trim()) return;
    try {
      await ctx.api('POST', `/lists/${id}/feedback`, { item_id: error.item_id, answer: error.answer, text });
      toast('Hinweis gespeichert.');
      renderGrammarStats(ctx, await ctx.api('GET', `/lists/${id}/stats`), id);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const errorRows = stats.errors.map((e) => {
    const cannot = /[|=]/.test(e.answer);
    return h('tr', {},
      h('td', {}, taskNode(e.source, lang), h('div', { class: 'small muted' }, e.rule_title)),
      h('td', {}, h('code', { lang }, e.answer)),
      h('td', {}, `${e.count} ×`),
      h('td', {}, hasHint(e.source, e.answer)
        ? h('span', { class: 'chip shared' }, 'Hinweis vorhanden')
        : h('button', { class: 'btn small', disabled: cannot, title: cannot ? 'Enthält „|“ oder „=“ – bitte im Editor eintragen.' : 'Hinweis für genau diese Antwort anlegen', onclick: () => addHint(e) }, 'Hinweis anlegen')));
  });

  view(
    h('div', { class: 'section-head' },
      h('h1', {}, `Auswertung: ${stats.list.title}`),
      h('div', { class: 'actions' },
        stats.groups.some((g) => g.students.length) ? h('button', { class: 'btn', onclick: exportCsv }, 'Als CSV exportieren') : null,
        h('a', { class: 'btn ghost', href: '#/' }, 'Zurück'))),
    h('p', { class: 'small muted' }, '„Sicher“ = würde die Regel laut Lernplanung auch in zwei Wochen noch mit 90 % Wahrscheinlichkeit beherrschen (mehrmals an verschiedenen Tagen richtig geübt). „Fällig“ = Regeln, die laut Plan jetzt wiederholt werden sollten. Es erscheinen nur Schüler:innen, die sich schon einmal angemeldet haben.'),
    groups.length ? groups : h('p', { class: 'empty' }, 'Die Liste ist keiner Gruppe zugewiesen.'),
    stats.errors.length
      ? h('section', { class: 'panel' },
          h('h2', {}, 'Häufigste Fehler'),
          h('p', { class: 'small muted' }, 'Falsche Antworten beim ersten Versuch, zusammengezählt über alle Schüler:innen (ohne Namen) – zeigt, welche Fehlvorstellung in der Klasse verbreitet ist. Mit „Hinweis anlegen“ bekommt genau diese Antwort künftig einen eigenen Hinweis.'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Aufgabe'), h('th', {}, 'Antwort'), h('th', {}, 'Anzahl'), h('th', {}, ''))),
            h('tbody', {}, errorRows))))
      : null,
    stats.hardest.length
      ? h('section', { class: 'panel' }, h('h2', {}, 'Schwierigste Regeln'),
          h('table', { class: 'stats' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Regel'), h('th', {}, 'Fehlerquote'))),
            h('tbody', {}, stats.hardest.map((r) => h('tr', {}, h('td', {}, r.title), h('td', {}, `${pct(r.wrong, r.right + r.wrong)} % (${r.wrong}×)`))))))
      : null,
  );
}

export async function renderGrammarStudent(ctx, data, listId) {
  const { list, student, rules, errors } = data;
  const n = rules.length;
  const lang = langTag(list.lang_a);
  const level = (r) => r.progress?.box ?? -1;
  const safe = rules.filter((r) => level(r) >= data.safe_box).length;
  const seen = rules.filter((r) => r.progress).length;
  const due = rules.filter((r) => r.progress?.due && new Date(r.progress.due) <= new Date()).length;
  const right = rules.reduce((sum, r) => sum + (r.progress?.right ?? 0), 0);
  const wrong = rules.reduce((sum, r) => sum + (r.progress?.wrong ?? 0), 0);

  const columns = [
    { label: 'Regel', value: (r) => r.title, render: (r) => r.title },
    { label: 'Stand', numeric: true, value: (r) => level(r), render: (r) => levelChip(r.progress) },
    { label: 'Richtig / Falsch', numeric: true, value: (r) => (r.progress?.wrong ?? 0) - (r.progress?.right ?? 0) / 100, render: (r) => (r.progress ? `${r.progress.right} / ${r.progress.wrong}` : '–') },
    { label: 'Zuletzt', numeric: true, value: (r) => (r.progress?.last_seen ? Date.parse(r.progress.last_seen) : null), render: (r) => formatDate(r.progress?.last_seen) },
  ];
  // Standard: schwächste Regeln zuerst
  const sorted = [...rules].sort((a, b) => level(a) - level(b) || (b.progress?.wrong ?? 0) - (a.progress?.wrong ?? 0));

  view(
    h('div', { class: 'section-head' },
      h('h1', {}, student.name),
      h('a', { class: 'btn ghost', href: `#/stats/${listId}` }, 'Zurück zur Auswertung')),
    h('p', { class: 'muted' }, list.title),
    h('section', { class: 'panel' },
      statTiles([
        ['Sicher', `${safe}`, `von ${n} Regeln`],
        ['Geübt', `${seen}`, `von ${n} Regeln`],
        ['Jetzt fällig', due, 'Regeln'],
        ['Richtig / Falsch', `${right} / ${wrong}`, 'Aufgaben'],
      ]),
      historyPanel(data.history, { safeLabel: 'Sichere Regeln (%)' })),
    h('section', { class: 'panel' },
      h('h2', {}, 'Regeln'),
      h('p', { class: 'small muted' }, `Schwächste Regeln zuerst. Stufen: ${LEVEL_NAMES.join(' → ')}. Spaltenköpfe sortieren.`),
      sortableTable(sorted, columns, { initial: null })),
    errors.length
      ? h('section', { class: 'panel' },
          h('h2', {}, 'Falsche Antworten'),
          h('p', { class: 'small muted' }, 'Die letzten falschen Antworten beim ersten Versuch. Nur in dieser Einzelansicht sichtbar.'),
          h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Aufgabe'), h('th', {}, 'Antwort'), h('th', {}, 'Nach Hinweis?'), h('th', {}, 'Wann'))),
            h('tbody', {}, errors.map((e) => h('tr', {},
              h('td', {}, taskNode(e.source, lang), h('div', { class: 'small muted' }, e.rule_title)),
              h('td', {}, h('code', { lang }, e.answer)),
              h('td', {}, e.grade === 'again' ? 'nein – auch dann falsch' : 'ja – danach richtig'),
              h('td', {}, formatDate(e.at))))))))
      : null,
  );
}
