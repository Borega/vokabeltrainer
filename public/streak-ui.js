// Lernserie auf der Startseite: Wochenpunkte, Tagesziel, Serie. Und der Schalter pro Gruppe für Lehrkräfte.
// Ein Punkt pro erledigtem Tag (wie der Punkt im App-Symbol); keine Bestenliste, nichts, was andere sehen.

import { h, icon, progressBar } from './ui.js';

const MIN_CLASS = 5; // wie MIN_CLASS in src/api.js

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

// Die Nachsicht sichtbar machen: Ein verpasster Tag soll nicht wie das Ende der Serie wirken
const weekdayDate = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
function graceLine({ current, bridged }) {
  if (bridged) return `Am ${weekdayDate(bridged)} blieb etwas liegen – der Tag wurde überbrückt, deine Serie läuft weiter.`;
  if (current > 0) return 'Fehlt mal ein Tag, wird er überbrückt: einer pro Woche.';
  return null;
}

// Wochenrückblick, nur gegen sich selbst. Die letzte Woche steht nur daneben, wenn diese mindestens so gut ist –
// eine schwächere Woche wird nicht vorgerechnet.
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function reviewLine(review) {
  if (!review) return null;
  const { days, safeWords, safeRules, last } = review;
  if (!days && !safeWords && !safeRules) return null;
  const parts = [count(days, 'Lerntag', 'Lerntage')];
  if (safeWords) parts.push(`${count(safeWords, 'Wort', 'Wörter')} sicher dazu`);
  if (safeRules) parts.push(`${count(safeRules, 'Regel', 'Regeln')} sicher dazu`);
  const better = days >= last.days && safeWords >= last.safeWords && safeRules >= last.safeRules
    && (days > last.days || safeWords > last.safeWords || safeRules > last.safeRules);
  const lastParts = [count(last.days, 'Lerntag', 'Lerntage'), last.safeWords ? `${count(last.safeWords, 'Wort', 'Wörter')} sicher dazu` : null].filter(Boolean);
  return `Diese Woche: ${parts.join(', ')}.${better && last.days ? ` Letzte Woche: ${lastParts.join(', ')}.` : ''}`;
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
    graceLine(streak) ? h('p', { class: 'small muted grace' }, graceLine(streak)) : null,
    reviewLine(streak.review) ? h('p', { class: 'small week-review' }, reviewLine(streak.review)) : null,
    h('div', { class: 'streak-foot' },
      h('p', { class: 'small muted' },
        `Lerntage insgesamt: ${streak.total}`,
        streak.best > 1 ? ` · Beste Serie: ${tage(streak.best)}` : null),
      streak.badges
        ? h('a', { class: 'btn badges-link', href: '#/badges' }, icon('star'), `Abzeichen: ${streak.badges.earned} von ${streak.badges.total}`)
        : null),
  );
}

// Klassenziel: ein gemeinsamer Balken pro Gruppe, ohne Namen und ohne Reihenfolge
export function classGoalPanel(goals) {
  return h('section', { class: 'panel class-goal' },
    h('h2', {}, 'Klassenziel'),
    goals.map((g) => h('div', { class: 'progress' },
      progressBar(Math.min(g.safe, g.goal), g.goal, `Klassenziel ${g.group}`),
      h('span', { class: 'small' }, g.safe >= g.goal
        ? `${g.group} hat das Ziel erreicht: ${g.safe} Wörter sicher.`
        : `${g.group}: ${g.safe} von ${g.goal} Wörtern sicher – jedes Wort, das bei dir sitzt, zählt mit.`))));
}

// Lehrkräfte: Klassenziel pro Gruppe. saveGoal(group, goal|null) speichert (wirft bei Fehlern).
function goalField(g, saveGoal) {
  const input = h('input', {
    type: 'number', min: '1', max: '1000000', step: '1', inputmode: 'numeric', value: g.classGoal ?? '',
    placeholder: 'kein Ziel', 'aria-label': `Klassenziel ${g.name} (sichere Wörter)`,
    onchange: async () => {
      const goal = input.value.trim() ? Number(input.value) : null;
      input.disabled = true;
      try {
        await saveGoal(g, goal);
      } catch {
        input.value = g.classGoal ?? '';
      } finally {
        input.disabled = false;
      }
    },
  });
  const status = g.classSize < MIN_CLASS
    ? `sichtbar ab ${MIN_CLASS} Schüler:innen (jetzt ${g.classSize})`
    : `bisher ${g.classSafe} Wörter sicher`;
  return h('label', { class: 'goal-field small' }, 'Klassenziel', input, h('span', { class: 'muted' }, status));
}

// Lehrkräfte: Lernserie pro Gruppe ein- oder ausschalten. save(group, enabled) speichert (wirft bei Fehlern).
export function groupSwitches(groups, save, saveGoal) {
  return h('section', { class: 'panel' },
    h('h2', {}, 'Lernserie und Abzeichen'),
    h('p', { class: 'small muted' }, 'Schüler:innen sehen ihre Wochenpunkte, ihre Serie und ihre Abzeichen. Tagesziel: alles erledigen, was fällig ist. Abzeichen gibt es fürs Können, etwa für Wörter, die auch nach Wochen sitzen. Beides gibt es für die angehakten Gruppen.'),
    h('p', { class: 'small muted' }, 'Klassenziel: Wie viele Wörter will die Gruppe gemeinsam sicher können? Alle sehen einen gemeinsamen Balken, ohne Namen und ohne Rangliste.'),
    h('div', { class: 'group-list' }, groups.map((g) => h('div', { class: 'group-row' }, h('label', { class: 'check' },
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
      g.name), goalField(g, saveGoal)))));
}
