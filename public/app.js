import { checkAnswer } from './check.js';
import { csvToWords, wordsToCsv } from './csv.js';

const SAFE_BOX = 3;
const app = document.getElementById('app');
const userBox = document.getElementById('user');
let me = null;
let settings = {};
let leaveGuard = null; // Rückfrage bei ungespeicherten Änderungen

// ---------- Hilfsfunktionen ----------

// Baut DOM-Elemente, ohne Nutzereingaben als HTML zu interpretieren.
function h(tag, attrs = {}, ...children) {
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

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    me = null;
    renderLogin();
    throw new Error('Nicht angemeldet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE');
}

function langLabel(list, side) {
  return (side === 'a' ? list.lang_a : list.lang_b) || (side === 'a' ? 'Seite A' : 'Seite B');
}

function directionLabel(list, dir) {
  if (dir === 'mixed') return 'Gemischt';
  const [from, to] = dir === 'ab' ? ['a', 'b'] : ['b', 'a'];
  return `${langLabel(list, from)} → ${langLabel(list, to)}`;
}

function toast(message, kind = 'info') {
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

function progressBar(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const fill = h('span');
  fill.style.width = `${pct}%`; // CSSOM statt style-Attribut – das erlaubt die Content-Security-Policy
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label }, fill);
}

// replaceChildren ohne null/false und mit verschachtelten Arrays
function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
}

function view(...children) {
  fill(app, ...children);
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function showError(err) {
  view(h('div', { class: 'panel' }, h('h1', {}, 'Das hat nicht geklappt'), h('p', {}, err.message), h('a', { class: 'btn', href: '#/' }, 'Zur Startseite')));
}

// ---------- Anmeldung ----------

function renderUser() {
  fill(userBox,);
  if (!me) return;
  userBox.append(
    h('span', { class: 'who' }, me.name, me.isTeacher ? h('span', { class: 'chip' }, 'Lehrkraft') : null),
    h('form', { method: 'post', action: '/auth/logout' }, h('button', { class: 'btn ghost small', type: 'submit' }, 'Abmelden')),
  );
}

function renderLogin() {
  renderUser();
  const parts = [
    h('h1', {}, settings.appName || 'Vokabeltrainer'),
    h('p', { class: 'lead' }, 'Vokabeln lernen mit Karteikarten oder durch Eintippen – mit den Listen deiner Lehrkräfte.'),
  ];
  if (settings.oidc) parts.push(h('a', { class: 'btn primary big', href: '/auth/login' }, settings.loginLabel || 'Anmelden'));
  if (settings.devLogin) {
    parts.push(
      h('form', { class: 'devlogin', method: 'post', action: '/auth/dev-login' },
        h('h2', {}, 'Test-Anmeldung (nur Entwicklung)'),
        h('label', {}, 'Name', h('input', { name: 'name', required: true, value: 'Frau Muster' })),
        h('label', {}, 'Gruppen (mit Komma getrennt)', h('input', { name: 'groups', value: 'Klasse 7b, Englisch 7' })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'teacher', checked: true }), 'Lehrkraft'),
        h('button', { class: 'btn', type: 'submit' }, 'Anmelden'),
      ),
    );
  }
  if (!settings.oidc && !settings.devLogin) parts.push(h('p', { class: 'error' }, 'Es ist keine Anmeldung konfiguriert.'));
  view(h('section', { class: 'login panel' }, parts));
}

// ---------- Startseite ----------

function listCard(list, { own }) {
  const total = list.word_count;
  const meta = [
    `${total} Wörter`,
    list.mode === 'type' ? 'Eintippen' : 'Karteikarten',
  ];
  if (!own && list.owner_name) meta.push(`von ${list.owner_name}`);
  return h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, list.title),
      h('span', { class: 'langs' }, `${langLabel(list, 'a')} ↔ ${langLabel(list, 'b')}`),
    ),
    h('p', { class: 'muted small' }, meta.join(' · ')),
    own && list.copied_from ? h('p', { class: 'muted small' }, `Kopie von: ${list.copied_from}`) : null,
    own && list.shared ? h('div', { class: 'chips' }, h('span', { class: 'chip shared' }, 'Für Kolleg:innen freigegeben')) : null,
    list.progress.due ? h('div', { class: 'chips' }, h('span', { class: 'chip due' }, `🔔 ${list.progress.due} heute fällig`)) : null,
    own && list.groups?.length
      ? h('div', { class: 'chips' }, list.groups.map((g) => h('span', { class: 'chip' }, g.name)))
      : own ? h('p', { class: 'warn small' }, 'Noch keiner Gruppe zugewiesen') : null,
    !own || list.progress.seen
      ? h('div', { class: 'progress' },
          progressBar(list.progress.safe, total, 'Sicher gelernt'),
          h('span', { class: 'small muted' }, `${list.progress.safe} von ${total} sicher · zuletzt ${formatDate(list.progress.last_seen)}`))
      : null,
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: `#/learn/${list.id}` }, 'Lernen'),
      own ? h('a', { class: 'btn', href: `#/edit/${list.id}` }, 'Bearbeiten') : null,
      own ? h('a', { class: 'btn', href: `#/stats/${list.id}` }, 'Auswertung') : null,
    ),
  );
}

async function renderHome() {
  const { own, assigned } = await api('GET', `/lists?due_until=${encodeURIComponent(endOfToday().toISOString())}`);
  const sections = [];
  const dueLists = [...own, ...assigned].filter((l) => l.progress.due);
  const dueTotal = dueLists.reduce((sum, l) => sum + l.progress.due, 0);
  if (dueTotal) {
    sections.push(h('section', { class: 'panel due-banner' },
      h('h2', {}, `🔔 Heute fällig: ${dueTotal} ${dueTotal === 1 ? 'Wort' : 'Wörter'}`),
      h('p', { class: 'small muted' }, 'Jetzt wiederholen, bevor du sie vergisst – das dauert nur ein paar Minuten.'),
      h('div', { class: 'actions' }, dueLists.map((l) => h('a', { class: 'btn', href: `#/learn/${l.id}` }, `${l.title} (${l.progress.due})`))),
    ));
  }
  if (me.isTeacher) {
    sections.push(
      h('section', {},
        h('div', { class: 'section-head' },
          h('h2', {}, 'Meine Listen'),
          h('div', { class: 'actions' },
            h('a', { class: 'btn', href: '#/shared' }, 'Geteilte Listen'),
            h('a', { class: 'btn primary', href: '#/edit/new' }, '+ Neue Liste'))),
        own.length
          ? h('div', { class: 'grid' }, own.map((l) => listCard(l, { own: true })))
          : h('p', { class: 'empty' }, 'Du hast noch keine Listen. Lege eine neue an oder importiere eine CSV-Datei.'),
      ),
    );
  }
  if (!me.isTeacher || assigned.length) {
    sections.push(
      h('section', {},
        h('div', { class: 'section-head' }, h('h2', {}, me.isTeacher ? 'Meinen Gruppen zugewiesen' : 'Meine Vokabellisten')),
        assigned.length
          ? h('div', { class: 'grid' }, assigned.map((l) => listCard(l, { own: false })))
          : h('p', { class: 'empty' }, 'Für deine Klassen und Kurse gibt es noch keine Listen.'),
      ),
    );
  }
  view(...sections);
}

// ---------- Editor (Lehrkräfte) ----------

const LANGUAGES = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Latein', 'Italienisch', 'Russisch', 'Niederländisch', 'Polnisch', 'Türkisch', 'Altgriechisch', 'Chinesisch'];

async function renderEditor(id) {
  const isNew = id === 'new';
  const list = isNew
    ? { title: '', lang_a: 'Englisch', lang_b: 'Deutsch', mode: 'flip', case_sensitive: false, accent_sensitive: true, direction: 'ab', allow_switch: true, shared: false, groups: [], words: [] }
    : await api('GET', `/lists/${id}`);
  if (!isNew && !list.is_owner) throw new Error('Nur die Ersteller:in darf diese Liste bearbeiten.');

  let dirty = false;
  const markDirty = () => { dirty = true; };
  leaveGuard = () => !dirty || confirm('Ungespeicherte Änderungen verwerfen?');
  window.onbeforeunload = (e) => { if (dirty) e.preventDefault(); };

  const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', { class: 'muted' }, hint) : null);

  const title = h('input', { value: list.title, required: true, maxLength: 200, placeholder: 'z. B. Unit 3 – At the zoo' });
  const langA = h('input', { value: list.lang_a, list: 'langs', maxLength: 50 });
  const langB = h('input', { value: list.lang_b, list: 'langs', maxLength: 50 });

  const modeFlip = h('input', { type: 'radio', name: 'mode', value: 'flip', checked: list.mode === 'flip' });
  const modeType = h('input', { type: 'radio', name: 'mode', value: 'type', checked: list.mode === 'type' });
  const caseSens = h('input', { type: 'checkbox', checked: list.case_sensitive });
  const accentSens = h('input', { type: 'checkbox', checked: list.accent_sensitive });
  const typeOptions = h('div', { class: 'suboptions' },
    h('label', { class: 'check' }, caseSens, 'Groß-/Kleinschreibung beachten', h('small', { class: 'muted' }, ' (z. B. für deutsche Nomen)')),
    h('label', { class: 'check' }, accentSens, 'Akzente und Umlaute beachten', h('small', { class: 'muted' }, ' (é ≠ e, ü ≠ u)')),
    h('p', { class: 'small muted' }, 'Mehrere richtige Lösungen mit „;“ trennen (big; large). Teile in Klammern sind optional: „(to) go“.'),
  );
  const syncMode = () => { typeOptions.hidden = !modeType.checked; };
  modeFlip.onchange = modeType.onchange = () => { syncMode(); markDirty(); };
  syncMode();

  const direction = h('select', {},
    ['ab', 'ba', 'mixed'].map((d) => h('option', { value: d, selected: list.direction === d }, '')));
  const refreshDirectionLabels = () => {
    const tmp = { lang_a: langA.value.trim(), lang_b: langB.value.trim() };
    [...direction.options].forEach((o) => { o.textContent = directionLabel(tmp, o.value); });
    colA.textContent = langA.value.trim() || 'Seite A';
    colB.textContent = langB.value.trim() || 'Seite B';
  };
  const allowSwitch = h('input', { type: 'checkbox', checked: list.allow_switch });
  const shared = h('input', { type: 'checkbox', checked: list.shared });

  // Gruppen: eigene Gruppen der Lehrkraft + bereits zugewiesene
  const groupMap = new Map(me.groups.map((g) => [g.id, g]));
  for (const g of list.groups ?? []) if (!groupMap.has(g.id)) groupMap.set(g.id, g);
  const selected = new Set((list.groups ?? []).map((g) => g.id));
  const groupFilter = h('input', { type: 'search', placeholder: 'Gruppe suchen …' });
  const groupBox = h('div', { class: 'group-list' });
  const renderGroups = () => {
    const q = groupFilter.value.trim().toLowerCase();
    const groups = [...groupMap.values()]
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
      .sort((x, y) => Number(selected.has(y.id)) - Number(selected.has(x.id)) || x.name.localeCompare(y.name, 'de'));
    fill(groupBox,
      ...groups.map((g) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: selected.has(g.id), onchange: (e) => { e.target.checked ? selected.add(g.id) : selected.delete(g.id); markDirty(); } }),
        g.name)),
      groups.length ? null : h('p', { class: 'small muted' }, groupMap.size ? 'Keine passende Gruppe.' : 'Du bist in keiner Gruppe Mitglied.'),
    );
  };
  groupFilter.oninput = renderGroups;
  renderGroups();

  // Wortliste
  const colA = h('th', {});
  const colB = h('th', {});
  const tbody = h('tbody', {});
  const counter = h('span', { class: 'muted small' });
  const updateCount = () => {
    const n = [...tbody.rows].filter((r) => r.querySelector('.a').value.trim() || r.querySelector('.b').value.trim()).length;
    counter.textContent = `${n} ${n === 1 ? 'Wort' : 'Wörter'}`;
  };
  function addRow(w = { a: '', b: '', note: '' }, focus = false) {
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = row.nextElementSibling;
        if (next) next.querySelector('.a').focus();
        else addRow(undefined, true);
      }
    };
    const row = h('tr', { dataset: w.id ? { id: w.id } : {} },
      h('td', {}, h('input', { class: 'a', value: w.a, 'aria-label': 'Wort A', onkeydown: onKey })),
      h('td', {}, h('input', { class: 'b', value: w.b, 'aria-label': 'Wort B', onkeydown: onKey })),
      h('td', {}, h('input', { class: 'note', value: w.note ?? '', 'aria-label': 'Notiz', placeholder: 'optional', onkeydown: onKey })),
      h('td', {}, h('button', { type: 'button', class: 'icon', title: 'Zeile löschen', 'aria-label': 'Zeile löschen', onclick: () => { row.remove(); if (!tbody.rows.length) addRow(); markDirty(); updateCount(); } }, '×')),
    );
    tbody.append(row);
    if (focus) row.querySelector('.a').focus();
    updateCount();
    return row;
  }
  for (const w of list.words) addRow(w);
  if (!list.words.length) for (let i = 0; i < 5; i++) addRow();

  const readWords = () => [...tbody.rows]
    .map((r) => ({
      id: r.dataset.id ? Number(r.dataset.id) : undefined,
      a: r.querySelector('.a').value,
      b: r.querySelector('.b').value,
      note: r.querySelector('.note').value,
    }))
    .filter((w) => w.a.trim() || w.b.trim());

  // CSV
  const fileInput = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', hidden: true });
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const text = await file.text();
    const { words, header } = csvToWords(text);
    if (!words.length) return toast('In der Datei wurden keine Wörter gefunden.', 'error');
    const existing = readWords();
    let replace = !existing.length;
    if (existing.length) {
      replace = confirm(`${words.length} Wörter gefunden.\n\nOK = vorhandene ${existing.length} Wörter ersetzen\nAbbrechen = anhängen`);
    }
    if (replace) tbody.replaceChildren();
    else [...tbody.rows].forEach((r) => { if (!r.querySelector('.a').value.trim() && !r.querySelector('.b').value.trim()) r.remove(); });
    for (const w of words) addRow(w);
    if (header) {
      if (!langA.value.trim() || isNew) langA.value = header[0];
      if (!langB.value.trim() || isNew) langB.value = header[1];
      refreshDirectionLabels();
    }
    if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, '');
    markDirty();
    toast(`${words.length} Wörter importiert.`);
  };
  const exportCsv = () => {
    const csv = wordsToCsv(readWords(), [langA.value.trim() || 'A', langB.value.trim() || 'B', 'Notiz']);
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `${title.value.trim() || 'vokabeln'}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const errorBox = h('p', { class: 'error', role: 'alert' });
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Speichern');

  async function save(e) {
    e.preventDefault();
    errorBox.textContent = '';
    const body = {
      title: title.value,
      lang_a: langA.value,
      lang_b: langB.value,
      mode: modeType.checked ? 'type' : 'flip',
      case_sensitive: caseSens.checked,
      accent_sensitive: accentSens.checked,
      direction: direction.value,
      allow_switch: allowSwitch.checked,
      shared: shared.checked,
      groups: [...selected].map((gid) => groupMap.get(gid)).filter(Boolean),
      words: readWords(),
    };
    saveBtn.disabled = true;
    try {
      if (isNew) await api('POST', '/lists', body);
      else await api('PUT', `/lists/${id}`, body);
      dirty = false;
      toast('Gespeichert.');
      if (!body.groups.length) toast('Hinweis: Die Liste ist noch keiner Gruppe zugewiesen.', 'warn');
      location.hash = '#/';
    } catch (err) {
      errorBox.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function remove() {
    if (!confirm(`Liste „${list.title}“ mit allen Lernständen endgültig löschen?`)) return;
    await api('DELETE', `/lists/${id}`);
    dirty = false;
    toast('Liste gelöscht.');
    location.hash = '#/';
  }

  const form = h('form', { class: 'editor', onsubmit: save, oninput: (e) => { markDirty(); if (e.target === langA || e.target === langB) refreshDirectionLabels(); if (e.target.closest('tbody')) updateCount(); } },
    h('datalist', { id: 'langs' }, LANGUAGES.map((l) => h('option', { value: l }))),
    h('div', { class: 'section-head' }, h('h1', {}, isNew ? 'Neue Liste' : 'Liste bearbeiten'), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('div', { class: 'panel' },
      field('Titel', title),
      h('div', { class: 'row2' }, field('Sprache / Seite A', langA), field('Sprache / Seite B', langB)),
    ),
    h('div', { class: 'panel' },
      h('h2', {}, 'Abfrage'),
      h('div', { class: 'choice' },
        h('label', { class: 'option' }, modeFlip, h('strong', {}, 'Karteikarten'), h('small', {}, 'Karte umdrehen und selbst einschätzen: gewusst oder nicht.')),
        h('label', { class: 'option' }, modeType, h('strong', {}, 'Eintippen'), h('small', {}, 'Die Übersetzung muss eingetippt werden und wird automatisch geprüft.')),
      ),
      typeOptions,
      h('div', { class: 'row2' },
        field('Abfragerichtung', direction),
        h('label', { class: 'check align-end' }, allowSwitch, 'Schüler:innen dürfen die Richtung wechseln'),
      ),
    ),
    h('div', { class: 'panel' },
      h('h2', {}, 'Für wen?'),
      h('p', { class: 'small muted' }, 'Nur Mitglieder der gewählten Gruppen sehen die Liste.'),
      groupFilter,
      groupBox,
      h('label', { class: 'check share-option' }, shared,
        h('span', {}, h('strong', {}, 'Für Kolleg:innen freigeben'),
          h('small', { class: 'muted' }, ' – andere Lehrkräfte können die Liste ansehen und eine eigene Kopie anlegen. Lernstände werden nicht geteilt.'))),
      list.copied_from ? h('p', { class: 'small muted' }, `Kopie von: ${list.copied_from}`) : null,
    ),
    h('div', { class: 'panel' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Wörter ', counter),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'CSV importieren'),
          h('button', { type: 'button', class: 'btn', onclick: exportCsv }, 'CSV exportieren'),
          fileInput,
        ),
      ),
      h('p', { class: 'small muted' }, 'CSV: erste Spalte Seite A, zweite Spalte Seite B, dritte Spalte optional Notiz (Trennzeichen ; , oder Tab). Mit Enter springst du in die nächste Zeile.'),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'words' },
          h('thead', {}, h('tr', {}, colA, colB, h('th', {}, 'Notiz / Beispiel'), h('th', {}))),
          tbody)),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { addRow(undefined, true); } }, '+ Zeile'),
    ),
    errorBox,
    h('div', { class: 'actions sticky' },
      saveBtn,
      isNew ? null : h('button', { type: 'button', class: 'btn danger', onclick: remove }, 'Liste löschen'),
    ),
  );
  refreshDirectionLabels();
  view(form);
  if (isNew) title.focus();
}

// ---------- Lernen ----------

// Ende des heutigen Tages (lokale Zeit): Bis dahin fällige Wörter zählen als „heute fällig“.
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function renderLearn(id) {
  const list = await api('GET', `/lists/${id}`);
  if (!list.words.length) throw new Error('Diese Liste enthält keine Wörter.');
  const progress = new Map(list.progress.map((p) => [`${p.word_id}:${p.direction}`, p]));
  const key = (wordId, dir) => `${wordId}:${dir}`;

  let direction = list.direction;
  let size = '20';
  let mode = null; // 'due' (Heute fällig) oder 'free' (Frei üben)

  const dirsFor = () => (direction === 'mixed' ? ['ab', 'ba'] : [direction]);

  // Fällige Einträge (Wort + Richtung), die ältesten zuerst – pro Wort höchstens einer.
  function dueItems() {
    const until = endOfToday();
    const dirs = dirsFor();
    const seen = new Set();
    return [...progress.values()]
      .filter((p) => dirs.includes(p.direction) && p.due && new Date(p.due) <= until)
      .sort((x, y) => new Date(x.due) - new Date(y.due))
      .filter((p) => !seen.has(p.word_id) && seen.add(p.word_id))
      .map((p) => ({ word: list.words.find((w) => w.id === p.word_id), dir: p.direction }))
      .filter((c) => c.word);
  }

  // Wörter, die in der gewählten Richtung noch nie abgefragt wurden.
  function newItems() {
    const dirs = dirsFor();
    return list.words
      .map((w) => {
        const missing = dirs.filter((d) => !progress.has(key(w.id, d)));
        return missing.length ? { word: w, dir: missing[Math.floor(Math.random() * missing.length)] } : null;
      })
      .filter(Boolean);
  }

  function nextDueDate() {
    const dirs = dirsFor();
    const dates = [...progress.values()].filter((p) => dirs.includes(p.direction) && p.due).map((p) => new Date(p.due));
    return dates.length ? new Date(Math.min(...dates)) : null;
  }

  function pickDue() {
    const n = size === 'all' ? Infinity : Number(size);
    const cards = dueItems().slice(0, n);
    const used = new Set(cards.map((c) => c.word.id));
    const fresh = shuffle(newItems().filter((c) => !used.has(c.word.id)));
    cards.push(...fresh.slice(0, Math.max(0, n - cards.length)));
    return shuffle(cards);
  }

  function pickFree() {
    const cards = list.words.map((w) => {
      const dir = direction === 'mixed' ? (Math.random() < 0.5 ? 'ab' : 'ba') : direction;
      return { word: w, dir, box: progress.get(key(w.id, dir))?.box ?? 0, rnd: Math.random() };
    });
    cards.sort((x, y) => x.box - y.box || x.rnd - y.rnd);
    const n = size === 'all' ? cards.length : Number(size);
    return shuffle(cards.slice(0, n));
  }

  const pick = () => (mode === 'due' ? pickDue() : pickFree());

  const segmented = (label, options, current, onPick) =>
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      options.map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(current === value), class: current === value ? 'active' : '',
        onclick: () => onPick(value),
      }, text)));

  const setupView = () => {
    const due = dueItems().length;
    const fresh = newItems().length;
    if (!mode) mode = due + fresh > 0 ? 'due' : 'free';
    const dirs = dirsFor();
    const safe = list.words.filter((w) => dirs.every((d) => (progress.get(key(w.id, d))?.box ?? 0) >= SAFE_BOX)).length;
    const nothingToDo = mode === 'due' && due + fresh === 0;
    const next = nextDueDate();

    const modeInfo = mode === 'due'
      ? h('div', { class: 'mode-info' },
          h('p', {}, h('strong', {}, `${due} fällig`), ` · ${fresh} neu`),
          h('p', { class: 'small muted' }, 'Das Programm plant, wann jedes Wort wiederkommt: Gewusste Wörter kommen in immer größeren Abständen, vergessene schon am nächsten Tag. So bleibt am meisten hängen.'))
      : h('div', { class: 'mode-info' },
          h('p', { class: 'small muted' }, 'Beliebige Wörter üben, unsichere zuerst – z. B. vor einem Test. Deine Antworten fließen trotzdem in die Planung ein.'));

    view(h('section', { class: 'panel learn-setup' },
      h('div', { class: 'section-head' }, h('h1', {}, list.title), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
      h('p', { class: 'muted' }, [`${list.words.length} Wörter`, list.mode === 'type' ? 'Eintippen' : 'Karteikarten', list.is_owner ? null : list.owner_name && `von ${list.owner_name}`].filter(Boolean).join(' · ')),
      h('div', { class: 'progress' }, progressBar(safe, list.words.length, 'Sicher gelernt'), h('span', { class: 'small muted' }, `${safe} von ${list.words.length} sicher gelernt`)),
      h('h2', {}, 'Modus'),
      segmented('Modus', [['due', `Heute fällig${due ? ` (${due})` : ''}`], ['free', 'Frei üben']], mode, (m) => { mode = m; setupView(); }),
      modeInfo,
      h('h2', {}, 'Richtung'),
      list.allow_switch
        ? segmented('Richtung', ['ab', 'ba', 'mixed'].map((d) => [d, directionLabel(list, d)]), direction, (d) => { direction = d; setupView(); })
        : h('p', {}, directionLabel(list, direction)),
      h('h2', {}, 'Wie viele Wörter?'),
      segmented('Anzahl', [['10', '10'], ['20', '20'], ['all', `Alle${mode === 'free' ? ` (${list.words.length})` : ''}`]], size, (s) => { size = s; setupView(); }),
      nothingToDo
        ? h('p', { class: 'done-today' }, 'Für heute ist alles erledigt 🎉',
            next ? h('span', { class: 'small muted' }, ` Nächste Wiederholung: ${formatDue(next)}.`) : null)
        : null,
      h('div', { class: 'actions' },
        nothingToDo
          ? h('button', { class: 'btn primary big', onclick: () => { mode = 'free'; setupView(); } }, 'Trotzdem frei üben')
          : h('button', { class: 'btn primary big', onclick: () => startRound(pick()) }, 'Los geht’s'),
        list.progress.length ? h('button', { class: 'btn ghost', onclick: resetProgress }, 'Lernstand zurücksetzen') : null,
        list.can_copy && !list.is_owner ? h('button', { class: 'btn', onclick: () => copyList(list) }, 'In meine Listen kopieren') : null,
      ),
    ));
  };

  async function resetProgress() {
    if (!confirm('Deinen Lernstand für diese Liste wirklich zurücksetzen?')) return;
    await api('DELETE', `/lists/${id}/progress`);
    progress.clear();
    list.progress = [];
    mode = null;
    setupView();
  }

  // Antworten sammeln und an den Server schicken; der plant die nächste Wiederholung.
  // Anfragen laufen nacheinander (Kette); wer flush() abwartet, wartet auf alles bis dahin Beantwortete.
  const pending = [];
  let chain = Promise.resolve();
  function record(card, grade, correct) {
    pending.push({ word_id: card.word.id, direction: card.dir, grade, correct });
    // Sofort als erledigt markieren, damit das Wort nicht erneut als fällig/neu zählt
    const k = key(card.word.id, card.dir);
    progress.set(k, { ...(progress.get(k) ?? { word_id: card.word.id, direction: card.dir, box: 0 }), due: null });
    flush();
  }
  function flush() {
    chain = chain.then(async () => {
      if (!pending.length) return;
      const batch = pending.splice(0);
      try {
        const res = await api('POST', `/lists/${id}/results`, { results: batch });
        // Noch nicht gesendete Antworten nicht mit altem Serverstand überschreiben
        const waiting = new Set(pending.map((r) => key(r.word_id, r.direction)));
        for (const p of res.progress) {
          const k = key(p.word_id, p.direction);
          if (!waiting.has(k)) progress.set(k, p);
        }
        list.progress = res.progress;
      } catch {
        pending.unshift(...batch);
        toast('Lernstand konnte nicht gespeichert werden.', 'error');
      }
    });
    return chain;
  }

  function startRound(cards) {
    if (!cards.length) return setupView();
    const queue = cards.map((c) => ({ ...c, retry: 0 }));
    const total = cards.length;
    let done = 0;
    let right = 0;
    const wrongWords = [];

    const options = { caseSensitive: list.case_sensitive, accentSensitive: list.accent_sensitive };

    function next() {
      const card = queue.shift();
      if (!card) return finish();
      const [from, to] = card.dir === 'ab' ? ['a', 'b'] : ['b', 'a'];
      const prompt = card.word[from];
      const solution = card.word[to];
      const header = h('div', { class: 'round-head' },
        h('button', { class: 'btn ghost small', onclick: () => { if (confirm('Runde abbrechen?')) { flush(); cleanupKeys(); setupView(); } } }, '✕ Beenden'),
        progressBar(done, total, 'Fortschritt der Runde'),
        h('span', { class: 'small muted' }, `${Math.min(done + 1, total)} / ${total}`),
      );

      // Nur die erste Antwort zählt für die Planung. Nicht (sicher) gewusste Wörter kommen
      // nach 3–5 Karten erneut, bis sie einmal richtig sind (höchstens dreimal).
      function answered(grade, correct) {
        if (!card.retry) {
          record(card, grade, correct);
          done++;
          if (correct) right++;
          else wrongWords.push(card);
        }
        if (!correct && card.retry < 3) {
          const at = Math.min(queue.length, 2 + Math.floor(Math.random() * 3));
          queue.splice(at, 0, { ...card, retry: card.retry + 1 });
        }
      }

      if (list.mode === 'flip') {
        let flipped = false;
        const inner = h('div', { class: 'flip-inner' },
          h('div', { class: 'face front' }, h('span', { class: 'lang' }, langLabel(list, from)), h('span', { class: 'word' }, prompt)),
          h('div', { class: 'face back', 'aria-hidden': 'true' }, h('span', { class: 'lang' }, langLabel(list, to)), h('span', { class: 'word' }, solution),
            card.word.note ? h('span', { class: 'note' }, card.word.note) : null),
        );
        const flipCard = h('button', { class: 'flipcard', 'aria-label': `${prompt} – Karte umdrehen`, onclick: () => flip() }, inner);
        const buttons = h('div', { class: 'actions center rate', hidden: true },
          h('button', { class: 'btn wrong big', onclick: () => rate('again') }, '✗ Nicht gewusst'),
          h('button', { class: 'btn right big', onclick: () => rate('good') }, '✓ Gewusst'),
          card.retry ? null : h('button', { class: 'btn easy big', onclick: () => rate('easy') }, '★ Leicht'),
        );
        const hint = h('p', { class: 'small muted center' }, 'Tippe auf die Karte oder drücke die Leertaste zum Umdrehen.');
        function flip() {
          flipped = !flipped;
          flipCard.classList.toggle('flipped', flipped);
          inner.children[0].setAttribute('aria-hidden', String(flipped));
          inner.children[1].setAttribute('aria-hidden', String(!flipped));
          flipCard.setAttribute('aria-label', flipped ? `${solution}${card.word.note ? ` – ${card.word.note}` : ''}` : `${prompt} – Karte umdrehen`);
          buttons.hidden = false;
          hint.textContent = card.retry ? 'Tasten: 1 / ← nicht gewusst · 2 / → gewusst' : 'Tasten: 1 / ← nicht gewusst · 2 / → gewusst · 3 / ↑ leicht';
        }
        function rate(grade) {
          if (!flipped) return;
          answered(grade, grade !== 'again');
          next();
        }
        setKeys((e) => {
          if (buttons.contains(e.target) && (e.key === ' ' || e.key === 'Enter')) return;
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) flip(); }
          else if (flipped && (e.key === 'ArrowLeft' || e.key === '1')) rate('again');
          else if (flipped && (e.key === 'ArrowRight' || e.key === '2')) rate('good');
          else if (flipped && !card.retry && (e.key === 'ArrowUp' || e.key === '3')) rate('easy');
        });
        view(h('section', { class: 'round' }, header, card.retry ? h('p', { class: 'retry small' }, 'Wiederholung') : null, flipCard, buttons, hint));
        flipCard.focus();
      } else {
        const input = h('input', { class: 'answer', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': `Übersetzung (${langLabel(list, to)})`, placeholder: langLabel(list, to) });
        const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
        const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Prüfen');
        let state = 'ask';
        let result = null;
        const form = h('form', { class: 'type-form', onsubmit: (e) => {
          e.preventDefault();
          if (state === 'ask') {
            if (!input.value.trim()) return;
            result = checkAnswer(input.value, solution, options);
            state = 'shown';
            input.readOnly = true;
            const ok = result === 'correct';
            form.classList.add(ok ? 'is-right' : 'is-wrong');
            fill(feedback,
              h('strong', {}, ok ? 'Richtig!' : result === 'almost' ? 'Fast!' : 'Leider falsch.'),
              ok && !hasVariants(solution) ? null : h('span', {}, ' Lösung: ', h('b', {}, solution)),
              card.word.note ? h('div', { class: 'note' }, card.word.note) : null,
              !ok ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { result = 'override'; proceed(); } }, 'Ich hatte recht') : null,
            );
            submit.textContent = 'Weiter';
            submit.focus();
          } else proceed();
        } }, h('div', { class: 'prompt' }, h('span', { class: 'lang' }, langLabel(list, from)), h('span', { class: 'word' }, prompt)), input, submit, feedback);
        function proceed() {
          // Tippfehler („fast“) = erinnert, aber mit Mühe; zählt als falsch und wird wiederholt.
          if (result === 'correct' || result === 'override') answered('good', true);
          else if (result === 'almost') answered('hard', false);
          else answered('again', false);
          next();
        }
        setKeys(null);
        view(h('section', { class: 'round' }, header, card.retry ? h('p', { class: 'retry small' }, 'Wiederholung') : null, form));
        input.focus();
      }
    }

    async function finish() {
      cleanupKeys();
      const pct = total ? Math.round((right / total) * 100) : 0;
      const outlook = h('p', { class: 'small muted' }, 'Lernstand wird gespeichert …');
      const remaining = h('div', {});
      view(h('section', { class: 'panel result' },
        h('h1', {}, pct === 100 ? 'Perfekt! 🎉' : pct >= 70 ? 'Gut gemacht!' : 'Weiter üben!'),
        h('p', { class: 'score' }, `${right} von ${total} beim ersten Versuch richtig (${pct} %)`),
        outlook,
        wrongWords.length
          ? h('div', {}, h('h2', {}, 'Noch üben'),
              h('ul', { class: 'wrong-list' }, wrongWords.map((c) => h('li', {}, h('span', {}, c.word[c.dir === 'ab' ? 'a' : 'b']), ' → ', h('b', {}, c.word[c.dir === 'ab' ? 'b' : 'a'])))))
          : null,
        remaining,
        h('div', { class: 'actions' },
          wrongWords.length ? h('button', { class: 'btn', onclick: () => { mode = 'free'; startRound(shuffle(wrongWords.map((c) => ({ ...c })))); } }, 'Fehler wiederholen') : null,
          h('button', { class: 'btn ghost', onclick: () => setupView() }, 'Einstellungen'),
          h('a', { class: 'btn ghost', href: '#/' }, 'Zur Übersicht'),
        ),
      ));
      await flush();
      // Wann kommen die Wörter dieser Runde wieder?
      const buckets = { morgen: 0, 'in 2–7 Tagen': 0, 'in 1–4 Wochen': 0, später: 0 };
      for (const c of cards) {
        const p = progress.get(key(c.word.id, c.dir));
        if (!p?.due) continue;
        const d = (new Date(p.due) - Date.now()) / 86400000;
        buckets[d <= 1.5 ? 'morgen' : d <= 7.5 ? 'in 2–7 Tagen' : d <= 30 ? 'in 1–4 Wochen' : 'später']++;
      }
      const parts = Object.entries(buckets).filter(([, n]) => n).map(([when, n]) => `${when}: ${n}`);
      outlook.textContent = parts.length ? `Kommt wieder – ${parts.join(' · ')}` : '';
      const left = dueItems().length + newItems().length;
      if (left) {
        fill(remaining, h('p', {}, `Heute noch fällig oder neu: ${left}`),
          h('button', { class: 'btn primary', onclick: () => { mode = 'due'; startRound(pickDue()); } }, 'Weiterlernen'));
      }
    }

    next();
  }

  leaveGuard = () => { flush(); cleanupKeys(); return true; };
  setupView();
}

// „heute“, „morgen“, „am Montag“ oder Datum
function formatDue(date) {
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days < 7) return `am ${new Date(date).toLocaleDateString('de-DE', { weekday: 'long' })}`;
  return `am ${new Date(date).toLocaleDateString('de-DE')}`;
}

// Bei mehreren Varianten wird die Lösung auch nach einer richtigen Antwort gezeigt.
function hasVariants(solution) {
  return /[;|()]/.test(solution);
}

let keyHandler = null;
function setKeys(fn) {
  cleanupKeys();
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}
function cleanupKeys() {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
}

// ---------- Auswertung (Lehrkräfte) ----------

async function renderStats(id) {
  const stats = await api('GET', `/lists/${id}/stats`);
  const n = stats.word_count;
  const groups = stats.groups.map((g) => h('section', { class: 'panel' },
    h('h2', {}, g.name, ' ', h('span', { class: 'muted small' }, `${g.students.length} Schüler:innen`)),
    g.students.length
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'stats' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Sicher'), h('th', {}, 'Geübt'), h('th', {}, 'Richtig / Falsch'), h('th', {}, 'Zuletzt'))),
          h('tbody', {}, g.students.map((s) => h('tr', { class: s.seen ? '' : 'inactive' },
            h('td', {}, s.name),
            h('td', { class: 'bar-cell' }, progressBar(s.safe, n, `Sicher: ${s.name}`), h('span', { class: 'small' }, `${s.safe}/${n}`)),
            h('td', {}, `${s.seen}/${n}`),
            h('td', {}, `${s.right} / ${s.wrong}`),
            h('td', {}, formatDate(s.last_seen)),
          )))))
      : h('p', { class: 'empty' }, 'Aus dieser Gruppe hat sich noch niemand angemeldet.'),
  ));
  view(
    h('div', { class: 'section-head' }, h('h1', {}, `Auswertung: ${stats.list.title}`), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('p', { class: 'small muted' }, '„Sicher“ = würde das Wort laut Lernplanung auch in zwei Wochen noch mit 90 % Wahrscheinlichkeit wissen (mehrmals an verschiedenen Tagen richtig). Es erscheinen nur Schüler:innen, die sich schon einmal angemeldet haben.'),
    groups.length ? groups : h('p', { class: 'empty' }, 'Die Liste ist keiner Gruppe zugewiesen.'),
    stats.hardest.length
      ? h('section', { class: 'panel' }, h('h2', {}, 'Schwierigste Wörter'),
          h('table', { class: 'stats' },
            h('thead', {}, h('tr', {}, h('th', {}, langLabel(stats.list, 'a')), h('th', {}, langLabel(stats.list, 'b')), h('th', {}, 'Fehlerquote'))),
            h('tbody', {}, stats.hardest.map((w) => h('tr', {}, h('td', {}, w.a), h('td', {}, w.b),
              h('td', {}, `${Math.round((w.wrong / (w.right + w.wrong)) * 100)} % (${w.wrong}×)`))))))
      : null,
  );
}

// ---------- Geteilte Listen (Lehrkräfte) ----------

async function copyList(list) {
  if (!confirm(`„${list.title}“ in deine Listen kopieren?

Die Kopie gehört dir: Du kannst sie bearbeiten und deinen Gruppen zuweisen. Das Original bleibt unverändert.`)) return;
  const { id } = await api('POST', `/lists/${list.id}/copy`, {});
  toast('Kopie angelegt – jetzt Gruppen zuweisen.');
  location.hash = `#/edit/${id}`;
}

async function renderShared() {
  const lists = await api('GET', '/shared');
  const search = h('input', { type: 'search', placeholder: 'Suchen nach Titel, Sprache oder Lehrkraft …', 'aria-label': 'Geteilte Listen durchsuchen' });
  const grid = h('div', { class: 'grid' });
  const count = h('span', { class: 'muted small' });
  const card = (list) => h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, list.title),
      h('span', { class: 'langs' }, `${langLabel(list, 'a')} ↔ ${langLabel(list, 'b')}`)),
    h('p', { class: 'muted small' }, [`${list.word_count} Wörter`, list.mode === 'type' ? 'Eintippen' : 'Karteikarten', list.owner_name && `von ${list.owner_name}`, `geändert ${formatDate(list.updated_at)}`].filter(Boolean).join(' · ')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => copyList(list) }, 'Kopieren'),
      h('a', { class: 'btn', href: `#/learn/${list.id}` }, 'Ansehen & ausprobieren')));
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const hits = lists.filter((l) => !q || [l.title, l.lang_a, l.lang_b, l.owner_name].some((t) => t?.toLowerCase().includes(q)));
    count.textContent = `${hits.length} ${hits.length === 1 ? 'Liste' : 'Listen'}`;
    fill(grid, hits.length ? hits.map(card) : h('p', { class: 'empty' }, lists.length ? 'Keine passende Liste gefunden.' : 'Noch hat niemand eine Liste freigegeben.'));
  };
  search.oninput = render;
  render();
  view(
    h('div', { class: 'section-head' }, h('h1', {}, 'Geteilte Listen'), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('p', { class: 'small muted' }, 'Listen, die Kolleg:innen freigegeben haben. Kopierte Listen gehören dir und können frei bearbeitet werden.'),
    h('div', { class: 'search-row' }, search, count),
    grid,
  );
  search.focus();
}

// ---------- Router ----------

async function route() {
  cleanupKeys();
  window.onbeforeunload = null;
  if (!me) return renderLogin();
  const [, page, id] = location.hash.replace(/^#\/?/, '').match(/^([^/]*)\/?(.*)$/) ?? [];
  try {
    if (page === 'learn' && id) await renderLearn(id);
    else if (page === 'edit' && id && me.isTeacher) await renderEditor(id);
    else if (page === 'stats' && id && me.isTeacher) await renderStats(id);
    else if (page === 'shared' && me.isTeacher) await renderShared();
    else await renderHome();
  } catch (err) {
    if (me) showError(err);
  }
}

let currentHash = location.hash;
window.addEventListener('hashchange', () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', currentHash || '#/');
    return;
  }
  leaveGuard = null;
  currentHash = location.hash;
  route();
});

async function init() {
  settings = await fetch('/config.json').then((r) => r.json()).catch(() => ({}));
  if (settings.appName) {
    document.title = settings.appName;
    document.getElementById('app-name').textContent = settings.appName;
  }
  try {
    me = await api('GET', '/me');
  } catch {
    me = null;
  }
  renderUser();
  route();
}

init();
