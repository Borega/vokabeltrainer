// Lernserie auf der Startseite: Wochenpunkte, Tagesziel, Serie. Und der Schalter pro Gruppe für Lehrkräfte.
// Ein Punkt pro erledigtem Tag (wie der Punkt im App-Symbol); keine Bestenliste, nichts, was andere sehen.

import { h } from './ui.js';

const DAYS = [['Mo', 'Montag'], ['Di', 'Dienstag'], ['Mi', 'Mittwoch'], ['Do', 'Donnerstag'], ['Fr', 'Freitag'], ['Sa', 'Samstag'], ['So', 'Sonntag']];
const tage = (n) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;

// Was heute ansteht, in einem Satz
function todayLine({ today, goal }) {
  if (today.done) return 'Heute geschafft.';
  if (today.remaining === 0) return 'Heute ist nichts fällig. Dein Tag zählt als frei.';
  // Obergrenze: Was schon beantwortet ist, zählt von den 25 ab
  const toGoal = Math.max(0, goal - today.answers);
  if (today.remaining > toGoal) return `Heute ist viel fällig – noch ${toGoal} ${toGoal === 1 ? 'Antwort genügt' : 'Antworten genügen'} für dein Tagesziel.`;
  return `Heute noch offen: ${today.remaining} fällig.`;
}

// Text nach einer Übertragung, die das Tagesziel erreicht hat
export function reachedText(streak) {
  return streak.current > 1 ? `Tagesziel erreicht – ${tage(streak.current)} in Folge.` : 'Tagesziel erreicht.';
}

export function streakPanel(streak) {
  const dots = streak.week.map((d, i) => h('li', {
    class: `day${d.done ? ' done' : ''}${d.today ? ' today' : ''}${d.future ? ' future' : ''}`,
    'aria-label': `${DAYS[i][1]}: ${d.done ? 'Tagesziel erreicht' : d.today ? 'heute' : d.future ? 'kommt noch' : 'kein Lerntag'}`,
  }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'label', 'aria-hidden': 'true' }, DAYS[i][0])));
  return h('section', { class: 'panel streak' },
    h('div', { class: 'streak-head' },
      h('h2', {}, streak.current > 1 ? `${tage(streak.current)} in Folge` : 'Lernserie'),
      h('p', { class: 'small muted' }, todayLine(streak))),
    h('ol', { class: 'week', 'aria-label': 'Diese Woche' }, dots),
    h('p', { class: 'small muted' },
      `Lerntage insgesamt: ${streak.total}`,
      streak.best > 1 ? ` · Beste Serie: ${tage(streak.best)}` : null),
  );
}

// Lehrkräfte: Lernserie pro Gruppe ein- oder ausschalten. save(group, enabled) speichert (wirft bei Fehlern).
export function groupSwitches(groups, save) {
  return h('section', { class: 'panel' },
    h('h2', {}, 'Lernserie'),
    h('p', { class: 'small muted' }, 'Schüler:innen sehen ihre Wochenpunkte und ihre Serie. Tagesziel: alles erledigen, was fällig ist. Die Lernserie gibt es für die angehakten Gruppen.'),
    h('div', { class: 'group-list' }, groups.map((g) => h('label', { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: g.gamification,
        onchange: async (e) => {
          const box = e.target;
          box.disabled = true;
          try {
            await save(g, box.checked);
          } catch {
            box.checked = !box.checked;
          } finally {
            box.disabled = false;
          }
        },
      }),
      g.name))));
}
