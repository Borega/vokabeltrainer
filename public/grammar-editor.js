// Editor für Grammatiklisten (Lehrkräfte): Regeln als aufklappbare Abschnitte mit Aufgaben in Textsyntax,
// Live-Vorschau mit zeilengenauen Fehlermeldungen, Reihenfolge per ↑/↓, Import und Export als Textdatei.
// Die Syntax und ihre Prüfung stehen in grammar.js (dieselbe Prüfung läuft beim Speichern auf dem Server).

import { readTextFile } from './csv.js';
import { editorChars, isGermanLabel, langTag } from './exercises.js';
import {
  LIMITS, TYPE_LABELS, matchItems, parseItem, parseRulesText, rulesToText, splitItems, validateRules,
} from './grammar.js';
import { GRADES } from './listfilter.js';
import { field, fill, groupPicker, h, languageSelect, toast, view } from './ui.js';

// Wie viele Aufgaben die Vorschau je Regel ausführlich zeigt
const PREVIEW_MAX = 200;
// Richtwert: Mit genug Sätzen lernen Schüler:innen die Regel statt die Sätze (Schmidt & Bjork 1992)
const RECOMMENDED_ITEMS = 8;

const PLACEHOLDER = `She *has lived* (live) here since 2010.
! lived = Die Handlung dauert bis jetzt an – present perfect.
They {have known|knew|are knowing} each other since school.
Fehler: He have worked here. → He has worked here.
Ordnen: I / have never been / to Spain
Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years.`;

// Vorschau einer gültigen Aufgabe
function previewNode(r) {
  const form = (text) => h('b', { class: 'form' }, text);
  let body;
  if (r.parts) {
    body = r.parts.map((p) => {
      if (p.gap === undefined) return p.text;
      const gap = r.gaps[p.gap];
      if (r.type === 'choice') return h('span', { class: 'opts' }, '{', form(r.options[0]), ` | ${r.options.slice(1).join(' | ')}}`);
      return [form(gap.answers.join(' | ')), gap.hint ? h('span', { class: 'muted' }, ` (${gap.hint})`) : null];
    });
  } else if (r.type === 'order') {
    body = r.orders.map((o) => o.join(' / ')).join('  |  ');
  } else if (r.type === 'error') {
    body = [h('s', {}, r.given), ' → ', form(r.solutions.join(' | '))];
  } else {
    body = [r.prompt, ' → ', form(r.solutions.join(' | '))];
  }
  const hints = r.feedback.length;
  return h('li', { class: 'ok' }, h('span', { class: 'chip' }, TYPE_LABELS[r.type]), ' ', h('span', { class: 'task-text' }, body),
    hints ? h('span', { class: 'muted small' }, ` · ${hints} ${hints === 1 ? 'Hinweis' : 'Hinweise'}`) : null);
}

export async function renderGrammarEditor(ctx, list) {
  const me = ctx.me;
  const isNew = !list;
  const data = list ?? { title: '', lang_a: 'Englisch', case_sensitive: false, accent_sensitive: true, shared: false, groups: [], rules: [] };

  let dirty = false;
  const markDirty = () => { dirty = true; };
  ctx.setLeaveGuard(() => !dirty || confirm('Ungespeicherte Änderungen verwerfen?'));
  window.onbeforeunload = (e) => { if (dirty) e.preventDefault(); };

  const title = h('input', { value: data.title, required: true, maxLength: 200, placeholder: 'z. B. Present perfect – Unit 4' });
  const lang = languageSelect(data.lang_a, langTag);
  const grade = h('select', { required: true },
    h('option', { value: '', selected: !data.grade }, 'Bitte wählen …'),
    GRADES.map((g) => h('option', { value: String(g), selected: data.grade === g }, `Jahrgang ${g}`)));
  const caseSens = h('input', { type: 'checkbox', checked: data.case_sensitive });
  // Deutsch: Großschreibung gehört zur Grammatik (das Laufen, beim Lesen) – bei einer neuen Liste voreinstellen,
  // solange die Lehrkraft das Häkchen nicht selbst gesetzt hat
  let caseTouched = !isNew;
  caseSens.addEventListener('change', () => { caseTouched = true; });
  const accentSens = h('input', { type: 'checkbox', checked: data.accent_sensitive });
  const shared = h('input', { type: 'checkbox', checked: data.shared });
  const groups = groupPicker(data, me.groups, markDirty);

  // ---------- Regeln ----------

  const rulesBox = h('div', { class: 'rules' });
  const counter = h('span', { class: 'muted small' });
  const ruleEls = () => [...rulesBox.children];
  let lastField = null;

  function refresh() {
    ruleEls().forEach((el, i) => el.refresh(i));
    const n = ruleEls().length;
    counter.textContent = `${n} ${n === 1 ? 'Regel' : 'Regeln'}`;
  }

  function addRule(rule = {}, { open = false } = {}) {
    const oldItems = (rule.items ?? []).map((it) => ({ id: it.id, source: it.source }));
    const title = h('input', { maxLength: LIMITS.title, placeholder: 'z. B. Present perfect mit since und for', 'aria-label': 'Titel der Regel', value: rule.title ?? '' });
    const summary = h('input', { maxLength: LIMITS.summary, placeholder: 'z. B. since/for → have/has + 3. Form', 'aria-label': 'Merksatz', value: rule.summary ?? '' });
    const explanation = h('textarea', { rows: 5, maxLength: LIMITS.explanation, class: 'explanation', 'aria-label': 'Erklärung', spellcheck: true });
    explanation.value = rule.explanation ?? '';
    const discover = h('input', { type: 'checkbox', checked: !!rule.discover });
    const tasks = h('textarea', { rows: 8, class: 'tasks', spellcheck: false, 'aria-label': 'Aufgaben', placeholder: PLACEHOLDER });
    tasks.value = rule.tasksText ?? (rule.items ?? []).map((it) => it.source).join('\n');
    const preview = h('div', { class: 'task-preview', 'aria-live': 'polite' });
    const head = h('summary', {});
    let problems = [];

    function renderPreview() {
      const { items, errors } = splitItems(tasks.value);
      const parsed = items.map((it) => ({ it, r: parseItem(it.source) }));
      problems = [...errors, ...parsed.filter((p) => p.r.error).map((p) => ({ line: p.it.lines[p.r.part] ?? p.it.lines[0], error: p.r.error }))]
        .sort((x, y) => x.line - y.line);
      tasks.classList.toggle('invalid', problems.length > 0);
      const good = parsed.filter((p) => !p.r.error);
      fill(preview,
        h('p', { class: 'small' },
          h('strong', {}, `${items.length} ${items.length === 1 ? 'Aufgabe' : 'Aufgaben'}`),
          problems.length ? h('span', { class: 'error-inline' }, ` · ${problems.length} ${problems.length === 1 ? 'Fehler' : 'Fehler'}`) : null,
          items.length && items.length < RECOMMENDED_ITEMS
            ? h('span', { class: 'muted' }, ` · Richtwert: mindestens ${RECOMMENDED_ITEMS} – mit wechselnden Sätzen lernen Schüler:innen die Regel statt die Sätze.`)
            : null),
        problems.length
          ? h('ul', { class: 'problems', role: 'alert' }, problems.map((p) => h('li', {}, h('strong', {}, `Zeile ${p.line}: `), p.error)))
          : null,
        good.length ? h('ol', { class: 'previews' }, good.slice(0, PREVIEW_MAX).map((p) => previewNode(p.r))) : null,
        good.length > PREVIEW_MAX ? h('p', { class: 'small muted' }, `… und ${good.length - PREVIEW_MAX} weitere`) : null);
      updateHead();
    }

    let index = 0;
    function updateHead() {
      const n = splitItems(tasks.value).items.length;
      fill(head, `Regel ${index + 1}: ${title.value.trim() || 'ohne Titel'}`, h('span', { class: 'muted small' }, ` · ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}`),
        problems.length ? h('span', { class: 'error-inline' }, ' – Fehler') : null);
    }

    const move = (dir) => {
      const sibling = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
      if (!sibling) return;
      if (dir < 0) rulesBox.insertBefore(el, sibling);
      else rulesBox.insertBefore(sibling, el);
      refresh();
      markDirty();
    };
    const remove = () => {
      const n = splitItems(tasks.value).items.length;
      if ((n || title.value.trim()) && !confirm(`Regel „${title.value.trim() || 'ohne Titel'}“ mit ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'} löschen?`)) return;
      el.remove();
      refresh();
      markDirty();
    };

    const el = h('details', { class: 'rule panel', open },
      head,
      h('div', { class: 'rule-tools' },
        h('button', { type: 'button', class: 'btn small', title: 'Nach oben', 'aria-label': 'Regel nach oben', onclick: () => move(-1) }, '↑'),
        h('button', { type: 'button', class: 'btn small', title: 'Nach unten', 'aria-label': 'Regel nach unten', onclick: () => move(1) }, '↓'),
        h('button', { type: 'button', class: 'btn small danger', onclick: remove }, 'Regel löschen')),
      field('Titel der Regel', title),
      field('Merksatz', summary, 'Eine Zeile, die die Regel zusammenfasst. Sie erscheint als Hinweis, wenn jemand nach einem Fehler keinen besseren Hinweis von dir hat.'),
      field('Erklärung (optional)', explanation, 'Kurzer Text mit Beispielen. *Sternchen* heben Formen hervor, Leerzeilen trennen Absätze. Eine Zeile mit „?“ am Anfang ist die Frage beim Entdecken.'),
      h('label', { class: 'check' }, discover, 'Regel entdecken lassen: erst Beispiele und eine Frage, dann die Regel',
        h('small', { class: 'muted' }, ' (Beispiele kommen aus den Aufgaben)')),
      field('Aufgaben', tasks, 'Eine Aufgabe pro Zeile; „!“-Zeilen darunter sind Hinweise. Syntax siehe oben.'),
      preview);
    el.refresh = (i) => { index = i; updateHead(); };
    el.read = () => ({
      id: rule.id,
      title: title.value,
      summary: summary.value,
      explanation: explanation.value,
      discover: discover.checked,
      tasks: tasks.value,
      oldItems,
    });
    el.hasProblems = () => problems.length > 0;
    let timer = null;
    tasks.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(renderPreview, 150); });
    title.addEventListener('input', updateHead);
    rulesBox.append(el);
    renderPreview();
    refresh();
    return el;
  }
  for (const rule of data.rules) addRule(rule);
  if (!data.rules.length) addRule({}, { open: true });

  // ---------- Werkzeugleiste für das zuletzt benutzte Feld ----------

  const keepFocus = (e) => e.preventDefault();
  const changed = (input) => input.dispatchEvent(new Event('input', { bubbles: true }));
  const inTasks = () => !!lastField?.classList.contains('tasks');
  const toolbarButtons = [];
  const tool = (label, title, onclick, needsTasks = true) => {
    const btn = h('button', { type: 'button', class: 'btn small', title, onpointerdown: keepFocus, onclick: () => {
      if (!lastField?.isConnected || (needsTasks && !inTasks())) return toast('Klicke erst in das Feld „Aufgaben“.', 'warn');
      onclick(lastField);
    } }, label);
    btn.needsTasks = needsTasks;
    toolbarButtons.push(btn);
    return btn;
  };
  // Text an der Stelle ersetzen und den Bereich [from, to) markieren (relativ zum eingefügten Text)
  function put(ta, start, end, text, from = text.length, to = text.length) {
    ta.setRangeText(text, start, end, 'end');
    ta.setSelectionRange(start + from, start + to);
    ta.focus();
    changed(ta);
  }
  // Zeile unter der Zeile mit dem Cursor einfügen
  function insertLine(ta, text, from = text.length, to = text.length) {
    const pos = ta.selectionEnd ?? ta.value.length;
    const nl = ta.value.indexOf('\n', pos);
    const at = nl < 0 ? ta.value.length : nl;
    const lead = at > 0 && ta.value[at - 1] !== '\n' ? '\n' : '';
    put(ta, at, at, lead + text, lead.length + from, lead.length + to);
  }
  const selection = (ta) => ({ start: ta.selectionStart ?? 0, end: ta.selectionEnd ?? 0 });

  const gapBtn = tool('✱ Lücke', 'Markierte Form als Lücke setzen: *has lived*', (ta) => {
    const { start, end } = selection(ta);
    if (start === end) return toast('Markiere erst die Form im Satz, die gesucht wird.', 'warn');
    put(ta, start, end, `*${ta.value.slice(start, end)}*`);
  });
  const choiceBtn = tool('{ } Auswahl', 'Form zur Auswahl stellen: {richtig|falsch|falsch}', (ta) => {
    const { start, end } = selection(ta);
    const right = start === end ? 'richtig' : ta.value.slice(start, end);
    const text = `{${right}|falsch|falsch}`;
    put(ta, start, end, text, right.length + 2, text.length - 1);
  });
  const hintGapBtn = tool('( ) Grundform', 'Grundform als Hinweis hinter die Lücke: *has lived* (live)', (ta) => {
    const { end } = selection(ta);
    put(ta, end, end, ' ()', 2, 2);
  });
  const feedbackBtn = tool('! Hinweis', 'Hinweis zu einer falschen Antwort unter der Aufgabe', (ta) => {
    const text = '! falsche Antwort = Hinweis';
    insertLine(ta, text, 2, 'falsche Antwort'.length + 2);
  });
  const templates = [
    ['Fehler', 'Fehler: falscher Satz → richtiger Satz', 8, 'Fehler: falscher Satz'.length],
    ['Ordnen', 'Ordnen: Teil 1 / Teil 2 / Teil 3', 8, 'Ordnen: Teil 1 / Teil 2 / Teil 3'.length],
    ['Übersetzen', 'Übersetzen: Satz auf Deutsch → Lösung | andere Lösung', 12, 'Übersetzen: Satz auf Deutsch'.length],
    ['Umformen', 'Umformen: Anweisung: Satz → Lösung', 10, 'Umformen: Anweisung: Satz'.length],
  ].map(([label, text, from, to]) => tool(label, `Aufgabe vom Typ „${label}“ einfügen`, (ta) => insertLine(ta, text, from, to)));

  const charRow = h('span', { class: 'charbar' });
  function syncToolbar() {
    for (const btn of toolbarButtons) btn.disabled = btn.needsTasks && !inTasks();
    fill(charRow, editorChars(langTag(lang.value)).map((ch) => h('button', {
      type: 'button', class: 'char', onpointerdown: keepFocus, 'aria-label': `${ch} einfügen`,
      onclick: () => {
        if (!lastField?.isConnected) return toast('Klicke erst in ein Textfeld.', 'warn');
        const start = lastField.selectionStart ?? lastField.value.length;
        lastField.setRangeText(ch, start, lastField.selectionEnd ?? start, 'end');
        lastField.focus();
        changed(lastField);
      },
    }, ch)));
  }
  rulesBox.addEventListener('focusin', (e) => { if (e.target.matches('input, textarea')) { lastField = e.target; syncToolbar(); } });
  const toolbar = h('div', { class: 'word-toolbar', role: 'toolbar', 'aria-label': 'Bearbeiten' },
    gapBtn, choiceBtn, hintGapBtn, feedbackBtn, h('span', { class: 'toolbar-sep', 'aria-hidden': 'true' }, '|'), ...templates, charRow);
  syncToolbar();

  // ---------- Import und Export ----------

  const fileInput = h('input', { type: 'file', accept: '.txt,.md,text/plain,text/markdown', hidden: true });
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const { rules, errors } = parseRulesText(await readTextFile(file));
    if (errors.length) toast(`Zeile ${errors[0].line}: ${errors[0].error}`, 'error');
    if (!rules.length) return errors.length ? null : toast('In der Datei wurden keine Regeln gefunden (## Titel).', 'error');
    // Nur anhängen – so geht nichts verloren; überflüssige Regeln lassen sich löschen
    for (const r of rules) addRule({ title: r.title, summary: r.summary, explanation: r.explanation, discover: r.discover, tasksText: r.tasks });
    if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, '');
    markDirty();
    toast(`${rules.length} ${rules.length === 1 ? 'Regel' : 'Regeln'} angehängt.`);
  };
  const exportText = () => {
    const text = rulesToText(ruleEls().map((el) => el.read()));
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), download: `${title.value.trim() || 'grammatik'}.txt` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---------- Speichern ----------

  const errorBox = h('p', { class: 'error', role: 'alert' });
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Speichern');

  function readRules() {
    const problems = [];
    const rules = ruleEls().map((el) => {
      const r = el.read();
      const { items, errors } = splitItems(r.tasks);
      if (errors.length) problems.push(`Regel „${r.title.trim() || 'ohne Titel'}“, Zeile ${errors[0].line}: ${errors[0].error}`);
      const ids = matchItems(r.oldItems, items.map((i) => i.source));
      return {
        id: r.id,
        title: r.title.trim(),
        summary: r.summary.trim(),
        explanation: r.explanation.trim(),
        discover: r.discover,
        items: items.map((it, i) => ({ id: ids[i] ?? undefined, source: it.source })),
      };
    });
    return { rules, problem: problems[0] ?? validateRules(rules) };
  }

  async function save(e) {
    e.preventDefault();
    errorBox.textContent = '';
    const { rules, problem } = readRules();
    if (problem) {
      errorBox.textContent = problem;
      const bad = ruleEls().find((el) => el.hasProblems());
      if (bad) bad.open = true;
      return errorBox.scrollIntoView({ block: 'center' });
    }
    const body = {
      kind: 'grammar',
      title: title.value,
      lang_a: lang.value,
      lang_b: '',
      grade: Number(grade.value) || null,
      case_sensitive: caseSens.checked,
      accent_sensitive: accentSens.checked,
      shared: shared.checked,
      groups: groups.selected(),
      rules,
    };
    saveBtn.disabled = true;
    try {
      if (isNew) await ctx.api('POST', '/lists', body);
      else await ctx.api('PUT', `/lists/${list.id}`, body);
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

  async function removeList() {
    if (!confirm(`Liste „${list.title}“ mit allen Lernständen endgültig löschen?`)) return;
    await ctx.api('DELETE', `/lists/${list.id}`);
    dirty = false;
    toast('Liste gelöscht.');
    location.hash = '#/';
  }

  const syntax = h('details', { class: 'import-panel syntax-help' },
    h('summary', {}, 'So schreibst du Aufgaben'),
    h('div', { class: 'syntax-table' },
      h('p', { class: 'small muted' }, 'Eine Aufgabe pro Zeile. Nimm ganze Sätze, bei denen die Bedeutung die Form bestimmt (Signalwörter wie since, yesterday) – keine reinen Formentabellen.'),
      h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Aufgabe'), h('th', {}, 'So schreibst du sie'))),
        h('tbody', {}, [
          ['Lücke zum Eintippen', 'She *has lived* (live) here since 2010.', '*…* ist die Lücke, „|“ trennt gültige Varianten (*haven’t seen|have not seen*), „(…)“ dahinter ist die Grundform als Hinweis. Mehrere Lücken pro Satz gehen.'],
          ['Auswählen', 'They {have known|knew|are knowing} each other.', 'Die erste Form ist richtig, sie wird gemischt angezeigt. 2 bis 4 Formen; die falschen sollten typische Fehler sein.'],
          ['Fehler finden', 'Fehler: He have worked here. → He has worked here.', 'Der falsche Satz steht im Eingabefeld und wird korrigiert. Mehrere Lösungen mit „|“.'],
          ['Satzbau', 'Ordnen: I / have never been / to Spain', 'Satzteile mit „/“ trennen, in der richtigen Reihenfolge; sie erscheinen gemischt. Weitere gültige Reihenfolgen mit „|“.'],
          ['Übersetzen', 'Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years. | I’ve known her for three years.', 'Mehrere Lösungen mit „|“; „(…)“ in einer Lösung ist optional.'],
          ['Umformen', 'Umformen: Ins Passiv: They built the house. → The house was built.', 'Anweisung und Satz vor dem Pfeil, die Lösung dahinter.'],
          ['Hinweis zu einer falschen Antwort', '! knew = Seit wann? Mit „since“ steht das present perfect.', 'Steht in der Zeile unter der Aufgabe. Erscheint, wenn genau diese Antwort kommt („|“ für mehrere). Ohne „=“ gilt der Hinweis für jede falsche Antwort.'],
        ].map(([kind, code, note]) => h('tr', {}, h('td', {}, kind), h('td', {}, h('code', {}, code), h('p', { class: 'small muted' }, note))))))));

  const form = h('form', { class: 'editor grammar-editor', onsubmit: save, oninput: (e) => {
    markDirty();
    if (e.target === lang) {
      syncToolbar();
      if (!caseTouched) caseSens.checked = isGermanLabel(lang.value);
    }
  } },
    h('div', { class: 'section-head' }, h('h1', {}, isNew ? 'Neue Grammatikliste' : 'Grammatikliste bearbeiten'), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
    h('div', { class: 'panel' },
      field('Titel', title),
      h('div', { class: 'row2' },
        field('Sprache', lang),
        field('Jahrgangsstufe', grade, 'Für welchen Jahrgang ist die Liste? Hilft Kolleg:innen beim Finden geteilter Listen.'))),
    h('div', { class: 'panel' },
      h('h2', {}, 'Prüfung'),
      h('div', { class: 'suboptions' },
        h('label', { class: 'check' }, caseSens, 'Groß-/Kleinschreibung beachten'),
        h('label', { class: 'check' }, accentSens, 'Akzente und Umlaute beachten', h('small', { class: 'muted' }, ' (z. B. für Französisch und Spanisch: a ≠ à)')),
        h('p', { class: 'small muted' }, 'Kommas und Anführungszeichen zählen nicht. Vertauschte oder ausgelassene Buchstaben gelten als „Fast!“, falsche Formen (knew ↔ know) nie.'))),
    h('div', { class: 'panel' },
      h('h2', {}, 'Für wen?'),
      h('p', { class: 'small muted' }, 'Nur Mitglieder der gewählten Gruppen sehen die Liste.'),
      groups.filter,
      groups.box,
      h('label', { class: 'check share-option' }, shared,
        h('span', {}, h('strong', {}, 'Für Kolleg:innen freigeben'),
          h('small', { class: 'muted' }, ' – andere Lehrkräfte können die Liste ansehen und eine eigene Kopie anlegen. Lernstände werden nicht geteilt.'))),
      data.copied_from ? h('p', { class: 'small muted' }, `Kopie von: ${data.copied_from}`) : null),
    h('div', { class: 'panel' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Regeln ', counter),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Aus Textdatei importieren'),
          h('button', { type: 'button', class: 'btn', onclick: exportText }, 'Als Textdatei exportieren'),
          fileInput)),
      h('p', { class: 'small muted' }, 'Jede Regel hat einen Merksatz, eine kurze Erklärung und Aufgaben. Die Schüler:innen bekommen sie in deiner Reihenfolge: Neue Regeln kommen nacheinander dran.'),
      syntax,
      toolbar,
      rulesBox,
      h('button', { type: 'button', class: 'btn', onclick: () => {
        if (ruleEls().length >= LIMITS.rules) return toast(`Höchstens ${LIMITS.rules} Regeln pro Liste.`, 'warn');
        const el = addRule({}, { open: true });
        el.scrollIntoView({ block: 'start' });
        el.querySelector('input').focus();
        markDirty();
      } }, '+ Regel')),
    errorBox,
    h('div', { class: 'actions sticky' },
      saveBtn,
      isNew ? null : h('button', { type: 'button', class: 'btn danger', onclick: removeList }, 'Liste löschen')));
  view(form);
  if (isNew) title.focus();
}
