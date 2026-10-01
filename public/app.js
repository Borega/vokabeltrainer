import { almostReason, checkAnswer } from './check.js';
import { aiPrompt, textToWords, wordsToCsv } from './csv.js';
import {
  afterIntro, choiceOptions, clozeFor, editorChars, gapProblem, gradeFor, hintPattern, hintTarget, isGermanLabel, langTag, learnSide, markGap,
  maxHints, pickExercise, sameLanguage, specialChars, speechLang, speechText,
} from './exercises.js';
import { canSpeak, speak, stopSpeaking, voicesReady } from './speech.js';
import { renderGrammarEditor } from './grammar-editor.js';
import { renderGrammarLearn } from './grammar-learn.js';
import { renderGrammarStats, renderGrammarStudent } from './grammar-stats.js';
import { GRADES, KINDS, SORTS, filterLists, gradeLabel, languagesOf, sortLists } from './listfilter.js';
import { answer, mergeProgress, mergeRuleProgress, newId, ruleKey, summarize } from './offline.js';
import { createScheduler } from './schedule.js';
import * as store from './store.js';
import * as FSRS from './vendor/ts-fsrs.js';
import { exportGroupsCsv, groupPanels, historyPanel, levelChip, pct, sortableTable, statTiles } from './stats-ui.js';
import {
  endOfToday, field, fill, formatDate, formatDue, groupPicker, h, icon, languageSelect, pref, progressBar, segmented, shuffle, toast, view,
} from './ui.js';

// Dieselbe Planung wie auf dem Server – so geht Lernen auch ohne Internet weiter
const { review } = createScheduler(FSRS);

const SAFE_BOX = 3;
const userBox = document.getElementById('user');
let me = null;
let settings = {};
// Lernen ohne Internet: online = letzte Anfrage kam durch; offlineData = auf dem Gerät gespeicherte
// Listen der angemeldeten Person ({ user, lists, at }, siehe GET /api/offline)
let online = true;
let offlineData = null;
let needsLogin = false; // Sitzung abgelaufen, aber Antworten warten noch
let leaveGuard = null; // Rückfrage bei ungespeicherten Änderungen

// ---------- Hilfsfunktionen ----------


class OfflineError extends Error {}
class AuthError extends Error {}

// Anfrage an die API. Ohne Verbindung (oder nach 15 s ohne Antwort) OfflineError, abgelaufene Sitzung AuthError.
// Fehlt die Sitzung, wird einmal mit dem Geräteschlüssel („Angemeldet bleiben“) neu angemeldet.
async function request(method, path, body, { retry = true } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: AbortSignal.timeout?.(15000),
    });
  } catch {
    setOnline(false);
    throw new OfflineError('Keine Internetverbindung.');
  }
  setOnline(true);
  if (res.status === 401) {
    if (retry && (await resume())) return request(method, path, body, { retry: false });
    throw new AuthError('Nicht angemeldet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

// ---------- Angemeldet bleiben ----------
// Nach einer IServ-Anmeldung bekommt die App einen Geräteschlüssel (gilt REMEMBER_DAYS Tage ab der Anmeldung).
// Geht das Sitzungs-Cookie verloren – iOS verwirft es bei Apps auf dem Home-Bildschirm teils beim Schließen –,
// meldet die App sich damit still wieder an. Auf geteilten Geräten auf der Anmeldeseite abschaltbar.

const remembering = () => pref('remember') !== 'off';

let resuming = null;
function resume() {
  resuming ??= (async () => {
    const saved = await store.load('deviceToken').catch(() => null);
    if (!saved?.token || !remembering()) return false;
    try {
      const res = await fetch('/auth/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: saved.token }),
        credentials: 'same-origin',
      });
      if (res.status === 401) await store.remove('deviceToken').catch(() => {});
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => { resuming = null; });
  return resuming;
}

// Nach einer frischen IServ-Anmeldung neuen Schlüssel holen (der alte wird dabei ungültig)
async function rememberDevice() {
  if (!me?.remember || me.device || !remembering()) return;
  const saved = await store.load('deviceToken').catch(() => null);
  const { token } = await request('POST', '/device-token', { replace: saved?.token });
  await store.save('deviceToken', { user: me.id, token });
  me.device = true;
}

// Wie request(), bei abgelaufener Sitzung aber gleich zur Anmeldung
async function api(method, path, body) {
  try {
    return await request(method, path, body);
  } catch (err) {
    if (err instanceof AuthError) {
      me = null;
      renderLogin();
    }
    throw err;
  }
}

// Bezeichnung einer Seite: die Sprache – bei gleicher Sprache auf beiden Seiten (Deutsch ↔ Deutsch) Begriff und Bedeutung
function langLabel(list, side) {
  if (sameLanguage(list)) return side === 'a' ? 'Begriff' : 'Bedeutung';
  return (side === 'a' ? list.lang_a : list.lang_b) || (side === 'a' ? 'Seite A' : 'Seite B');
}

const MODE_LABELS = { auto: 'Lernleiter', flip: 'Karteikarten', type: 'Eintippen', choice: 'Auswählen' };
const modeLabel = (mode) => MODE_LABELS[mode] ?? MODE_LABELS.flip;
const MODE_HINTS = {
  auto: 'Neue Wörter lernst du erst kennen und wählst sie aus, danach tippst du sie ein – mit Tipps auf Wunsch, später auch im Satz oder nach Gehör. Je sicherer ein Wort sitzt, desto schwerer die Aufgabe.',
  flip: 'Karte umdrehen und selbst einschätzen: gewusst oder nicht. Schnell – gut zum Wiederholen vor einem Test.',
  type: 'Die Übersetzung eintippen, sie wird automatisch geprüft. Tipps gibt es auf Wunsch.',
  choice: 'Aus vier Antworten die richtige wählen. Leichter – zählt für die Planung aber nur als „mit Mühe gewusst“.',
};

// Darstellung: wie das Gerät, hell oder dunkel. Die Wahl wird im Browser gemerkt;
// theme.js setzt sie beim nächsten Laden schon vor dem ersten Zeichnen.
const THEMES = [
  ['auto', 'auto', 'wie Gerät'],
  ['light', 'sun', 'hell'],
  ['dark', 'moon', 'dunkel'],
];

function themeToggle(button) {
  let current = THEMES.findIndex(([name]) => name === pref('theme'));
  if (current < 0) current = 0;
  const apply = () => {
    const [name, symbol, label] = THEMES[current];
    const [, , nextLabel] = THEMES[(current + 1) % THEMES.length];
    if (name === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = name;
    fill(button, icon(symbol));
    button.title = `Darstellung: ${label} – klicken für ${nextLabel}`;
    button.setAttribute('aria-label', button.title);
  };
  button.addEventListener('click', () => {
    current = (current + 1) % THEMES.length;
    pref('theme', THEMES[current][0]);
    apply();
  });
  apply();
}

function directionLabel(list, dir) {
  if (dir === 'mixed') return 'Gemischt';
  const [from, to] = dir === 'ab' ? ['a', 'b'] : ['b', 'a'];
  return `${langLabel(list, from)} → ${langLabel(list, to)}`;
}

function showError(err) {
  view(h('div', { class: 'panel' }, h('h1', {}, 'Das hat nicht geklappt'), h('p', {}, err.message), h('a', { class: 'btn', href: '#/' }, 'Zur Startseite')));
}

// ---------- Anmeldung ----------

function renderUser() {
  fill(userBox,);
  renderNet();
  if (!me) return;
  userBox.append(
    h('span', { class: 'who' }, me.name, me.isTeacher ? h('span', { class: 'chip' }, 'Lehrkraft') : null),
    h('form', { method: 'post', action: '/auth/logout', onsubmit: logout },
      h('button', { class: 'btn ghost small', type: 'submit', disabled: !online, title: online ? null : 'Abmelden geht nur mit Internet' }, 'Abmelden')),
  );
}

const answersText = (n) => `${n} ${n === 1 ? 'Antwort' : 'Antworten'}`;

// Vor dem Abmelden noch übertragen und die gespeicherten Listen vom Gerät löschen.
// Nicht übertragene Antworten bleiben (der Person zugeordnet) und gehen bei der nächsten Anmeldung raus.
async function logout(e) {
  e.preventDefault();
  const form = e.target;
  await syncNow().catch(() => {});
  const left = (await store.pending(me.id).catch(() => [])).length;
  if (left && !confirm(`${answersText(left)} ${left === 1 ? 'konnte' : 'konnten'} noch nicht übertragen werden. ${left === 1 ? 'Sie bleibt auf diesem Gerät und wird' : 'Sie bleiben auf diesem Gerät und werden'} übertragen, wenn du dich hier wieder anmeldest.\n\nTrotzdem abmelden?`)) return;
  await Promise.all([store.remove('lastUser'), store.remove(`offline:${me.id}`), store.remove('deviceToken')]).catch(() => {});
  form.submit();
}

// Anzeige oben: offline, wartende Antworten, neu anmelden
const netBox = document.getElementById('net');
async function renderNet() {
  const waiting = me ? (await store.pending(me.id).catch(() => [])).length : 0;
  const answers = `${waiting} ${waiting === 1 ? 'Antwort wartet' : 'Antworten warten'}`;
  let content = null;
  if (me && !online) {
    content = h('span', { class: 'chip offline', title: 'Du kannst weiterlernen. Deine Antworten werden übertragen, sobald das Gerät wieder im Schul-WLAN ist.' },
      waiting ? `Offline · ${answers}` : 'Offline');
  } else if (me && needsLogin && waiting) {
    content = h('a', { class: 'chip offline', href: '/auth/login' }, `Neu anmelden – ${answers}`);
  } else if (me && waiting) {
    content = h('span', { class: 'chip', title: 'Wird übertragen …' }, answers);
  }
  fill(netBox, content);
  netBox.hidden = !content;
}

function setOnline(value) {
  if (online === value) return;
  online = value;
  renderUser();
}

// ---------- Lernen ohne Internet: Abgleich ----------

// Antworten, die gerade erst in den Gerätespeicher geschrieben werden (persistEntry → store.queue)
const unqueued = new Map();

// Antwort für die Übertragung merken: in die Warteschlange des Geräts, Listen auf dem Gerät auffrischen, im
// Hintergrund übertragen (auch ohne Internet kein Fehler). writes: die vorherigen Schreibvorgänge der Lernansicht –
// sie laufen nacheinander. Ergebnis: die neue Kette, auf die etwa das Zurücksetzen wartet.
function persistEntry(entry, writes = Promise.resolve()) {
  unqueued.set(entry.id, entry);
  const next = writes
    .then(() => store.queue(entry))
    .finally(() => unqueued.delete(entry.id))
    .then(() => offlineData && store.save(`offline:${me.id}`, offlineData))
    .catch(() => toast('Antwort konnte auf dem Gerät nicht gespeichert werden.', 'error'));
  next.then(() => syncNow()).catch(() => {});
  return next;
}

// Welche Wörter (Grammatik: Regeln) haben noch Antworten, die nicht beim Server sind?
// → pendingFor(listId) = Set "<word_id>:<direction>" bzw. ruleKey(rule_id)
async function pendingKeys() {
  const entries = [...(me ? await store.pending(me.id).catch(() => []) : []), ...unqueued.values()];
  const byList = new Map();
  for (const e of entries) {
    if (!byList.has(e.list_id)) byList.set(e.list_id, new Set());
    byList.get(e.list_id).add(e.rule_id != null ? ruleKey(e.rule_id) : `${e.word_id}:${e.direction}`);
  }
  return (listId) => byList.get(listId) ?? new Set();
}

const wordIdsOf = (list) => new Set(list.words.map((w) => w.id));
const isGrammar = (list) => list.kind === 'grammar';

// Lernstand der Liste mit dem vom Server abgleichen; filter: Zeilen gelöschter Wörter/Regeln fallen weg
const mergeFor = (list, local, server, pending, filter = true) => (isGrammar(list)
  ? mergeRuleProgress(local, server, pending, filter ? new Set(list.rules.map((r) => r.id)) : null)
  : mergeProgress(local, server, pending, filter ? wordIdsOf(list) : null));

// Listen und eigenen Lernstand auf das Gerät laden (bei jeder Verbindung, z. B. im Schul-WLAN).
// Antworten, die das Gerät hat und der Server noch nicht, bleiben erhalten.
async function download() {
  const data = await request('GET', '/offline');
  const pendingFor = await pendingKeys();
  // Vorhandene Listen in place aktualisieren: Eine offene Lernrunde arbeitet mit genau diesen Objekten
  const before = new Map((offlineData?.lists ?? []).map((l) => [l.id, l]));
  data.lists = data.lists.map((fresh) => {
    const old = before.get(fresh.id);
    if (!old) return fresh;
    return Object.assign(old, fresh, { progress: mergeFor(fresh, old.progress, fresh.progress, pendingFor(fresh.id)) });
  });
  offlineData = data;
  await store.save(`offline:${me.id}`, data);
  await store.save('lastUser', me);
}

// Gespeicherte Antworten übertragen (in Teilen, nacheinander). Läuft höchstens einmal gleichzeitig;
// kommen währenddessen neue Antworten dazu, folgt gleich eine weitere Runde.
let syncing = null;
let syncAgain = false;
const progressListeners = new Set(); // Lernansicht: neuen Stand vom Server übernehmen

function syncNow() {
  if (!me) return Promise.resolve();
  if (syncing) {
    syncAgain = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        syncAgain = false;
        await pushAnswers();
      } while (syncAgain);
      needsLogin = false;
    } catch (err) {
      if (err instanceof AuthError) needsLogin = true;
      if (!(err instanceof OfflineError || err instanceof AuthError)) throw err;
    } finally {
      syncing = null;
      renderNet();
    }
  })();
  return syncing;
}

async function pushAnswers() {
  for (;;) {
    const batch = (await store.pending(me.id)).slice(0, 500);
    if (!batch.length) return;
    renderNet();
    const res = await request('POST', '/results', { results: batch });
    await store.done(batch.map((e) => e.id));
    const pendingFor = await pendingKeys(); // was inzwischen neu beantwortet wurde
    if (offlineData) {
      for (const list of offlineData.lists) {
        if (res.progress[list.id]) list.progress = mergeFor(list, list.progress, res.progress[list.id], pendingFor(list.id), false);
      }
      await store.save(`offline:${me.id}`, offlineData);
    }
    for (const fn of progressListeners) fn(res.progress, pendingFor);
  }
}

// Wieder im WLAN? Übertragen und Listen auffrischen. Wird regelmäßig und beim Zurückkehren in die App versucht.
async function reconnect() {
  if (!me) return;
  const waiting = (await store.pending(me.id).catch(() => [])).length;
  if (online && !waiting) return;
  const wasOffline = !online;
  try {
    await syncNow();
    await download();
  } catch {
    return;
  }
  // Startseite mit den frischen Daten neu zeichnen (eine laufende Lernrunde nicht stören)
  if (wasOffline && !location.hash.startsWith('#/learn') && !location.hash.startsWith('#/edit')) route();
}

function renderLogin() {
  renderUser();
  const parts = [
    h('h1', {}, settings.appName || 'Vokabeltrainer'),
    h('p', { class: 'lead' }, 'Vokabeln und Grammatik lernen – mit Karteikarten, Auswählen, Eintippen, Lückensätzen und Hörübungen, mit den Listen deiner Lehrkräfte.'),
  ];
  if (settings.oidc) parts.push(h('a', { class: 'btn primary big', href: '/auth/login' }, settings.loginLabel || 'Anmelden'));
  if (settings.remember) parts.push(h('label', { class: 'check remember' },
    h('input', { type: 'checkbox', checked: remembering(), onchange: (e) => {
      pref('remember', e.target.checked ? 'on' : 'off');
      if (!e.target.checked) store.remove('deviceToken').catch(() => {});
    } }),
    'Auf diesem Gerät angemeldet bleiben',
    h('small', { class: 'muted' }, 'Auf geteilten Geräten bitte ausschalten.')));
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
  if (!online) parts.push(h('p', { class: 'warn' }, 'Keine Internetverbindung. Zum Anmelden wird Internet gebraucht, z. B. das Schul-WLAN.'));
  const waitingNote = h('p', { class: 'small muted' });
  parts.push(waitingNote);
  view(h('section', { class: 'login panel' }, parts));
  // Antworten einer abgelaufenen Sitzung warten noch auf dem Gerät?
  store.load('lastUser').then(async (last) => {
    const n = last ? (await store.pending(last.id)).length : 0;
    if (n) waitingNote.textContent = `Auf diesem Gerät ${n === 1 ? 'wartet' : 'warten'} noch ${answersText(n)} von ${last.name}. ${n === 1 ? 'Sie wird' : 'Sie werden'} nach der Anmeldung übertragen.`;
  }).catch(() => {});
}

// ---------- Startseite ----------

// Sprachzeile einer Karte: Vokabeln „Englisch ↔ Deutsch“ bzw. „Deutsch: Begriff ↔ Bedeutung“, Grammatik nur die Sprache
const langsLine = (list) => (isGrammar(list) ? list.lang_a || 'Grammatik'
  : sameLanguage(list) ? `${list.lang_a}: Begriff ↔ Bedeutung` : `${langLabel(list, 'a')} ↔ ${langLabel(list, 'b')}`);
// Größe einer Liste: Wörter bzw. Regeln und Aufgaben
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sizeParts = (list) => (isGrammar(list)
  ? [plural(list.rule_count, 'Regel', 'Regeln'), plural(list.item_count, 'Aufgabe', 'Aufgaben')]
  : [plural(list.word_count, 'Wort', 'Wörter')]);

function listCard(list, { own }) {
  const total = isGrammar(list) ? list.rule_count : list.word_count;
  const meta = [
    list.grade ? gradeLabel(list.grade) : null,
    ...sizeParts(list),
    isGrammar(list) ? null : modeLabel(list.mode),
  ].filter(Boolean);
  if (!own && list.owner_name) meta.push(`von ${list.owner_name}`);
  return h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, list.title),
      h('span', { class: 'langs' }, langsLine(list)),
    ),
    isGrammar(list) ? h('div', { class: 'chips' }, h('span', { class: 'chip grammar' }, 'Grammatik')) : null,
    h('p', { class: 'muted small' }, meta.join(' · ')),
    own && list.copied_from ? h('p', { class: 'muted small' }, `Kopie von: ${list.copied_from}`) : null,
    own && list.shared ? h('div', { class: 'chips' }, h('span', { class: 'chip shared' }, 'Für Kolleg:innen freigegeben')) : null,
    list.progress.due ? h('div', { class: 'chips' }, h('span', { class: 'chip due' }, `${list.progress.due} heute fällig`)) : null,
    own && list.groups?.length
      ? h('div', { class: 'chips' }, list.groups.map((g) => h('span', { class: 'chip' }, g.name)))
      : own ? h('p', { class: 'warn small' }, 'Noch keiner Gruppe zugewiesen') : null,
    !own || list.progress.seen
      ? h('div', { class: 'progress' },
          progressBar(list.progress.safe, total, 'Sicher gelernt'),
          h('span', { class: 'small muted' }, `${list.progress.safe} von ${total} ${isGrammar(list) ? 'Regeln ' : ''}sicher · zuletzt ${formatDate(list.progress.last_seen)}`))
      : null,
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: `#/learn/${list.id}` }, 'Lernen'),
      own ? h('a', { class: 'btn', href: `#/edit/${list.id}` }, 'Bearbeiten') : null,
      own ? h('a', { class: 'btn', href: `#/stats/${list.id}` }, 'Auswertung') : null,
    ),
  );
}

async function renderHome() {
  let data = null;
  if (online) {
    try {
      data = await api('GET', `/lists?due_until=${encodeURIComponent(endOfToday().toISOString())}`);
    } catch (err) {
      if (!(err instanceof OfflineError)) throw err;
    }
  }
  if (!data) return renderHomeOffline();
  renderHomeLists(data);
}

// Ohne Internet: die auf dem Gerät gespeicherten Listen mit dem Lernstand auf dem Gerät
function renderHomeOffline() {
  const lists = offlineData?.lists ?? [];
  const assigned = lists.map((l) => ({
    ...l,
    word_count: l.words?.length ?? 0,
    rule_count: l.rules?.length ?? 0,
    item_count: (l.rules ?? []).reduce((sum, r) => sum + r.items.length, 0),
    progress: summarize(l.progress, endOfToday(), isGrammar(l) ? 'rule_id' : 'word_id'),
  }));
  const note = h('section', { class: 'panel offline-note' },
    h('h2', {}, 'Du bist offline'),
    h('p', { class: 'small muted' }, lists.length
      ? `Du kannst mit den gespeicherten Listen weiterlernen (Stand: ${offlineData.at ? new Date(offlineData.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'unbekannt'}). Deine Antworten werden übertragen, sobald das Gerät wieder im Schul-WLAN ist.`
      : 'Auf diesem Gerät sind noch keine Listen gespeichert. Öffne die App einmal mit Internet, z. B. im Schul-WLAN – dann kannst du auch zu Hause lernen.'),
    me.isTeacher ? h('p', { class: 'small muted' }, 'Eigene Listen bearbeiten und auswerten geht nur mit Internet.') : null,
  );
  renderHomeLists({ own: [], assigned }, { offline: true, note });
}

function renderHomeLists({ own, assigned }, { offline = false, note = null } = {}) {
  const sections = [note];
  const dueLists = [...own, ...assigned].filter((l) => l.progress.due);
  const dueOf = (grammar) => dueLists.filter((l) => isGrammar(l) === grammar).reduce((sum, l) => sum + l.progress.due, 0);
  const dueWords = dueOf(false);
  const dueRules = dueOf(true);
  if (dueWords + dueRules) {
    const what = [dueWords && `${dueWords} ${dueWords === 1 ? 'Wort' : 'Wörter'}`, dueRules && `${dueRules} ${dueRules === 1 ? 'Regel' : 'Regeln'}`].filter(Boolean).join(' und ');
    sections.push(h('section', { class: 'panel due-banner' },
      h('h2', {}, `Heute fällig: ${what}`),
      h('p', { class: 'small muted' }, 'Jetzt wiederholen, bevor du sie vergisst – das dauert nur ein paar Minuten.'),
      h('div', { class: 'actions' }, dueLists.map((l) => h('a', { class: 'btn', href: `#/learn/${l.id}` }, `${l.title} (${l.progress.due})`))),
    ));
  }
  if (me.isTeacher && !offline) {
    sections.push(
      h('section', {},
        h('div', { class: 'section-head' },
          h('h2', {}, 'Meine Listen'),
          h('div', { class: 'actions' },
            h('a', { class: 'btn', href: '#/shared' }, 'Geteilte Listen'),
            h('a', { class: 'btn primary', href: '#/edit/new' }, '+ Neue Vokabelliste'),
            h('a', { class: 'btn primary', href: '#/edit/new-grammar' }, '+ Neue Grammatikliste'))),
        own.length
          ? h('div', { class: 'grid' }, own.map((l) => listCard(l, { own: true })))
          : h('p', { class: 'empty' }, 'Du hast noch keine Listen. Lege eine Vokabel- oder Grammatikliste an oder importiere eine CSV-Datei.'),
      ),
    );
  }
  if (!me.isTeacher || assigned.length) {
    sections.push(
      h('section', {},
        h('div', { class: 'section-head' }, h('h2', {}, me.isTeacher ? 'Meinen Gruppen zugewiesen' : 'Meine Listen')),
        assigned.length
          ? h('div', { class: 'grid' }, assigned.map((l) => listCard(l, { own: false })))
          : offline ? null : h('p', { class: 'empty' }, 'Für deine Klassen und Kurse gibt es noch keine Listen.'),
      ),
    );
  }
  view(...sections);
}

// ---------- Editor (Lehrkräfte) ----------

// Editor öffnen: neue Vokabelliste, neue Grammatikliste oder eine bestehende (je nach Art)
async function openEditor(id) {
  if (id === 'new') return renderEditor('new');
  if (id === 'new-grammar') return renderGrammarEditor(ctx, null);
  const list = await api('GET', `/lists/${id}`);
  if (!list.is_owner) throw new Error('Nur die Ersteller:in darf diese Liste bearbeiten.');
  return isGrammar(list) ? renderGrammarEditor(ctx, list) : renderEditor(id, list);
}

async function renderEditor(id, loaded = null) {
  const isNew = id === 'new';
  const list = isNew
    ? { title: '', lang_a: 'Englisch', lang_b: 'Deutsch', mode: 'auto', case_sensitive: false, accent_sensitive: true, direction: 'ab', allow_switch: true, allow_mode_switch: true, shared: false, groups: [], words: [] }
    : loaded ?? await api('GET', `/lists/${id}`);
  if (!isNew && !list.is_owner) throw new Error('Nur die Ersteller:in darf diese Liste bearbeiten.');

  let dirty = false;
  const markDirty = () => { dirty = true; };
  leaveGuard = () => !dirty || confirm('Ungespeicherte Änderungen verwerfen?');
  window.onbeforeunload = (e) => { if (dirty) e.preventDefault(); };

  const title = h('input', { value: list.title, required: true, maxLength: 200, placeholder: 'z. B. Unit 3 – At the zoo' });
  const langA = languageSelect(list.lang_a, langTag);
  // Pflichtangabe; ältere Listen haben noch keine und müssen beim nächsten Speichern eine bekommen
  const grade = h('select', { required: true },
    h('option', { value: '', selected: !list.grade }, 'Bitte wählen …'),
    GRADES.map((g) => h('option', { value: String(g), selected: list.grade === g }, `Jahrgang ${g}`)));
  const langB = languageSelect(list.lang_b, langTag);
  // Welche Seite gelernt wird (die Fremdsprache, bei DaZ Deutsch). Ohne eigene Wahl folgt sie den Sprachen.
  const learnSel = h('select', {}, h('option', { value: 'a' }), h('option', { value: 'b' }));
  learnSel.value = learnSide(list);
  let learnChosen = !!list.learn_side;
  // „input“ kommt vor „change“ und erreicht das Formular (refreshDirectionLabels) erst danach
  learnSel.addEventListener('input', () => { learnChosen = true; });
  const learnField = field('Gelernt wird', learnSel, 'Die Sprache, die die Schüler:innen lernen – bei DaZ: Deutsch. Danach richten sich Lückentexte, Hören und der KI-Prompt.');

  const modeInputs = Object.fromEntries(['auto', 'flip', 'type', 'choice'].map((m) =>
    [m, h('input', { type: 'radio', name: 'mode', value: m, checked: list.mode === m })]));
  const selectedMode = () => Object.keys(modeInputs).find((m) => modeInputs[m].checked) ?? 'auto';
  const caseSens = h('input', { type: 'checkbox', checked: list.case_sensitive });
  const accentSens = h('input', { type: 'checkbox', checked: list.accent_sensitive });
  const typeOptions = h('div', { class: 'suboptions' },
    h('label', { class: 'check' }, caseSens, 'Groß-/Kleinschreibung beachten', h('small', { class: 'muted' }, ' (z. B. für deutsche Nomen)')),
    h('label', { class: 'check' }, accentSens, 'Akzente und Umlaute beachten', h('small', { class: 'muted' }, ' (é ≠ e, ü ≠ u)')),
    h('p', { class: 'small muted' }, 'Mehrere richtige Lösungen mit „;“ trennen (big; large). Teile in Klammern sind optional: „(to) go“.'),
  );
  const allowModeSwitch = h('input', { type: 'checkbox', checked: list.allow_mode_switch });
  // Regeln fürs Eintippen zeigen, wenn eingetippt werden kann – auch weil Schüler:innen dorthin wechseln dürfen
  const syncMode = () => { typeOptions.hidden = !['auto', 'type'].includes(selectedMode()) && !allowModeSwitch.checked; };
  for (const input of [...Object.values(modeInputs), allowModeSwitch]) input.onchange = () => { syncMode(); markDirty(); };
  syncMode();

  const direction = h('select', {},
    ['ab', 'ba', 'mixed'].map((d) => h('option', { value: d, selected: list.direction === d }, '')));
  const currentLangs = () => ({ lang_a: langA.value, lang_b: langB.value, learn_side: learnSel.value });
  const refreshDirectionLabels = () => {
    if (!learnChosen) learnSel.value = learnSide({ lang_a: langA.value, lang_b: langB.value });
    const tmp = currentLangs();
    [...direction.options].forEach((o) => { o.textContent = directionLabel(tmp, o.value); });
    colA.textContent = langLabel(tmp, 'a');
    colB.textContent = langLabel(tmp, 'b');
    // Welche Seite gelernt wird, ist nur bei zwei verschiedenen Sprachen eine Frage
    learnField.hidden = sameLanguage(tmp) || !tmp.lang_a || !tmp.lang_b;
    learnSel.options[0].textContent = tmp.lang_a || 'Seite A';
    learnSel.options[1].textContent = tmp.lang_b || 'Seite B';
  };
  const allowSwitch = h('input', { type: 'checkbox', checked: list.allow_switch });
  const shared = h('input', { type: 'checkbox', checked: list.shared });

  // Gruppen: eigene Gruppen der Lehrkraft + bereits zugewiesene
  const groups = groupPicker(list, me.groups, markDirty);

  // Wortliste
  const colA = h('th', {});
  const colB = h('th', {});
  const tbody = h('tbody', {});
  const counter = h('span', { class: 'muted small' });
  const updateCount = () => {
    const n = [...tbody.rows].filter((r) => r.querySelector('.a').value.trim() || r.querySelector('.b').value.trim()).length;
    counter.textContent = `${n} ${n === 1 ? 'Wort' : 'Wörter'}`;
  };
  function addRow(w = { a: '', b: '', note: '', example: '' }, focus = false) {
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
      h('td', {}, h('input', { class: 'example', value: w.example ?? '', 'aria-label': 'Beispielsatz', placeholder: 'optional', onkeydown: onKey })),
      h('td', {}, h('button', { type: 'button', class: 'icon', title: 'Zeile löschen', 'aria-label': 'Zeile löschen', onclick: () => { row.remove(); if (!tbody.rows.length) addRow(); markDirty(); updateCount(); } }, '×')),
    );
    tbody.append(row);
    if (focus) row.querySelector('.a').focus();
    updateCount();
    checkGap(row);
    return row;
  }

  // Beispielsatz, aus dem kein Lückentext wird (Wort nicht im Satz, nichts markiert): markieren
  function checkGap(row) {
    const input = row.querySelector('.example');
    const problem = gapProblem({ a: row.querySelector('.a').value, b: row.querySelector('.b').value, example: input.value });
    input.classList.toggle('gap-missing', problem);
    input.title = problem ? 'Das Wort steht so nicht im Satz – mit „Lücke“ markieren, sonst gibt es keinen Lückentext.' : '';
  }
  for (const w of list.words) addRow(w);
  if (!list.words.length) for (let i = 0; i < 5; i++) addRow();

  const readWords = () => [...tbody.rows]
    .map((r) => ({
      id: r.dataset.id ? Number(r.dataset.id) : undefined,
      a: r.querySelector('.a').value,
      b: r.querySelector('.b').value,
      note: r.querySelector('.note').value,
      example: r.querySelector('.example').value,
    }))
    .filter((w) => w.a.trim() || w.b.trim());

  // Wörter übernehmen – aus einer Datei oder aus eingefügtem Text (KI, Excel, Dokument)
  function importWords({ words, header }, { replace, name } = {}) {
    if (replace) tbody.replaceChildren();
    else [...tbody.rows].forEach((r) => { if (!r.querySelector('.a').value.trim() && !r.querySelector('.b').value.trim()) r.remove(); });
    for (const w of words) addRow(w);
    if (header) {
      if (!langA.value || isNew) langA.setLanguage(header[0]);
      if (!langB.value || isNew) langB.setLanguage(header[1]);
      refreshDirectionLabels();
    }
    if (lastCell && !lastCell.isConnected) lastCell = null;
    syncToolbar();
    if (!title.value.trim() && name) title.value = name;
    markDirty();
    toast(`${words.length} ${words.length === 1 ? 'Wort' : 'Wörter'} übernommen.`);
  }
  const askReplace = (n) => !readWords().length
    || confirm(`${n} Wörter gefunden.\n\nOK = vorhandene ${readWords().length} Wörter ersetzen\nAbbrechen = anhängen`);

  const fileInput = h('input', { type: 'file', accept: '.csv,.tsv,.txt,.md,text/csv,text/plain,text/markdown', hidden: true });
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const parsed = textToWords(await file.text());
    if (!parsed.words.length) return toast('In der Datei wurden keine Wörter gefunden.', 'error');
    importWords(parsed, { replace: askReplace(parsed.words.length), name: file.name.replace(/\.[^.]+$/, '') });
  };

  // Mit KI erstellen: Prompt kopieren, Antwort einfügen, Vorschau prüfen, übernehmen
  const topic = h('input', { placeholder: 'z. B. Essen und Trinken, Unit 3', maxLength: 100 });
  const amount = h('input', { type: 'number', min: 5, max: 100, value: 20 });
  const promptBox = h('textarea', { class: 'prompt-text', readOnly: true, rows: 7, 'aria-label': 'Prompt für die KI' });
  const syncPrompt = () => {
    promptBox.value = aiPrompt({
      langA: langA.value || 'Englisch', langB: langB.value || 'Deutsch', learn: learnSel.value,
      grade: Number(grade.value) || null, topic: topic.value, count: Math.min(100, Math.max(5, Number(amount.value) || 20)),
    });
  };
  const copyPrompt = async () => {
    syncPrompt();
    try {
      await navigator.clipboard.writeText(promptBox.value);
      toast('Prompt kopiert – jetzt in die KI einfügen.');
    } catch {
      promptBox.select();
      toast('Bitte den markierten Text kopieren (Strg+C bzw. Teilen → Kopieren).', 'warn');
    }
  };
  const pasteBox = h('textarea', { rows: 8, placeholder: 'Antwort der KI, eine aus Excel kopierte Tabelle oder Zeilen wie „dog – Hund“ hier einfügen …', 'aria-label': 'Text mit Wörtern' });
  const preview = h('div', { class: 'import-preview', 'aria-live': 'polite' });
  const takeReplace = h('button', { type: 'button', class: 'btn primary', disabled: true }, 'Übernehmen (ersetzen)');
  const takeAppend = h('button', { type: 'button', class: 'btn', disabled: true }, 'Anhängen');
  let pasted = { words: [] };
  const syncPreview = () => {
    pasted = textToWords(pasteBox.value);
    const n = pasted.words.length;
    takeReplace.disabled = takeAppend.disabled = !n;
    if (!pasteBox.value.trim()) return fill(preview);
    if (!n) return fill(preview, h('p', { class: 'warn small' }, 'Keine Wörter erkannt. Erwartet werden zwei Spalten, z. B. „dog;Hund“, „dog – Hund“ oder eine Tabelle.'));
    fill(preview,
      h('p', { class: 'small' }, h('strong', {}, `${n} ${n === 1 ? 'Wort' : 'Wörter'} erkannt`), pasted.format ? ` (${pasted.format}${pasted.header ? ', mit Kopfzeile' : ''})` : '', n > 5 ? ' – die ersten 5:' : ':'),
      h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, ['A', 'B', 'Notiz', 'Beispielsatz'].map((t, i) => h('th', {}, pasted.header?.[i] ?? t)))),
        h('tbody', {}, pasted.words.slice(0, 5).map((w) => h('tr', {}, [w.a, w.b, w.note, w.example].map((t) => h('td', {}, t)))))));
  };
  pasteBox.oninput = syncPreview;
  const take = (replace) => {
    if (!pasted.words.length) return;
    // Abbrechen lässt alles, wie es ist – zum Anhängen gibt es die eigene Schaltfläche
    if (replace && readWords().length && !confirm(`Die vorhandenen ${readWords().length} Wörter ersetzen?`)) return;
    importWords(pasted, { replace });
    pasteBox.value = '';
    syncPreview();
    importPanel.open = false;
  };
  takeReplace.onclick = () => take(true);
  takeAppend.onclick = () => take(false);
  const importPanel = h('details', { class: 'import-panel', ontoggle: () => syncPrompt() },
    h('summary', {}, 'Mit KI erstellen oder Text einfügen'),
    h('div', { class: 'import-steps' },
      h('div', {},
        h('h3', {}, '1. Prompt für die KI'),
        h('div', { class: 'row2' }, field('Thema', topic), field('Anzahl Wörter', amount)),
        promptBox,
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: copyPrompt }, 'Prompt kopieren')),
        h('p', { class: 'small muted' }, 'Sprachen und Jahrgang kommen aus den Angaben oben. Den Prompt in die KI eurer Schule einfügen – er enthält keine personenbezogenen Daten.')),
      h('div', {},
        h('h3', {}, '2. Antwort einfügen'),
        pasteBox,
        preview,
        h('div', { class: 'actions' }, takeReplace, takeAppend))));
  for (const el of [topic, amount]) el.addEventListener('input', syncPrompt);

  // Werkzeugleiste für die Wörtertabelle: wirkt auf das zuletzt benutzte Feld
  let lastCell = null;
  const cellLang = () => {
    if (!lastCell) return null;
    const foreign = learnSide(currentLangs()) === 'b' ? langB.value : langA.value;
    return langTag(lastCell.classList.contains('b') ? langB.value : lastCell.classList.contains('a') ? langA.value : foreign);
  };
  const changed = (input) => input.dispatchEvent(new Event('input', { bubbles: true }));
  const keepFocus = (e) => e.preventDefault();
  function wrapSelection(before, after, emptyHint) {
    const input = lastCell;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start === end) return toast(emptyHint, 'warn');
    input.setRangeText(`${before}${input.value.slice(start, end)}${after}`, start, end, 'end');
    input.focus();
    changed(input);
  }
  const gapBtn = h('button', { type: 'button', class: 'btn small', onpointerdown: keepFocus, onclick: () => {
    const input = lastCell;
    if ((input.selectionEnd ?? 0) > (input.selectionStart ?? 0)) return wrapSelection('*', '*');
    const row = input.closest('tr');
    const marked = markGap(input.value, row.querySelector('.a').value) ?? markGap(input.value, row.querySelector('.b').value);
    if (!marked) return toast(/\*[^*]+\*/.test(input.value) ? 'Die Lücke ist schon markiert.' : 'Wort nicht gefunden – markiere es im Satz und tippe dann auf „Lücke“.', 'warn');
    input.value = marked;
    input.focus();
    changed(input);
  } }, '✱ Lücke');
  const optionalBtn = h('button', { type: 'button', class: 'btn small', onpointerdown: keepFocus, onclick: () => wrapSelection('(', ')', 'Erst den Teil markieren, der wegfallen darf, z. B. „to“ in „to go“.') }, '( ) optional');
  const altBtn = h('button', { type: 'button', class: 'btn small', onpointerdown: keepFocus, onclick: () => {
    const input = lastCell;
    const at = input.selectionEnd ?? input.value.length;
    input.setRangeText('; ', at, at, 'end');
    input.focus();
    changed(input);
  } }, '; Alternative');
  const allGapsBtn = h('button', { type: 'button', class: 'btn small ghost', onclick: () => {
    let done = 0;
    let missing = 0;
    for (const row of tbody.rows) {
      const input = row.querySelector('.example');
      if (!input.value.trim() || /\*[^*]+\*/.test(input.value)) continue;
      const marked = markGap(input.value, row.querySelector('.a').value) ?? markGap(input.value, row.querySelector('.b').value);
      if (marked) { input.value = marked; done++; checkGap(row); } else missing++;
    }
    if (done) markDirty();
    toast(`${done} Lücken gesetzt.${missing ? ` Bei ${missing} Sätzen steht das Wort nicht so im Satz – dort von Hand markieren.` : ''}`, missing ? 'warn' : 'info');
  } }, 'Alle Lücken setzen');
  const charRow = h('span', { class: 'charbar' });
  const toolbar = h('div', { class: 'word-toolbar', role: 'toolbar', 'aria-label': 'Bearbeiten' }, gapBtn, optionalBtn, altBtn, charRow, allGapsBtn);
  function syncToolbar() {
    const cls = lastCell?.classList;
    gapBtn.disabled = !cls?.contains('example');
    optionalBtn.disabled = altBtn.disabled = !(cls?.contains('a') || cls?.contains('b'));
    fill(charRow, editorChars(cellLang()).map((ch) => h('button', {
      type: 'button', class: 'char', onpointerdown: keepFocus, 'aria-label': `${ch} einfügen`,
      onclick: () => {
        const at = lastCell.selectionStart ?? lastCell.value.length;
        lastCell.setRangeText(ch, at, lastCell.selectionEnd ?? at, 'end');
        lastCell.focus();
        changed(lastCell);
      },
    }, ch)));
  }
  tbody.addEventListener('focusin', (e) => { if (e.target.matches('input')) { lastCell = e.target; syncToolbar(); } });
  tbody.addEventListener('input', (e) => { const row = e.target.closest('tr'); if (row) checkGap(row); });
  syncToolbar();

  const exportCsv = () => {
    const csv = wordsToCsv(readWords(), [langA.value.trim() || 'A', langB.value.trim() || 'B', 'Notiz', 'Beispielsatz']);
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
      learn_side: sameLanguage(currentLangs()) ? 'a' : learnSel.value,
      grade: Number(grade.value) || null,
      mode: selectedMode(),
      case_sensitive: caseSens.checked,
      accent_sensitive: accentSens.checked,
      direction: direction.value,
      allow_switch: allowSwitch.checked,
      allow_mode_switch: allowModeSwitch.checked,
      shared: shared.checked,
      groups: groups.selected(),
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

  const form = h('form', { class: 'editor', onsubmit: save, oninput: (e) => { markDirty(); if ([langA, langB, learnSel].includes(e.target)) { refreshDirectionLabels(); syncToolbar(); } if (e.target.closest('tbody')) updateCount(); } },
    h('div', { class: 'section-head' }, h('h1', {}, isNew ? 'Neue Liste' : 'Liste bearbeiten'), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('div', { class: 'panel' },
      field('Titel', title),
      h('div', { class: 'row2' }, field('Sprache / Seite A', langA), field('Sprache / Seite B', langB)),
      h('p', { class: 'small muted' }, 'Deutschunterricht: auf beiden Seiten Deutsch – Seite A ist dann der Begriff, Seite B die Bedeutung.'),
      h('div', { class: 'row2' }, learnField, field('Jahrgangsstufe', grade, 'Für welchen Jahrgang ist die Liste? Hilft Kolleg:innen beim Finden geteilter Listen.')),
    ),
    h('div', { class: 'panel' },
      h('h2', {}, 'Abfrage'),
      h('div', { class: 'choice' },
        h('label', { class: 'option' }, modeInputs.auto, h('strong', {}, 'Lernleiter (empfohlen)'), h('small', {}, 'Die Aufgabe passt sich an: Neue Wörter kennenlernen und auswählen, dann eintippen – mit Tipps, später im Beispielsatz oder nach Gehör.')),
        h('label', { class: 'option' }, modeInputs.flip, h('strong', {}, 'Karteikarten'), h('small', {}, 'Karte umdrehen und selbst einschätzen: gewusst oder nicht.')),
        h('label', { class: 'option' }, modeInputs.type, h('strong', {}, 'Eintippen'), h('small', {}, 'Die Übersetzung muss eingetippt werden und wird automatisch geprüft. Tipps auf Wunsch.')),
        h('label', { class: 'option' }, modeInputs.choice, h('strong', {}, 'Auswählen'), h('small', {}, 'Aus vier Antworten die richtige wählen. Leichter; ein Wort gilt so aber erst spät als „sicher“.')),
      ),
      h('label', { class: 'check' }, allowModeSwitch, 'Schüler:innen dürfen die Abfrageart wechseln',
        h('small', { class: 'muted' }, ' (z. B. Karteikarten vor einem Test) – die Auswahl oben ist voreingestellt')),
      typeOptions,
      h('div', { class: 'row2' },
        field('Abfragerichtung', direction),
        h('label', { class: 'check align-end' }, allowSwitch, 'Schüler:innen dürfen die Richtung wechseln'),
      ),
    ),
    h('div', { class: 'panel' },
      h('h2', {}, 'Für wen?'),
      h('p', { class: 'small muted' }, 'Nur Mitglieder der gewählten Gruppen sehen die Liste.'),
      groups.filter,
      groups.box,
      h('label', { class: 'check share-option' }, shared,
        h('span', {}, h('strong', {}, 'Für Kolleg:innen freigeben'),
          h('small', { class: 'muted' }, ' – andere Lehrkräfte können die Liste ansehen und eine eigene Kopie anlegen. Lernstände werden nicht geteilt.'))),
      list.copied_from ? h('p', { class: 'small muted' }, `Kopie von: ${list.copied_from}`) : null,
    ),
    h('div', { class: 'panel' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Wörter ', counter),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Datei importieren'),
          h('button', { type: 'button', class: 'btn', onclick: exportCsv }, 'CSV exportieren'),
          fileInput,
        ),
      ),
      importPanel,
      h('p', { class: 'small muted' }, 'Datei: CSV, Text oder Markdown – Spalten Seite A, Seite B, optional Notiz und Beispielsatz. Mit Enter springst du in die nächste Zeile.'),
      h('p', { class: 'small muted' }, 'Beispielsatz: Kommt das Wort darin vor, wird daraus in der Lernleiter ein Lückentext. Gebeugte Formen markieren: Wort im Satz auswählen und „✱ Lücke“ tippen („Yesterday I *went* home.“). Rot umrandete Sätze ergeben noch keinen Lückentext.'),
      toolbar,
      h('div', { class: 'table-wrap' },
        h('table', { class: 'words' },
          h('thead', {}, h('tr', {}, colA, colB, h('th', {}, 'Notiz'), h('th', {}, 'Beispielsatz'), h('th', {}))),
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

// Liste zum Lernen: mit Internet frisch vom Server, sonst vom Gerät.
// Zugewiesene Listen sind dasselbe Objekt wie in offlineData – Antworten landen so auch im Gerätespeicher.
async function learnableList(id) {
  const cached = offlineData?.lists.find((l) => l.id === Number(id));
  if (online) {
    try {
      const list = await api('GET', `/lists/${id}`);
      if (!cached) return list;
      const pendingFor = await pendingKeys();
      Object.assign(cached, list, { progress: mergeFor(list, cached.progress, list.progress, pendingFor(cached.id)) });
      store.save(`offline:${me.id}`, offlineData).catch(() => {});
      return cached;
    } catch (err) {
      if (!(err instanceof OfflineError)) throw err;
    }
  }
  if (!cached) throw new Error('Diese Liste ist auf diesem Gerät nicht gespeichert. Öffne sie einmal mit Internet, z. B. im Schul-WLAN.');
  return cached;
}

async function renderLearn(id) {
  const list = await learnableList(id);
  if (isGrammar(list)) return renderGrammarLearn(ctx, list);
  if (!list.words.length) throw new Error('Diese Liste enthält keine Wörter.');
  const progress = new Map(list.progress.map((p) => [`${p.word_id}:${p.direction}`, p]));
  const key = (wordId, dir) => `${wordId}:${dir}`;

  let direction = list.direction;
  // Abfrageart: von der Lehrkraft vorgegeben; wenn erlaubt, wählen Schüler:innen selbst
  // (pro Person und Liste gemerkt – auf geteilten Geräten übernimmt niemand die Wahl eines anderen)
  const modeKey = `mode.${me.id}.${list.id}`;
  const chosenMode = pref(modeKey);
  let askMode = list.allow_mode_switch && MODE_LABELS[chosenMode] ? chosenMode : list.mode;
  let size = '20';
  let mode = null; // 'due' (Heute fällig) oder 'free' (Frei üben)

  const dirsFor = () => (direction === 'mixed' ? ['ab', 'ba'] : [direction]);

  // Aussprache: nur, wenn das Gerät eine Stimme für die Sprache hat
  await voicesReady();
  const learned = learnSide(list);
  const langs = { langA: list.lang_a, langB: list.lang_b, learn: learned };
  const speech = { a: speechLang(list.lang_a), b: speechLang(list.lang_b) };
  // lang-Attribute: eigene Kennung, auch für Sprachen ohne Stimme (Latein → la)
  const tags = { a: langTag(list.lang_a), b: langTag(list.lang_b) };
  // Sonderzeichen je Antwortseite (é, ñ, ¿ …), einmal pro Liste berechnet
  const charsFor = { a: specialChars(list.words, 'a'), b: specialChars(list.words, 'b') };
  const speakable = (side) => canSpeak(speech[side]);
  // Seite, deren Aussprache geübt wird: die gelernte Sprache (bei DaZ also Deutsch)
  const foreign = speakable(learned) ? learned : null;
  const label = (side) => (side === 'a' ? list.lang_a : list.lang_b);
  // Die deutsche Seite, wenn Deutsch nicht gelernt wird (Englisch ↔ Deutsch): Sie wird nicht vorgelesen
  const nativeGerman = (side) => side !== learned && isGermanLabel(label(side));
  // Hören: nur Wörter der gelernten Seite. Ältere Listen ohne Einstellung mit zwei Fremdsprachen
  // (Französisch ↔ Englisch) wie bisher auf beiden Seiten.
  const listenSide = (side) => side === learned || (!list.learn_side && !isGermanLabel(list.lang_a) && !isGermanLabel(list.lang_b));
  let sound = !!foreign && pref('sound') === 'on';

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
      h('p', { class: 'muted' }, [`${list.words.length} Wörter`, list.is_owner ? null : list.owner_name && `von ${list.owner_name}`].filter(Boolean).join(' · ')),
      h('div', { class: 'progress' }, progressBar(safe, list.words.length, 'Sicher gelernt'), h('span', { class: 'small muted' }, `${safe} von ${list.words.length} sicher gelernt`)),
      h('h2', {}, 'Modus'),
      segmented('Modus', [['due', `Heute fällig${due ? ` (${due})` : ''}`], ['free', 'Frei üben']], mode, (m) => { mode = m; setupView(); }),
      modeInfo,
      h('h2', {}, 'Abfrage'),
      list.allow_mode_switch
        ? segmented('Abfrage', Object.entries(MODE_LABELS), askMode, (m) => { askMode = m; pref(modeKey, m); setupView(); })
        : h('p', {}, modeLabel(askMode)),
      h('p', { class: 'small muted' }, MODE_HINTS[askMode]),
      h('h2', {}, 'Richtung'),
      list.allow_switch
        ? segmented('Richtung', ['ab', 'ba', 'mixed'].map((d) => [d, directionLabel(list, d)]), direction, (d) => { direction = d; setupView(); })
        : h('p', {}, directionLabel(list, direction)),
      foreign
        ? [
            h('h2', {}, 'Ton'),
            segmented('Ton', [['off', 'Aus'], ['on', 'An']], sound ? 'on' : 'off', (v) => { sound = v === 'on'; pref('sound', v); setupView(); }),
            h('p', { class: 'small muted' }, sound
              ? 'Wörter werden vorgelesen, dazu kommen Hörübungen – am besten mit Kopfhörern.'
              : 'Mit Ton werden Wörter vorgelesen und es gibt Hörübungen. Über den Lautsprecher-Knopf kannst du Wörter jederzeit anhören.'),
          ]
        : null,
      h('h2', {}, 'Wie viele Wörter?'),
      segmented('Anzahl', [['10', '10'], ['20', '20'], ['all', `Alle${mode === 'free' ? ` (${list.words.length})` : ''}`]], size, (s) => { size = s; setupView(); }),
      nothingToDo
        ? h('p', { class: 'done-today' }, 'Für heute ist alles erledigt.',
            next ? h('span', { class: 'small muted' }, ` Nächste Wiederholung: ${formatDue(next)}.`) : null)
        : null,
      h('div', { class: 'actions' },
        nothingToDo
          ? h('button', { class: 'btn primary big', onclick: () => { mode = 'free'; setupView(); } }, 'Trotzdem frei üben')
          : h('button', { class: 'btn primary big', onclick: () => startRound(pick()) }, 'Los geht’s'),
        list.progress.length ? h('button', { class: 'btn ghost', onclick: resetProgress, disabled: !online }, 'Lernstand zurücksetzen') : null,
        list.can_copy && !list.is_owner ? h('button', { class: 'btn', onclick: () => copyList(list) }, 'In meine Listen kopieren') : null,
      ),
    ));
  };

  async function resetProgress() {
    if (!online) return toast('Zurücksetzen geht nur mit Internet.', 'warn');
    if (!confirm('Deinen Lernstand für diese Liste wirklich zurücksetzen?')) return;
    // Erst alles übertragen und laufende Übertragungen abwarten – sonst könnte eine späte Antwort vom
    // Server den alten Stand nach dem Zurücksetzen wiederherstellen.
    await writes;
    await syncNow();
    try {
      await api('DELETE', `/lists/${id}/progress`);
    } catch (err) {
      return toast(err.message, 'error');
    }
    // Was trotzdem noch wartet (Übertragung fehlgeschlagen), gehört zum alten Stand
    const stale = (await store.pending(me.id)).filter((e) => e.list_id === list.id);
    await store.done(stale.map((e) => e.id));
    progress.clear();
    list.progress = [];
    if (offlineData) store.save(`offline:${me.id}`, offlineData).catch(() => {});
    renderNet();
    mode = null;
    setupView();
  }

  // Antwort sofort auf dem Gerät verplanen (wie der Server) und für die Übertragung merken.
  // Schreibvorgänge laufen nacheinander (writes); übertragen wird im Hintergrund, auch ohne Internet kein Fehler.
  let writes = Promise.resolve();
  function record(card, grade, correct) {
    const entry = {
      id: newId(), user: me.id, list_id: list.id, word_id: card.word.id, direction: card.dir,
      grade, correct, exercise: card.exercise, at: new Date().toISOString(),
    };
    const k = key(card.word.id, card.dir);
    progress.set(k, answer(progress.get(k), entry, review));
    list.progress = [...progress.values()];
    writes = persistEntry(entry, writes);
  }
  // Stand vom Server übernehmen, sobald Antworten übertragen sind (wartende Antworten auf dem Gerät bleiben)
  const onProgress = (byList, pendingFor) => {
    if (!byList[list.id]) return;
    list.progress = mergeProgress(list.progress, byList[list.id], pendingFor(list.id));
    progress.clear();
    for (const p of list.progress) progress.set(key(p.word_id, p.direction), p);
  };
  progressListeners.add(onProgress);

  // ---------- Übungen ----------

  const sides = (dir) => (dir === 'ab' ? ['a', 'b'] : ['b', 'a']);

  // Ansagen nicht für die deutsche Seite, wenn Deutsch nicht gelernt wird, und nur mit einer Stimme auf dem Gerät
  function speakBtn(side, text) {
    if (!speakable(side) || nativeGerman(side)) return null;
    return h('button', {
      type: 'button', class: 'icon speak', title: 'Anhören', 'aria-label': `Anhören: ${text}`,
      onclick: (e) => { e.stopPropagation(); speak(speechText(text), speech[side]); },
    }, icon('volume'));
  }
  function autoSpeak(word) {
    if (sound && foreign) speak(speechText(word[foreign]), speech[foreign]);
  }

  // Beispielsatz mit hervorgehobener *Lücke*
  const exampleNode = (example) => example.split('*').map((part, i) => (i % 2 ? h('b', {}, part) : part));
  const details = (word, { example = true } = {}) => [
    word.note ? h('div', { class: 'note' }, word.note) : null,
    example && word.example ? h('div', { class: 'example' }, exampleNode(word.example)) : null,
  ];
  const promptBlock = (side, text, label = langLabel(list, side)) => h('div', { class: 'prompt' },
    h('span', { class: 'lang' }, label),
    h('span', { class: 'word-line' }, h('span', { class: 'word', lang: tags[side] }, text), speakBtn(side, text)));

  function chooseExercise(card) {
    const [from, to] = sides(card.dir);
    const other = card.dir === 'ab' ? 'ba' : 'ab';
    return pickExercise({
      mode: askMode,
      level: progress.get(key(card.word.id, card.dir))?.box ?? 0,
      knownOther: (progress.get(key(card.word.id, other))?.box ?? 0) > 0,
      choiceOk: !!choiceOptions(list.words, card.word, to),
      clozeOk: !!clozeFor(card.word, to, langs),
      listenOk: sound && speakable(from) && listenSide(from),
    });
  }

  function startRound(cards) {
    if (!cards.length) return setupView();
    const queue = cards.map((c) => ({ word: c.word, dir: c.dir, retry: 0 }));
    const total = cards.length;
    let done = 0;
    let right = 0;
    const wrongWords = [];

    const options = { caseSensitive: list.case_sensitive, accentSensitive: list.accent_sensitive };

    // Nur die erste Antwort zählt für die Planung. Nicht (sicher) gewusste Wörter kommen
    // nach 3–5 Karten erneut, bis sie einmal richtig sind (höchstens dreimal).
    function answered(card, grade, correct) {
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

    function next() {
      stopSpeaking();
      const card = queue.shift();
      if (!card) return finish();
      card.exercise ??= chooseExercise(card);
      const header = h('div', { class: 'round-head' },
        h('button', { class: 'btn ghost small', onclick: () => { if (confirm('Runde abbrechen?')) { cleanupKeys(); stopSpeaking(); setupView(); } } }, 'Beenden'),
        progressBar(done, total, 'Fortschritt der Runde'),
        h('span', { class: 'small muted' }, `${Math.min(done + 1, total)} / ${total}`),
      );
      const show = (...content) => view(h('section', { class: 'round' }, header,
        card.retry ? h('p', { class: 'retry small' }, 'Wiederholung') : null, ...content));
      const render = { intro: showIntro, flip: showFlip, choice: showChoice }[card.exercise] ?? showTyping;
      render(card, show);
    }

    // Neues Wort kennenlernen; die erste Abfrage folgt ein paar Karten später.
    function showIntro(card, show) {
      const [from, to] = sides(card.dir);
      function proceed() {
        const at = Math.min(queue.length, 2 + Math.floor(Math.random() * 2));
        queue.splice(at, 0, { ...card, exercise: afterIntro(!!choiceOptions(list.words, card.word, to)) });
        next();
      }
      const cont = h('button', { class: 'btn primary big', onclick: proceed }, 'Verstanden – weiter');
      setKeys((e) => {
        if (e.target === cont || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        proceed();
      });
      show(
        h('div', { class: 'exercise intro' },
          h('span', { class: 'chip new' }, 'Neues Wort'),
          promptBlock(from, card.word[from]),
          promptBlock(to, card.word[to]),
          details(card.word)),
        h('div', { class: 'actions center' }, cont),
        h('p', { class: 'small muted center' }, 'Präg dir das Wort ein – gleich wird es abgefragt.'),
      );
      cont.focus();
      autoSpeak(card.word);
    }

    function showFlip(card, show) {
      const [from, to] = sides(card.dir);
      const prompt = card.word[from];
      const solution = card.word[to];
      let flipped = false;
      const inner = h('div', { class: 'flip-inner' },
        h('div', { class: 'face front' }, h('span', { class: 'lang' }, langLabel(list, from)), h('span', { class: 'word', lang: tags[from] }, prompt)),
        h('div', { class: 'face back', 'aria-hidden': 'true' }, h('span', { class: 'lang' }, langLabel(list, to)), h('span', { class: 'word', lang: tags[to] }, solution),
          card.word.note ? h('span', { class: 'note' }, card.word.note) : null,
          card.word.example ? h('span', { class: 'example' }, exampleNode(card.word.example)) : null),
      );
      const flipCard = h('button', { class: 'flipcard', 'aria-label': `${prompt} – Karte umdrehen`, onclick: () => flip() }, inner);
      const speakRow = h('div', { class: 'actions center speak-row' }, speakBtn(from, prompt));
      const buttons = h('div', { class: 'actions center rate', hidden: true },
        h('button', { class: 'btn wrong big', onclick: () => rate('again') }, 'Nicht gewusst'),
        h('button', { class: 'btn right big', onclick: () => rate('good') }, 'Gewusst'),
        card.retry ? null : h('button', { class: 'btn easy big', onclick: () => rate('easy') }, 'Leicht'),
      );
      // Laut aussprechen hilft beim Behalten (production effect)
      const hint = h('p', { class: 'small muted center' }, 'Sag die Antwort laut – dann tippe auf die Karte oder drücke die Leertaste.');
      function flip() {
        flipped = !flipped;
        flipCard.classList.toggle('flipped', flipped);
        inner.children[0].setAttribute('aria-hidden', String(flipped));
        inner.children[1].setAttribute('aria-hidden', String(!flipped));
        flipCard.setAttribute('aria-label', flipped ? `${solution}${card.word.note ? ` – ${card.word.note}` : ''}` : `${prompt} – Karte umdrehen`);
        if (flipped && buttons.hidden) {
          fill(speakRow, speakBtn(from, prompt), speakBtn(to, solution));
          autoSpeak(card.word);
        }
        buttons.hidden = false;
        hint.textContent = card.retry ? 'Tasten: 1 / ← nicht gewusst · 2 / → gewusst' : 'Tasten: 1 / ← nicht gewusst · 2 / → gewusst · 3 / ↑ leicht';
      }
      function rate(grade) {
        if (!flipped) return;
        answered(card, grade, grade !== 'again');
        next();
      }
      setKeys((e) => {
        if ((buttons.contains(e.target) || speakRow.contains(e.target)) && (e.key === ' ' || e.key === 'Enter')) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!flipped) flip(); }
        else if (flipped && (e.key === 'ArrowLeft' || e.key === '1')) rate('again');
        else if (flipped && (e.key === 'ArrowRight' || e.key === '2')) rate('good');
        else if (flipped && !card.retry && (e.key === 'ArrowUp' || e.key === '3')) rate('easy');
      });
      show(flipCard, speakRow, buttons, hint);
      flipCard.focus();
    }

    // Aus vier Antworten auswählen
    function showChoice(card, show) {
      const [from, to] = sides(card.dir);
      const choice = choiceOptions(list.words, card.word, to);
      if (!choice) {
        card.exercise = 'type';
        return showTyping(card, show);
      }
      let picked = null;
      const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const nextBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => next() }, 'Weiter');
      const buttons = choice.options.map((text, i) => h('button', { type: 'button', class: 'choice-btn', onclick: () => pick(i) },
        h('span', { class: 'key', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, text)));
      const box = h('div', { class: 'exercise' },
        promptBlock(from, card.word[from]),
        h('div', { class: 'choices', role: 'group', 'aria-label': `Übersetzung (${langLabel(list, to)}) auswählen` }, buttons),
        feedback);
      function pick(i) {
        if (picked != null) return;
        picked = i;
        const ok = i === choice.correct;
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (j === choice.correct) b.classList.add('is-right');
          else if (j === i) b.classList.add('is-wrong');
        });
        box.classList.add(ok ? 'is-right' : 'is-wrong');
        fill(feedback,
          h('strong', {}, ok ? 'Richtig!' : 'Leider falsch.'),
          ok ? null : h('span', {}, ' Lösung: ', h('b', {}, card.word[to])),
          speakBtn(to, card.word[to]),
          details(card.word));
        answered(card, gradeFor('choice', { correct: ok }), ok);
        nextBtn.hidden = false;
        nextBtn.focus();
        autoSpeak(card.word);
      }
      setKeys((e) => {
        if (picked == null) {
          const n = Number(e.key);
          if (n >= 1 && n <= buttons.length) { e.preventDefault(); pick(n - 1); }
        } else if ((e.key === 'Enter' || e.key === ' ') && e.target !== nextBtn) {
          e.preventDefault();
          next();
        }
      });
      show(box, h('div', { class: 'actions center' }, nextBtn),
        h('p', { class: 'small muted center' }, `Tasten: 1–${buttons.length} auswählen · Enter weiter`));
    }

    // Eintippen – auch als Lückentext (cloze) und nach Gehör (listen)
    function showTyping(card, show) {
      const [from, to] = sides(card.dir);
      const prompt = card.word[from];
      const cloze = card.exercise === 'cloze' ? clozeFor(card.word, to, langs) : null;
      const listen = card.exercise === 'listen' && speakable(from);
      const solution = cloze ? cloze.gap : card.word[to];

      let promptEl;
      let gap = null;
      let heard = null;
      if (cloze) {
        gap = h('span', { class: 'gap' }, '_____');
        promptEl = h('div', { class: 'prompt' },
          h('span', { class: 'lang' }, `Lückentext · ${langLabel(list, to)}`),
          h('p', { class: 'sentence' }, cloze.before, gap, cloze.after),
          h('span', { class: 'cue' }, `(${prompt})`));
      } else if (listen) {
        const play = () => speak(speechText(prompt), speech[from]);
        heard = h('span', { class: 'word', hidden: true }, prompt);
        const reveal = h('button', { type: 'button', class: 'btn ghost small', onclick: () => { heard.hidden = false; reveal.remove(); input.focus(); } }, 'Wort anzeigen');
        promptEl = h('div', { class: 'prompt' },
          h('span', { class: 'lang' }, `Hören · ${langLabel(list, from)}`),
          h('button', { type: 'button', class: 'btn big listen', onclick: () => { play(); input.focus(); } }, [icon('volume'), ' Nochmal anhören']),
          heard, reveal);
        setTimeout(play, 150);
      } else {
        promptEl = promptBlock(from, prompt);
      }

      const input = h('input', { class: 'answer', lang: tags[to], autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': `Übersetzung (${langLabel(list, to)})`, placeholder: langLabel(list, to) });
      // Leiste mit den Sonderzeichen der Sprache (ñ, ç, œ, ¿ …) – auf deutschen Tastaturen fehlen sie.
      // pointerdown verhindern: Das Eingabefeld behält den Fokus, die Bildschirmtastatur bleibt offen.
      const chars = charsFor[to];
      const charBar = chars.length
        ? h('div', { class: 'charbar', role: 'group', 'aria-label': 'Sonderzeichen einfügen' }, chars.map((ch) => h('button', {
            type: 'button', class: 'char', lang: tags[to], 'aria-label': `${ch} einfügen`,
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => {
              if (input.readOnly) return;
              const start = input.selectionStart ?? input.value.length;
              input.setRangeText(ch, start, input.selectionEnd ?? start, 'end');
              input.focus();
            },
          }, ch)))
        : null;
      const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Prüfen');

      // Tipps: erster Buchstabe jedes Worts, dann jeweils einer mehr (Finley et al. 2011).
      // Mit Tipp gelöst zählt als „mit Mühe gewusst“.
      let hints = 0;
      const target = hintTarget(solution);
      const limit = maxHints(target);
      const pattern = h('span', { class: 'hint-pattern', 'aria-live': 'polite' });
      const hintBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: () => giveHint() }, 'Tipp');
      function giveHint() {
        if (state !== 'ask' || hints >= limit) return;
        hints++;
        pattern.textContent = hintPattern(target, hints);
        hintBtn.textContent = hints >= limit ? 'Kein Tipp mehr' : 'Noch ein Tipp';
        hintBtn.disabled = hints >= limit;
        input.focus();
      }

      let state = 'ask';
      let result = null;
      const form = h('form', { class: 'type-form', onsubmit: (e) => {
        e.preventDefault();
        if (state === 'ask') {
          if (!input.value.trim()) return;
          result = checkAnswer(input.value, solution, options);
          state = 'shown';
          input.readOnly = true;
          hintBtn.disabled = true;
          if (gap) gap.textContent = cloze.gap;
          if (heard) heard.hidden = false;
          const ok = result === 'correct';
          form.classList.add(ok ? 'is-right' : 'is-wrong');
          fill(feedback,
            h('strong', {}, ok ? 'Richtig!' : result === 'almost' ? 'Fast!' : 'Leider falsch.'),
            result === 'almost'
              ? h('span', {}, { accents: ' Achte auf Akzente und Sonderzeichen.', case: ' Achte auf Groß- und Kleinschreibung.' }[almostReason(input.value, solution, options)] ?? ' Kleiner Tippfehler.')
              : null,
            ok && !hasVariants(solution) ? null : h('span', {}, ' Lösung: ', h('b', {}, solution)),
            cloze && cloze.gap !== card.word[to] ? h('span', { class: 'muted' }, `· Vokabel: ${card.word[to]}`) : null,
            speakBtn(to, cloze ? cloze.gap : card.word[to]),
            !ok ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { result = 'override'; proceed(); } }, 'Ich hatte recht') : null,
            details(card.word, { example: !cloze }),
          );
          submit.textContent = 'Weiter';
          submit.focus();
          autoSpeak(card.word);
        } else proceed();
      } },
        promptEl,
        h('div', { class: 'hint-row' }, hintBtn, pattern),
        input, submit, charBar, feedback);
      function proceed() {
        // Tippfehler („fast“) = erinnert, aber mit Mühe; zählt als falsch und wird wiederholt.
        const correct = result === 'correct' || result === 'override';
        answered(card, gradeFor(card.exercise, { correct, almost: result === 'almost', hints }), correct);
        next();
      }
      setKeys(null);
      show(form);
      input.focus();
    }

    async function finish() {
      cleanupKeys();
      const pct = total ? Math.round((right / total) * 100) : 0;
      const outlook = h('p', { class: 'small muted' });
      const remaining = h('div', {});
      view(h('section', { class: 'panel result' },
        h('h1', {}, pct === 100 ? 'Perfekt!' : pct >= 70 ? 'Gut gemacht!' : 'Weiter üben!'),
        h('p', { class: 'score' }, `${right} von ${total} beim ersten Versuch richtig (${pct} %)`),
        outlook,
        wrongWords.length
          ? h('div', {}, h('h2', {}, 'Noch üben'),
              h('ul', { class: 'wrong-list' }, wrongWords.map((c) => h('li', {}, h('span', {}, c.word[c.dir === 'ab' ? 'a' : 'b']), ' → ', h('b', {}, c.word[c.dir === 'ab' ? 'b' : 'a'])))))
          : null,
        remaining,
        h('div', { class: 'actions' },
          wrongWords.length ? h('button', { class: 'btn', onclick: () => { mode = 'free'; startRound(shuffle(wrongWords.map((c) => ({ word: c.word, dir: c.dir })))); } }, 'Fehler wiederholen') : null,
          h('button', { class: 'btn ghost', onclick: () => setupView() }, 'Einstellungen'),
          h('a', { class: 'btn ghost', href: '#/' }, 'Zur Übersicht'),
        ),
      ));
      // Wann kommen die Wörter dieser Runde wieder? (schon auf dem Gerät verplant)
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

  leaveGuard = () => { progressListeners.delete(onProgress); cleanupKeys(); stopSpeaking(); return true; };
  setupView();
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
  if (isGrammar(stats.list)) return renderGrammarStats(ctx, stats, id);
  const n = stats.word_count;

  const groups = groupPanels(stats.groups, {
    listId: id,
    total: n,
    unit: { of: 'Wörtern', many: 'Wörter', safeLabel: 'Ø sicher (%)', hint: 'Auf einen Namen klicken, um den Lernstand pro Wort zu sehen.' },
  });
  const exportCsv = () => exportGroupsCsv(stats.list.title, stats.groups, n, 'Wörter');

  view(
    h('div', { class: 'section-head' },
      h('h1', {}, `Auswertung: ${stats.list.title}`),
      h('div', { class: 'actions' },
        stats.groups.some((g) => g.students.length) ? h('button', { class: 'btn', onclick: exportCsv }, 'Als CSV exportieren') : null,
        h('a', { class: 'btn ghost', href: '#/' }, 'Zurück'))),
    h('p', { class: 'small muted' }, '„Sicher“ = würde das Wort laut Lernplanung auch in zwei Wochen noch mit 90 % Wahrscheinlichkeit wissen (mehrmals an verschiedenen Tagen richtig). „Fällig“ = Wörter, die laut Plan jetzt wiederholt werden sollten. Es erscheinen nur Schüler:innen, die sich schon einmal angemeldet haben.'),
    groups.length ? groups : h('p', { class: 'empty' }, 'Die Liste ist keiner Gruppe zugewiesen.'),
    stats.hardest.length
      ? h('section', { class: 'panel' }, h('h2', {}, 'Schwierigste Wörter'),
          h('table', { class: 'stats' },
            h('thead', {}, h('tr', {}, h('th', {}, langLabel(stats.list, 'a')), h('th', {}, langLabel(stats.list, 'b')), h('th', {}, 'Fehlerquote'))),
            h('tbody', {}, stats.hardest.map((w) => h('tr', {}, h('td', {}, w.a), h('td', {}, w.b),
              h('td', {}, `${pct(w.wrong, w.right + w.wrong)} % (${w.wrong}×)`))))))
      : null,
  );
}

async function renderStudentStats(listId, userId) {
  const data = await api('GET', `/lists/${listId}/stats/students/${userId}`);
  if (isGrammar(data.list)) return renderGrammarStudent(ctx, data, listId);
  const { list, student, words } = data;
  const n = words.length;
  const maxLevel = (w) => Math.max(w.ab?.box ?? 0, w.ba?.box ?? 0);
  const stat = (w, f) => (w.ab?.[f] ?? 0) + (w.ba?.[f] ?? 0);
  const lastSeen = (w) => [w.ab?.last_seen, w.ba?.last_seen].filter(Boolean).sort().at(-1) ?? null;
  const safe = words.filter((w) => maxLevel(w) >= data.safe_box).length;
  const seen = words.filter((w) => w.ab || w.ba).length;
  const due = words.reduce((sum, w) => sum + [w.ab, w.ba].filter((p) => p?.due && new Date(p.due) <= new Date()).length, 0);
  const right = words.reduce((sum, w) => sum + stat(w, 'right'), 0);
  const wrong = words.reduce((sum, w) => sum + stat(w, 'wrong'), 0);

  const columns = [
    { label: langLabel(list, 'a'), value: (w) => w.a, render: (w) => w.a },
    { label: langLabel(list, 'b'), value: (w) => w.b, render: (w) => w.b },
    { label: `${langLabel(list, 'a')} → ${langLabel(list, 'b')}`, numeric: true, value: (w) => w.ab?.box ?? -1, render: (w) => levelChip(w.ab) },
    { label: `${langLabel(list, 'b')} → ${langLabel(list, 'a')}`, numeric: true, value: (w) => w.ba?.box ?? -1, render: (w) => levelChip(w.ba) },
    { label: 'Richtig / Falsch', numeric: true, value: (w) => stat(w, 'wrong') - stat(w, 'right') / 100, render: (w) => (w.ab || w.ba ? `${stat(w, 'right')} / ${stat(w, 'wrong')}` : '–') },
    { label: 'Zuletzt', numeric: true, value: (w) => (lastSeen(w) ? Date.parse(lastSeen(w)) : null), render: (w) => formatDate(lastSeen(w)) },
  ];
  // Standard: schwächste Wörter zuerst (niedrigste Stufe, dann meiste Fehler)
  const sorted = [...words].sort((a, b) => maxLevel(a) - maxLevel(b) || stat(b, 'wrong') - stat(a, 'wrong'));

  view(
    h('div', { class: 'section-head' },
      h('h1', {}, student.name),
      h('a', { class: 'btn ghost', href: `#/stats/${listId}` }, 'Zurück zur Auswertung')),
    h('p', { class: 'muted' }, list.title),
    h('section', { class: 'panel' },
      statTiles([
        ['Sicher', `${safe}`, `von ${n} Wörtern`],
        ['Geübt', `${seen}`, `von ${n} Wörtern`],
        ['Jetzt fällig', due, 'Wort-Richtungen'],
        ['Richtig / Falsch', `${right} / ${wrong}`],
      ]),
      historyPanel(data.history, { safeLabel: 'Sicher (%)' }),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Wörter'),
      h('p', { class: 'small muted' }, 'Schwächste Wörter zuerst. Stufen: neu → Anfang → lernt → sicher → sehr sicher → gefestigt. Spaltenköpfe sortieren.'),
      sortableTable(sorted, columns, { initial: null }),
    ),
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
  const languages = languagesOf(lists);
  // Filter werden im Browser gemerkt – wer Französisch unterrichtet, sieht beim nächsten Mal gleich Französisch
  const saved = (name, allowed) => { const v = pref(`shared.${name}`) ?? ''; return allowed.includes(v) ? v : ''; };
  const select = (label, name, options, current) => h('label', { class: 'filter' }, h('span', { class: 'small muted' }, label),
    h('select', { 'aria-label': label, dataset: { name }, onchange: (e) => { pref(`shared.${name}`, e.target.value); render(); } },
      options.map(([value, text]) => h('option', { value, selected: value === current }, text))));

  const langSelect = select('Sprache', 'lang', [['', 'Alle Sprachen'], ...languages.map((l) => [l.value, l.label])],
    saved('lang', languages.map((l) => l.value)));
  const gradeValues = GRADES.map(String);
  const gradeSelect = select('Jahrgang', 'grade', [['', 'Alle Jahrgänge'], ...GRADES.map((g) => [String(g), `Jahrgang ${g}`]), ['none', 'ohne Angabe']],
    saved('grade', [...gradeValues, 'none']));
  const kindSelect = select('Art', 'kind', [['', 'Vokabeln und Grammatik'], ...Object.entries(KINDS)], saved('kind', Object.keys(KINDS)));
  const sortSelect = select('Sortieren', 'sort', Object.entries(SORTS), saved('sort', Object.keys(SORTS)) || 'recent');
  const value = (wrap) => wrap.querySelector('select').value;

  const search = h('input', { type: 'search', placeholder: 'Suchen nach Titel, Sprache oder Lehrkraft …', 'aria-label': 'Geteilte Listen durchsuchen' });
  const grid = h('div', { class: 'grid' });
  const count = h('span', { class: 'muted small' });
  const card = (list) => h('article', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h3', {}, list.title),
      h('span', { class: 'langs' }, langsLine(list))),
    h('div', { class: 'chips' }, isGrammar(list) ? h('span', { class: 'chip grammar' }, 'Grammatik') : null,
      list.template ? h('span', { class: 'chip' }, 'Vorlage') : null,
      h('span', { class: `chip${list.grade ? '' : ' muted'}` }, gradeLabel(list.grade))),
    h('p', { class: 'muted small' }, [...sizeParts(list), isGrammar(list) ? null : modeLabel(list.mode),
      list.template ? 'mitgeliefert' : list.owner_name && `von ${list.owner_name}`, `geändert ${formatDate(list.updated_at)}`].filter(Boolean).join(' · ')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => copyList(list) }, 'Kopieren'),
      h('a', { class: 'btn', href: `#/learn/${list.id}` }, 'Ansehen & ausprobieren')));
  function render() {
    const hits = sortLists(filterLists(lists, { q: search.value, lang: value(langSelect), grade: value(gradeSelect), kind: value(kindSelect) }), value(sortSelect));
    count.textContent = `${hits.length} von ${lists.length} ${lists.length === 1 ? 'Liste' : 'Listen'}`;
    fill(grid, hits.length ? hits.map(card) : h('p', { class: 'empty' }, lists.length ? 'Keine passende Liste gefunden.' : 'Noch hat niemand eine Liste freigegeben.'));
  }
  search.oninput = render;
  render();
  view(
    h('div', { class: 'section-head' }, h('h1', {}, 'Geteilte Listen'), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('p', { class: 'small muted' }, 'Listen, die Kolleg:innen freigegeben haben. Kopierte Listen gehören dir und können frei bearbeitet werden.'),
    h('div', { class: 'filters' }, kindSelect, langSelect, gradeSelect, sortSelect),
    h('div', { class: 'search-row' }, search, count),
    grid,
  );
  search.focus();
}

// ---------- Grammatik-Module ----------

// Was grammar-editor.js, grammar-learn.js und grammar-stats.js von der App brauchen (me, online, offlineData
// ändern sich im Lauf – deshalb Getter)
const ctx = {
  get me() { return me; },
  get online() { return online; },
  get offlineData() { return offlineData; },
  api,
  store,
  review,
  persistEntry,
  progressListeners,
  syncNow,
  renderNet,
  copyList,
  setKeys,
  cleanupKeys,
  setLeaveGuard(fn) { leaveGuard = fn; },
};

// ---------- Router ----------

async function route() {
  cleanupKeys();
  window.onbeforeunload = null;
  if (!me) return renderLogin();
  const [, page, id] = location.hash.replace(/^#\/?/, '').match(/^([^/]*)\/?(.*)$/) ?? [];
  try {
    if (!online && ['edit', 'stats', 'shared'].includes(page)) {
      return view(h('section', { class: 'panel' }, h('h1', {}, 'Keine Internetverbindung'),
        h('p', {}, 'Listen bearbeiten, teilen und auswerten geht nur mit Internet. Lernen geht auch offline.'),
        h('a', { class: 'btn', href: '#/' }, 'Zur Startseite')));
    }
    if (page === 'learn' && id) await renderLearn(id);
    else if (page === 'edit' && id && me.isTeacher) await openEditor(id);
    else if (page === 'stats' && id && me.isTeacher) {
      const [listId, userId] = id.split('/');
      if (userId) await renderStudentStats(listId, userId);
      else await renderStats(listId);
    }
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
  themeToggle(document.getElementById('theme'));
  settings = await fetch('/config.json').then((r) => r.json()).catch(() => ({}));
  if (settings.appName) {
    document.title = settings.appName;
    document.getElementById('app-name').textContent = settings.appName;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  try {
    me = await request('GET', '/me');
    await store.save('lastUser', me).catch(() => {});
    await rememberDevice().catch(() => {});
  } catch (err) {
    // Ohne Internet: als zuletzt angemeldete Person mit den Listen auf dem Gerät weiterlernen
    me = err instanceof OfflineError ? await store.load('lastUser').catch(() => null) : null;
  }
  if (me) {
    offlineData = await store.load(`offline:${me.id}`).catch(() => null);
    if (online) {
      await syncNow().catch(() => {});
      await download().catch(() => {});
      // Gespeicherte Daten sollen nicht bei Speicherknappheit gelöscht werden
      navigator.storage?.persist?.().catch(() => {});
    }
  }
  renderUser();
  route();
  window.addEventListener('online', reconnect);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconnect(); });
  setInterval(reconnect, 60000);
}

init();
