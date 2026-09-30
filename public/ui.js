// Bausteine der Oberfläche, die app.js und die Grammatik-Module gemeinsam nutzen.

const app = document.getElementById('app');

// Baut DOM-Elemente, ohne Nutzereingaben als HTML zu interpretieren.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE');
}

// Einstellungen, die nur im Browser gemerkt werden (z. B. Ton an/aus)
export function pref(name, value) {
  try {
    if (value === undefined) return localStorage.getItem(`vokabeltrainer.${name}`);
    localStorage.setItem(`vokabeltrainer.${name}`, value);
  } catch {
    return null;
  }
  return value;
}

export function toast(message, kind = 'info') {
  document.querySelectorAll(`.toast.${kind}`).forEach((old) => old.remove()); // nicht übereinander stapeln
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

export function progressBar(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const fill = h('span');
  fill.style.width = `${pct}%`; // CSSOM statt style-Attribut – das erlaubt die Content-Security-Policy
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label }, fill);
}

// replaceChildren ohne null/false und mit verschachtelten Arrays
export function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
}

export function view(...children) {
  fill(app, ...children);
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Auswahl per Schaltflächen (Radiogruppe), z. B. Modus, Richtung, Anzahl
export const segmented = (label, options, current, onPick) =>
  h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    options.map(([value, text]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(current === value), class: current === value ? 'active' : '',
      onclick: () => onPick(value),
    }, text)));

// Ende des heutigen Tages (lokale Zeit): Bis dahin fällige Wörter zählen als „heute fällig“.
export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// „heute“, „morgen“, „am Montag“ oder Datum
export function formatDue(date) {
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days < 7) return `am ${new Date(date).toLocaleDateString('de-DE', { weekday: 'long' })}`;
  return `am ${new Date(date).toLocaleDateString('de-DE')}`;
}

// Sprachen zur Auswahl im Editor (Vorschlagsliste)
export const LANGUAGES = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Latein', 'Italienisch', 'Russisch', 'Niederländisch', 'Polnisch', 'Türkisch', 'Altgriechisch', 'Chinesisch'];

// Beschriftetes Formularfeld mit optionalem Hinweis
export const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', { class: 'muted' }, hint) : null);

// Gruppenauswahl für eine Liste: eigene Gruppen der Lehrkraft plus bereits zugewiesene.
// Ergebnis: { filter, box } zum Einbauen und selected() = gewählte Gruppen [{ id, name }]
export function groupPicker(list, ownGroups, markDirty) {
  const groupMap = new Map(ownGroups.map((g) => [g.id, g]));
  for (const g of list.groups ?? []) if (!groupMap.has(g.id)) groupMap.set(g.id, g);
  const selected = new Set((list.groups ?? []).map((g) => g.id));
  const filter = h('input', { type: 'search', placeholder: 'Gruppe suchen …' });
  const box = h('div', { class: 'group-list' });
  const render = () => {
    const q = filter.value.trim().toLowerCase();
    const groups = [...groupMap.values()]
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
      .sort((x, y) => Number(selected.has(y.id)) - Number(selected.has(x.id)) || x.name.localeCompare(y.name, 'de'));
    fill(box,
      ...groups.map((g) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: selected.has(g.id), onchange: (e) => { e.target.checked ? selected.add(g.id) : selected.delete(g.id); markDirty(); } }),
        g.name)),
      groups.length ? null : h('p', { class: 'small muted' }, groupMap.size ? 'Keine passende Gruppe.' : 'Du bist in keiner Gruppe Mitglied.'),
    );
  };
  filter.oninput = render;
  render();
  return { filter, box, selected: () => [...selected].map((gid) => groupMap.get(gid)).filter(Boolean) };
}
