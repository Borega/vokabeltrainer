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

// Sprachen zur Auswahl im Editor: die Schulfremdsprachen zuerst, dann weitere (auch Herkunftssprachen für DaZ)
export const MAIN_LANGUAGES = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Latein'];
export const MORE_LANGUAGES = ['Albanisch', 'Altgriechisch', 'Arabisch', 'Bulgarisch', 'Chinesisch', 'Dänisch',
  'Englisch (amerikanisch)', 'Griechisch', 'Italienisch', 'Japanisch', 'Kroatisch', 'Kurdisch', 'Niederländisch',
  'Norwegisch', 'Persisch', 'Polnisch', 'Portugiesisch', 'Rumänisch', 'Russisch', 'Schwedisch', 'Serbisch', 'Türkisch',
  'Ukrainisch'];
export const LANGUAGES = [...MAIN_LANGUAGES, ...MORE_LANGUAGES];

const langKey = (s) => (s ?? '').trim().toLocaleLowerCase('de');

// Bezeichnung aus der Auswahl, die zu label passt (Schreibweise egal, auch „English“ → „Englisch“), sonst null
export function knownLanguage(label, tagOf) {
  const k = langKey(label);
  if (!k) return null;
  const exact = LANGUAGES.find((l) => langKey(l) === k);
  if (exact) return exact;
  const tag = tagOf?.(label);
  return tag ? LANGUAGES.find((l) => tagOf(l) === tag) ?? null : null;
}

// Auswahlfeld für die Sprache einer Liste. Eine ältere, frei eingetippte Bezeichnung, die nicht in der Auswahl
// steht, bleibt als eigene Option erhalten. select.setLanguage(label) wählt eine passende Sprache (z. B. aus der
// Kopfzeile einer CSV-Datei) und gibt zurück, ob es eine gab.
export function languageSelect(value, tagOf) {
  const current = (value ?? '').trim();
  const known = knownLanguage(current, tagOf);
  const option = (l) => h('option', { value: l }, l);
  const select = h('select', { required: true },
    h('option', { value: '' }, 'Bitte wählen …'),
    current && !LANGUAGES.includes(current) && !known ? h('option', { value: current }, current) : null,
    h('optgroup', { label: 'Häufig' }, MAIN_LANGUAGES.map(option)),
    h('optgroup', { label: 'Weitere Sprachen' }, MORE_LANGUAGES.map(option)));
  select.value = known ?? current;
  select.setLanguage = (label) => {
    const match = knownLanguage(label, tagOf);
    if (match) select.value = match;
    return !!match;
  };
  return select;
}

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

// Gezeichnete Symbole (eine Strichstärke, folgen der Textfarbe) statt Emojis
const ICONS = {
  volume: ['M11 5 6 9H3v6h3l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M19 16H6a2 2 0 0 0-2 2'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  auto: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 3v18'],
  calendar: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z', 'M4 10h16', 'M8 3v3', 'M16 3v3'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  swap: ['M4 8h14', 'M14 4l4 4-4 4', 'M20 16H6', 'M10 12l-4 4 4 4'],
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '1.15em');
  svg.setAttribute('height', '1.15em');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon-svg');
  for (const d of ICONS[name]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  if (name === 'auto') svg.firstChild.nextSibling.setAttribute('fill', 'currentColor');
  return svg;
}
