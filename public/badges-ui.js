// Abzeichen: die Sammlung und der Hinweis, wenn eines dazukommt.
// Ruhig gehalten: kein Dialog, kein Konfetti; Fortschritt zeigt, was als Nächstes sitzen muss.

import { h, icon, progressBar } from './ui.js';

const ICON_FOR = {
  woerter: 'book', regel: 'check', regeln: 'check', liste: 'star', lerntage: 'calendar', langzeit: 'clock', fehler: 'check', beide: 'swap',
};
const iconOf = (id) => ICON_FOR[id.split('-')[0]] ?? 'star';

// Text für den Hinweis nach einer Übertragung; badges: [{ id, title }] aus der Antwort des Servers
export function badgeText(badges) {
  if (!badges?.length) return '';
  return badges.length === 1
    ? `Neues Abzeichen: ${badges[0].title}.`
    : `${badges.length} neue Abzeichen: ${badges.map((b) => b.title).join(', ')}.`;
}

function card(b) {
  const earned = !!b.earned_at;
  return h('li', { class: `badge${earned ? ' earned' : ''}${b.hidden && !earned ? ' secret' : ''}` },
    h('span', { class: 'medal', 'aria-hidden': 'true' }, icon(b.hidden && !earned ? 'star' : iconOf(b.id))),
    h('div', { class: 'badge-body' },
      h('h3', {}, b.title),
      h('p', { class: 'small muted' }, b.text),
      earned
        ? h('p', { class: 'small muted' }, `Erreicht am ${new Date(b.earned_at).toLocaleDateString('de-DE')}`)
        : b.progress
          ? [progressBar(b.progress.value, b.progress.max, `Fortschritt: ${b.title}`), h('p', { class: 'small muted' }, `${b.progress.value} von ${b.progress.max}`)]
          : null));
}

export function badgePage({ badges }) {
  const earned = badges.filter((b) => b.earned_at).length;
  return h('section', {},
    h('div', { class: 'section-head' },
      h('h1', {}, 'Abzeichen'),
      h('a', { class: 'btn', href: '#/' }, 'Zurück')),
    h('p', { class: 'muted' }, `${earned} von ${badges.length} erreicht. Abzeichen gibt es fürs Können: Wörter und Regeln, die auch nach Wochen sitzen. Einige verraten sich erst, wenn du sie hast.`),
    h('ul', { class: 'badges' }, badges.map(card)));
}
