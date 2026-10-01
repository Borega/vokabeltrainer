// Grammatik üben: Regelkarte, Aufgaben, zweistufiges Feedback und Rundensteuerung.
// Läuft im Browser; die Logik (Prüfen, Auswählen, Bewerten) steht in grammar.js und ist dort getestet.
// Nutzt von app.js nur, was über ctx hereingereicht wird (Anmeldung, Gerätespeicher, Übertragung).
//
// Ablauf nach der Forschungslage (docs/grammatik-plan.md):
//  - neue Regel: erst die Regelkarte, dann Auswählen und Lücke im Block
//  - Wiederholung: Aufgaben mehrerer Regeln gemischt; eine Bewertung pro Regel und Runde (die schlechteste)
//  - falsche Antwort: erst Fehlerstelle und Hinweis, zweiter Versuch; dann Lösung und Merksatz
//  - Regel vor der Antwort nachlesen zählt als Hilfe (Abrufen soll Vorrang vor Nachlesen haben)

import { langTag, specialChars, speechLang } from './exercises.js';
import {
  asKind, buildRound, capabilities, checkGaps, checkOrder, checkSentence, choiceOrder, closestSolution, diffWords, dueRuleCount, expand,
  feedbackFor, gradeFor, orderMarks, parseItem, pickExamples, pickItems, pickKind, roundGrade, segments, shuffledChunks, solutionText,
  splitExplanation, TYPE_LABELS,
} from './grammar.js';
import { answerRule, mergeRuleProgress, newId } from './offline.js';
import { SAFE_LEVEL } from './schedule.js';
import { canSpeak, speak, stopSpeaking, voicesReady } from './speech.js';
import { levelChip } from './stats-ui.js';
import { endOfToday, fill, formatDue, h, icon, pref, progressBar, segmented, toast, view } from './ui.js';

const INSTRUCTIONS = {
  choice: 'Wähle die richtige Form.',
  gap: 'Setze die richtige Form ein.',
  error: 'Dieser Satz enthält einen Fehler – korrigiere ihn.',
  order: 'Bringe die Satzteile in die richtige Reihenfolge.',
  translate: 'Übersetze den Satz.',
  transform: 'Forme den Satz um.',
};
const GRADE_TEXT = { again: 'noch üben', hard: 'mit Mühe', good: 'gut', easy: 'sehr gut' };
const MAX_RETRIES = 2;
// Ab so vielen Aufgaben zeigt die Regelkarte Beispielsätze aus den Aufgaben der Regel (sonst gäbe sie Lösungen vor)
const EXAMPLES_FROM = 6;

// *Form* im Text hervorheben
const marked = (text) => String(text).split('*').map((part, i) => (i % 2 ? h('b', {}, part) : part));
const paragraphs = (text) => text.split(/\n{2,}/).filter((p) => p.trim()).map((p) =>
  h('p', {}, p.split('\n').flatMap((line, i) => [i ? h('br') : null, ...marked(line)])));

export async function renderGrammarLearn(ctx, list) {
  const { store } = ctx;
  const me = ctx.me;
  await voicesReady();
  const lang = speechLang(list.lang_a);
  const tag = langTag(list.lang_a);
  const speakable = canSpeak(lang);
  let sound = speakable && pref('sound') === 'on';
  const options = { caseSensitive: list.case_sensitive, accentSensitive: list.accent_sensitive };

  // Regeln mit ihren gültigen Aufgaben (ungültige Zeilen, etwa nach einem Fehler beim Bearbeiten, fallen weg)
  const rules = list.rules.map((r) => ({
    ...r,
    items: r.items.map((it) => ({ id: it.id, item: parseItem(it.source) })).filter((e) => !e.item.error),
  }));
  const usable = rules.filter((r) => r.items.length);
  if (!usable.length) throw new Error('Diese Liste enthält noch keine Aufgaben.');
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  // Wann welche Aufgabe zuletzt dran war (für „am längsten nicht gesehen“), auch ohne Internet
  const seen = {};
  for (const r of list.rules) for (const it of r.items) if (it.seen) seen[it.id] = it.seen;
  const progress = new Map(list.progress.map((p) => [p.rule_id, p]));
  const charsFor = specialChars(rules.flatMap((r) => r.items.map((e) => ({ a: solutionText(e.item) }))), 'a');

  let mode = null; // 'due' (Heute fällig) oder 'free' (Frei üben)
  let leaveRound = null; // übernimmt die Antworten der laufenden Runde (gesetzt in runRound)
  let maxRules = '5';
  let perRule = '6';
  let blocked = false;
  const selected = new Set(usable.map((r) => r.id));

  const levelOf = (rule) => progress.get(rule.id)?.box ?? 0;
  const dueNow = () => dueRuleCount(usable, progress, endOfToday());
  const nextNew = () => usable.find((r) => !progress.has(r.id)) ?? null;

  // ---------- Regelkarte ----------

  const examples = new Map();
  // Beispielsätze mit hervorgehobener Form – bei wenigen Aufgaben nur zum Entdecken, sonst verrieten sie Lösungen
  function examplesOf(rule) {
    if (!examples.has(rule.id)) {
      // Zum Entdecken braucht es Beispiele, auch bei wenigen Aufgaben – aber höchstens die Hälfte davon
      const n = rule.discover ? Math.min(4, Math.max(2, Math.floor(rule.items.length / 2))) : 3;
      examples.set(rule.id, rule.discover || rule.items.length >= EXAMPLES_FROM ? pickExamples(rule.items, n) : []);
    }
    return examples.get(rule.id);
  }

  const sentenceNode = (segs) => h('span', { class: 'sentence-ex', lang: tag }, segs.map((s) => (s.mark ? h('b', { class: 'form' }, s.text) : s.text)));

  function ruleBody(rule) {
    const { text } = splitExplanation(rule.explanation);
    const ex = examplesOf(rule);
    return [
      h('p', { class: 'rule-summary' }, marked(rule.summary)),
      text ? h('div', { class: 'rule-text' }, paragraphs(text)) : null,
      ex.length ? h('div', { class: 'rule-examples' }, h('h3', {}, 'Beispiele'), h('ul', {}, ex.map((e) => h('li', {}, sentenceNode(e.segments))))) : null,
    ];
  }

  // Regelkarte in der Runde (bei „Entdecken“ erst Beispiele und eine Frage) – danach geht es mit done() weiter
  function showCard(rule, done, header) {
    const { question } = splitExplanation(rule.explanation);
    const cont = h('button', { class: 'btn primary big', type: 'button' }, 'Verstanden – weiter');
    const box = h('div', { class: 'exercise rule-card' });
    const step = (revealed) => {
      if (rule.discover && !revealed) {
        const ex = examplesOf(rule);
        const reveal = h('button', { class: 'btn primary big', type: 'button', onclick: () => step(true) }, 'Regel zeigen');
        fill(box,
          h('span', { class: 'chip new' }, 'Neue Regel entdecken'),
          h('h2', {}, rule.title),
          h('ul', { class: 'examples-list' }, ex.map((e) => h('li', {}, sentenceNode(e.segments)))),
          h('p', { class: 'question' }, question || 'Was fällt dir an den markierten Formen auf? Wann steht welche Form? Überlege kurz – dann lass dir die Regel zeigen.'),
          h('div', { class: 'actions center' }, reveal));
        reveal.focus();
        return;
      }
      fill(box, h('span', { class: 'chip new' }, rule.discover ? 'Die Regel' : 'Neue Regel'), h('h2', {}, rule.title), ruleBody(rule),
        h('div', { class: 'actions center' }, cont),
        h('p', { class: 'small muted center' }, 'Präg dir die Regel ein – gleich wird sie abgefragt.'));
      cont.focus();
    };
    cont.onclick = done;
    step(false);
    view(h('section', { class: 'round' }, header, box));
  }

  // ---------- Startansicht ----------

  function setupView() {
    if (!mode) mode = dueNow() + (nextNew() ? 1 : 0) > 0 ? 'due' : 'free';
    const due = dueNow();
    const fresh = nextNew();
    const safe = usable.filter((r) => levelOf(r) >= SAFE_LEVEL).length;
    const nothingToDo = mode === 'due' && !due && !fresh;
    const next = [...progress.values()].filter((p) => p.due).map((p) => new Date(p.due)).sort((a, b) => a - b)[0];
    const total = list.rules.reduce((sum, r) => sum + r.items.length, 0);

    const dueInfo = h('div', { class: 'mode-info' },
      h('p', {}, h('strong', {}, `${due} ${due === 1 ? 'Regel' : 'Regeln'} fällig`), fresh ? ` · nächste neue Regel: „${fresh.title}“` : ''),
      h('p', { class: 'small muted' }, 'Fällige Regeln kommen gemischt dran – das trainiert, die passende Regel selbst zu erkennen. Eine neue Regel wird zuerst für sich erklärt und geübt. Jede Regel kommt in wachsenden Abständen wieder.'));

    const pick = h('div', { class: 'rule-pick' },
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn small', onclick: () => { usable.forEach((r) => selected.add(r.id)); setupView(); } }, 'Alle'),
        h('button', { type: 'button', class: 'btn small', onclick: () => { selected.clear(); setupView(); } }, 'Keine')),
      usable.map((r) => h('label', { class: 'check rule-option' },
        h('input', { type: 'checkbox', checked: selected.has(r.id), onchange: (e) => { e.target.checked ? selected.add(r.id) : selected.delete(r.id); setupView(); } }),
        h('span', {}, r.title), levelChip(progress.get(r.id)),
        h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => { e.preventDefault(); showRulePage(r); } }, [icon('book'), ' Regel']))));

    view(h('section', { class: 'panel learn-setup' },
      h('div', { class: 'section-head' }, h('h1', {}, list.title), h('a', { class: 'btn ghost', href: '#/' }, 'Zurück')),
      h('p', { class: 'muted' }, [`${usable.length} Regeln · ${total} Aufgaben`, list.is_owner ? null : list.owner_name && `von ${list.owner_name}`].filter(Boolean).join(' · ')),
      h('div', { class: 'progress' }, progressBar(safe, usable.length, 'Sicher gelernt'), h('span', { class: 'small muted' }, `${safe} von ${usable.length} Regeln sicher`)),
      h('h2', {}, 'Modus'),
      segmented('Modus', [['due', `Heute fällig${due ? ` (${due})` : ''}`], ['free', 'Frei üben']], mode, (m) => { mode = m; setupView(); }),
      mode === 'due' ? dueInfo : h('div', { class: 'mode-info' }, h('p', { class: 'small muted' }, 'Wähle Regeln zum Üben, z. B. vor einer Arbeit. Deine Antworten fließen trotzdem in die Planung ein.')),
      mode === 'due'
        ? [h('h2', {}, 'Wie viele Regeln?'), segmented('Regeln pro Runde', [['3', '3'], ['5', '5'], ['10', '10']], maxRules, (v) => { maxRules = v; setupView(); })]
        : [
            h('h2', {}, 'Regeln'), pick,
            h('h2', {}, 'Reihenfolge'),
            segmented('Reihenfolge', [['mixed', 'Gemischt'], ['blocked', 'Nach Regeln']], blocked ? 'blocked' : 'mixed', (v) => { blocked = v === 'blocked'; setupView(); }),
            h('p', { class: 'small muted' }, blocked ? 'Eine Regel nach der anderen – gut zum ersten Üben.' : 'Aufgaben verschiedener Regeln gemischt – das festigt länger, weil du jedes Mal erst die passende Regel finden musst.'),
            h('h2', {}, 'Aufgaben pro Regel'),
            segmented('Aufgaben pro Regel', [['3', '3'], ['6', '6'], ['10', '10']], perRule, (v) => { perRule = v; setupView(); }),
          ],
      speakable
        ? [
            h('h2', {}, 'Ton'),
            segmented('Ton', [['off', 'Aus'], ['on', 'An']], sound ? 'on' : 'off', (v) => { sound = v === 'on'; pref('sound', v); setupView(); }),
            h('p', { class: 'small muted' }, sound ? 'Der richtige Satz wird nach jeder Antwort vorgelesen.' : 'Über den Lautsprecher-Knopf kannst du die Sätze jederzeit anhören.'),
          ]
        : null,
      nothingToDo
        ? h('p', { class: 'done-today' }, 'Für heute ist alles erledigt.', next ? h('span', { class: 'small muted' }, ` Nächste Wiederholung: ${formatDue(next)}.`) : null)
        : null,
      h('div', { class: 'actions' },
        nothingToDo
          ? h('button', { class: 'btn primary big', onclick: () => { mode = 'free'; setupView(); } }, 'Trotzdem frei üben')
          : h('button', { class: 'btn primary big', disabled: mode === 'free' && !selected.size, onclick: () => startRound() }, 'Los geht’s'),
        list.progress.length ? h('button', { class: 'btn ghost', onclick: resetProgress, disabled: !ctx.online }, 'Lernstand zurücksetzen') : null,
        list.can_copy && !list.is_owner ? h('button', { class: 'btn', onclick: () => ctx.copyList(list) }, 'In meine Listen kopieren') : null,
      ),
    ));
  }

  // Regel nachlesen (außerhalb einer Runde)
  function showRulePage(rule) {
    view(h('section', { class: 'panel learn-setup rule-card' },
      h('div', { class: 'section-head' }, h('h1', {}, rule.title), h('button', { class: 'btn ghost', onclick: setupView }, 'Zurück')),
      ruleBody(rule)));
  }

  async function resetProgress() {
    if (!ctx.online) return toast('Zurücksetzen geht nur mit Internet.', 'warn');
    if (!confirm('Deinen Lernstand für diese Liste wirklich zurücksetzen?')) return;
    // Erst alles übertragen und laufende Schreibvorgänge abwarten – sonst könnte eine späte Antwort den alten Stand wiederherstellen
    await writes;
    await ctx.syncNow();
    try {
      await ctx.api('DELETE', `/lists/${list.id}/progress`);
    } catch (err) {
      return toast(err.message, 'error');
    }
    const stale = (await store.pending(me.id)).filter((e) => e.list_id === list.id);
    await store.done(stale.map((e) => e.id));
    progress.clear();
    list.progress = [];
    for (const k of Object.keys(seen)) delete seen[k];
    for (const r of list.rules) for (const it of r.items) it.seen = null;
    if (ctx.offlineData) store.save(`offline:${me.id}`, ctx.offlineData).catch(() => {});
    ctx.renderNet();
    mode = null;
    setupView();
  }

  // ---------- Antworten verplanen und übertragen ----------

  // Eine Runde einer Regel sofort auf dem Gerät verplanen (wie der Server) und für die Übertragung merken.
  let writes = Promise.resolve();
  function record(ruleId, grade, items) {
    const entry = { id: newId(), user: me.id, list_id: list.id, rule_id: ruleId, grade, items, at: new Date().toISOString() };
    progress.set(ruleId, answerRule(progress.get(ruleId), entry, ctx.review));
    list.progress = [...progress.values()];
    for (const it of items) if (it.item_id != null) seen[it.item_id] = entry.at;
    for (const r of list.rules) for (const it of r.items) if (seen[it.id]) it.seen = seen[it.id];
    writes = ctx.persistEntry(entry, writes);
  }
  // Stand vom Server übernehmen, sobald Antworten übertragen sind (wartende Runden auf dem Gerät bleiben)
  const onProgress = (byList, pendingFor) => {
    if (!byList[list.id]) return;
    list.progress = mergeRuleProgress(list.progress, byList[list.id], pendingFor(list.id));
    progress.clear();
    for (const p of list.progress) progress.set(p.rule_id, p);
  };
  ctx.progressListeners.add(onProgress);

  // ---------- Runde ----------

  // Beispielsätze der Regelkarte kommen nicht gleich danach als Aufgabe dran
  function roundRules() {
    return usable.map((r) => {
      if (progress.has(r.id)) return r;
      const ids = new Set(examplesOf(r).map((e) => e.id));
      const rest = r.items.filter((e) => !ids.has(e.id));
      return rest.length >= 3 ? { ...r, items: rest } : r;
    });
  }

  function startRound(custom) {
    const plan = custom ?? (mode === 'due'
      ? buildRound({ rules: roundRules(), progress, seen, mode: 'due', perRule: 2, maxRules: Number(maxRules), until: endOfToday() })
      : buildRound({ rules: roundRules(), progress, seen, mode: 'free', ruleIds: [...selected], perRule: Number(perRule), blocked }));
    if (!plan.tasks.length) {
      toast('Keine Aufgaben gefunden.', 'warn');
      return setupView();
    }
    runRound(plan.tasks);
  }

  function runRound(tasks) {
    const queue = tasks.map((t) => ({ ...t, retry: 0 }));
    let total = tasks.length; // wächst mit jeder Wiederholung nach einem Fehler
    let done = 0;
    const results = []; // erste Versuche: { task, correct, firstTry, grade }
    // Pro Regel: Bewertungen und Aufgaben der Runde; eine Bewertung für die Regel, sobald alle Aufgaben dran waren
    const states = new Map();
    for (const t of tasks) {
      if (!states.has(t.ruleId)) states.set(t.ruleId, { total: 0, grades: [], items: [], sent: 0 });
      states.get(t.ruleId).total++;
    }
    const usedItems = new Map([...states.keys()].map((id) => [id, new Set(tasks.filter((t) => t.ruleId === id).map((t) => t.itemId))]));

    // Bewertung der Regel senden: die noch nicht gesendeten Aufgaben, mit der schlechtesten Bewertung davon.
    // Normalerweise einmal, wenn alle Aufgaben der Regel dran waren; vorzeitig nur, wenn die Runde endet
    // oder die App in den Hintergrund geht (dann gibt es für den Rest eine zweite Bewertung).
    function flush(ruleId) {
      const st = states.get(ruleId);
      if (!st || st.sent >= st.items.length) return;
      const fresh = st.items.slice(st.sent);
      st.sent = st.items.length;
      record(ruleId, roundGrade(fresh.map((i) => i.grade)), fresh);
    }
    // Aufgabe, deren Antwort schon abgeschickt ist (Feedback steht), aber noch nicht mit „Weiter“ bestätigt wurde:
    // settleCurrent() verbucht sie, damit sie beim Verlassen nicht verloren geht (siehe showTask)
    let settleCurrent = null;
    const flushAll = () => {
      settleCurrent?.();
      [...states.keys()].forEach(flush);
    };
    // Wer die App wegwischt, das Gerät sperrt oder die Seite schließt, behält die schon beantworteten Aufgaben.
    // visibilitychange feuert dafür zuverlässiger als pagehide (iPad-App auf dem Home-Bildschirm).
    const onHide = () => { if (document.visibilityState === 'hidden') flushAll(); };
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onHide);
    leaveRound = () => {
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onHide);
      flushAll();
      leaveRound = null;
    };

    function answered(task, res) {
      if (task.retry) done++;
      else {
        const st = states.get(task.ruleId);
        st.grades.push(res.grade);
        st.items.push({ item_id: task.itemId, exercise: task.kind, grade: res.grade, attempts: res.attempts, answer: res.answer });
        done++;
        results.push({ task, correct: res.correct, firstTry: res.correct && res.attempts === 1, grade: res.grade });
        if (st.grades.length === st.total) flush(task.ruleId);
      }
      if (!res.correct && task.retry < MAX_RETRIES) {
        // Nicht geschafft: später eine andere Aufgabe derselben Regel (nur wenn es keine gibt, dieselbe)
        const rule = ruleById.get(task.ruleId);
        const used = usedItems.get(task.ruleId);
        const others = rule.items.filter((e) => !used.has(e.id));
        const [entry] = pickItems(others.length ? others : rule.items, seen, 1, { avoid: task.itemId });
        used.add(entry.id);
        const kind = pickKind({ level: progress.get(task.ruleId)?.box ?? 0, kinds: capabilities(entry.item), previous: task.kind, retry: true });
        const at = Math.min(queue.length, 2 + Math.floor(Math.random() * 3));
        queue.splice(at, 0, { ruleId: task.ruleId, itemId: entry.id, kind, retry: task.retry + 1 });
        total++;
      }
    }

    function header() {
      return h('div', { class: 'round-head' },
        h('button', { class: 'btn ghost small', onclick: () => { if (confirm('Runde abbrechen?')) { leaveRound?.(); ctx.cleanupKeys(); stopSpeaking(); setupView(); } } }, 'Beenden'),
        progressBar(done, total, 'Fortschritt der Runde'),
        h('span', { class: 'small muted' }, `${Math.min(done + 1, total)} / ${total}`));
    }

    function next() {
      stopSpeaking();
      const task = queue.shift();
      if (!task) return finish();
      const rule = ruleById.get(task.ruleId);
      if (task.card) return showCard(rule, () => { delete task.card; queue.unshift(task); next(); }, header());
      showTask(task, rule);
    }

    // ---------- eine Aufgabe ----------

    function showTask(task, rule) {
      settleCurrent = null;
      const entry = rule.items.find((e) => e.id === task.itemId);
      const item = asKind(entry.item, task.kind) ?? entry.item;
      // Übungsart nach der Aufgabe selbst (Umformen und Übersetzen sind beide „translate“)
      const kind = item.type === 'transform' ? 'translate' : item.type;
      task.kind = kind;
      const ui = { gap: buildGap, choice: buildChoice, order: buildOrder }[kind]?.(item) ?? buildText(item);

      let attempts = 0;
      let phase = 'ask'; // ask → done
      let helped = false;
      let firstWrong = null;
      let outcome = null;
      let committed = false;
      const feedback = h('div', { class: 'feedback grammar-feedback', 'aria-live': 'polite' });
      const panel = h('div', { class: 'rule-panel', hidden: true });
      const submit = h('button', { class: 'btn primary', type: 'submit', hidden: !!ui.noSubmit }, 'Prüfen');
      const nextBtn = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => proceed() }, 'Weiter');
      const speakBtn = () => (speakable ? h('button', {
        type: 'button', class: 'icon speak', title: 'Anhören', 'aria-label': 'Satz anhören',
        onclick: () => speak(solutionText(item), lang),
      }, icon('volume')) : null);

      function togglePanel() {
        if (!panel.hidden) { panel.hidden = true; return; }
        if (phase === 'ask') helped = true; // Nachlesen vor der Antwort zählt als Hilfe
        fill(panel, h('h3', {}, rule.title), ruleBody(rule),
          phase === 'ask' ? h('p', { class: 'small muted' }, 'Nachlesen vor der Antwort zählt als Hilfe: Die Aufgabe gilt dann als „mit Mühe gewusst“.') : null);
        panel.hidden = false;
      }
      const ruleBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: togglePanel }, [icon('book'), ' Regel']);

      // Hinweis nach einer falschen Antwort: Hinweis der Lehrkraft zu genau dieser Antwort, sonst der Merksatz
      const hint = (answers) => {
        const fb = feedbackFor(item, answers, rule);
        return fb.text ? h('p', { class: 'hint' }, h('span', { class: 'hint-label' }, fb.source === 'item' ? 'Hinweis: ' : 'Merksatz: '), marked(fb.text)) : null;
      };

      function evaluate(result) {
        if (phase !== 'ask' || result.empty) return;
        attempts++;
        if (result.state === 'correct') return settle(result, true);
        if (result.state === 'almost') return attempts === 1 ? settle(result, false, true) : settle(result, true);
        if (attempts === 1) {
          firstWrong = (result.first ?? '').trim().slice(0, 200) || null;
          ui.mark(result);
          if (!ui.canRetry || ui.canRetry()) {
            fill(feedback, h('strong', {}, 'Nicht ganz.'), ' Versuche es noch einmal.', hint(result.wrong));
            return;
          }
        }
        settle(result, false);
      }

      function settle(result, correct, almost = false) {
        phase = 'done';
        outcome = { result, correct, almost };
        ui.reveal(result, correct || almost ? 'shown' : 'wrong');
        form.classList.add(correct ? 'is-right' : almost ? 'is-almost' : 'is-wrong');
        const overrideBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: () => { outcome.override = true; proceed(); } }, 'Ich hatte recht');
        // Verlässt jemand die Runde jetzt, zählt die Antwort so, wie sie dasteht – danach ist „Ich hatte recht“ nicht mehr möglich
        settleCurrent = () => {
          if (committed) return;
          commit();
          overrideBtn.remove();
        };
        const why = { accents: 'Achte auf Akzente und Sonderzeichen.', case: 'Achte auf Groß- und Kleinschreibung.', typo: 'Kleiner Tippfehler.' };
        const reasons = [...new Set((result.gaps ?? [result]).map((g) => g.reason).filter(Boolean))];
        fill(feedback,
          h('strong', {}, correct ? (attempts > 1 ? 'Richtig – beim zweiten Versuch.' : 'Richtig!') : almost ? 'Fast!' : 'Leider falsch.'),
          almost ? h('span', {}, ` ${reasons.map((r) => why[r]).join(' ') || why.typo}`) : null,
          h('div', { class: 'solution-line' }, ui.solution(correct ? result : null, !correct), speakBtn()),
          correct || almost ? null : hint(result.wrong),
          !correct ? overrideBtn : null,
          !correct && !almost ? h('button', { type: 'button', class: 'btn ghost small', onclick: togglePanel }, [icon('book'), ' Regel ansehen']) : null,
        );
        submit.textContent = 'Weiter';
        submit.hidden = false;
        nextBtn.hidden = true;
        if (ui.noSubmit) { submit.hidden = true; nextBtn.hidden = false; nextBtn.focus(); } else submit.focus();
        if (sound) speak(solutionText(item), lang);
      }

      // Antwort verbuchen (höchstens einmal je Aufgabe)
      function commit() {
        if (committed) return;
        committed = true;
        const correct = outcome.correct || !!outcome.override;
        // „Fast!“ zählt als „hard“; „Ich hatte recht“ wie eine richtige Antwort
        const almost = outcome.almost && !outcome.override;
        answered(task, {
          correct,
          attempts: outcome.override ? 1 : attempts,
          grade: gradeFor(kind, { correct, attempts: outcome.override ? 1 : attempts, helped, almost }),
          // „Ich hatte recht“: Die Antwort war dann kein Fehler und gehört nicht in die Fehlerstatistik
          answer: outcome.override ? null : firstWrong,
        });
      }

      function proceed() {
        if (phase !== 'done') return;
        commit();
        settleCurrent = null;
        next();
      }

      const form = h('form', { class: 'type-form exercise grammar-exercise', onsubmit: (e) => {
        e.preventDefault();
        if (phase === 'ask') evaluate(ui.check());
        else proceed();
      } },
        h('div', { class: 'task-meta' },
          h('span', { class: 'chip' }, TYPE_LABELS[item.type] ?? TYPE_LABELS[kind]),
          h('span', { class: 'small muted' }, rule.title),
          ruleBtn),
        task.retry ? h('p', { class: 'retry small' }, 'Wiederholung') : null,
        h('p', { class: 'instruction muted' }, INSTRUCTIONS[item.type === 'choice' || kind === 'choice' ? 'choice' : item.type] ?? INSTRUCTIONS.gap),
        ui.node,
        charBar(ui, tag, charsFor),
        panel,
        feedback,
        h('div', { class: 'actions' }, submit, nextBtn));
      ui.bind?.(evaluate, (handler) => ctx.setKeys(handler));
      if (!ui.keys) ctx.setKeys(null);
      view(h('section', { class: 'round' }, header(), form));
      ui.focus?.();
    }

    // ---------- Übungsarten ----------

    // Lücken im Satz, eine oder mehrere
    function buildGap(item) {
      const inputs = [];
      const node = h('p', { class: 'sentence gap-sentence', lang: tag }, item.parts.map((p) => {
        if (p.gap === undefined) return p.text;
        const gap = item.gaps[p.gap];
        // Breite nach der Hauptlösung (lange Varianten wie „have not seen“ blähen das Feld nicht auf), höchstens 11 Zeichen
        const width = Math.min(11, Math.max(4, expand(gap.answers[0])[0].length + 1));
        const input = h('input', {
          class: 'gap-input', size: width, lang: tag, autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
          'aria-label': item.gaps.length > 1 ? `Lücke ${p.gap + 1}` : 'Lücke',
        });
        inputs.push(input);
        return h('span', { class: 'gap-wrap' }, input, gap.hint ? h('span', { class: 'cue' }, `(${gap.hint})`) : null);
      }));
      const sentenceWith = (res, asSolution) => item.parts.map((p) => {
        if (p.gap === undefined) return p.text;
        const form = asSolution ? expand(item.gaps[p.gap].answers[0])[0] : res?.gaps[p.gap]?.match ?? expand(item.gaps[p.gap].answers[0])[0];
        return h('b', { class: 'form' }, form);
      });
      return {
        node,
        inputs,
        focus: () => inputs[0]?.focus(),
        check() {
          const values = inputs.map((i) => i.value);
          if (values.every((v) => !v.trim())) return { empty: true };
          // Wie beim Satzbau: Eine unvollständige Antwort kostet keinen Versuch
          const open = inputs.find((i) => !i.value.trim());
          if (open) {
            toast('Fülle erst alle Lücken aus.', 'warn');
            open.focus();
            return { empty: true };
          }
          const res = checkGaps(item, values, options);
          const bad = res.gaps.map((g, i) => ({ g, v: values[i].trim() })).filter(({ g }) => g.state !== 'correct');
          return { ...res, wrong: bad.map((b) => b.v).filter(Boolean), first: bad[0]?.v ?? '' };
        },
        mark(res) {
          res.gaps.forEach((g, i) => {
            inputs[i].classList.toggle('is-right', g.state === 'correct');
            inputs[i].classList.toggle('is-wrong', g.state !== 'correct');
            if (g.state === 'correct') inputs[i].readOnly = true;
          });
          inputs.find((_, i) => res.gaps[i].state !== 'correct')?.focus();
        },
        reveal(res, how) {
          inputs.forEach((input, i) => {
            const ok = res.gaps[i].state === 'correct' || (how === 'shown' && res.gaps[i].state !== 'wrong');
            input.readOnly = true;
            input.classList.toggle('is-right', ok);
            input.classList.toggle('is-wrong', !ok);
          });
        },
        solution: (res, asSolution) => h('span', { class: 'sentence-ex', lang: tag }, sentenceWith(res, asSolution)),
      };
    }

    // Aus den Formen auswählen
    function buildChoice(item) {
      const choice = choiceOrder(item);
      let evaluateFn = null;
      const blank = h('span', { class: 'gap' }, '_____');
      const node = h('div', {},
        h('p', { class: 'sentence', lang: tag }, item.parts.map((p) => (p.gap === undefined ? p.text : blank))),
        h('div', { class: 'choices', role: 'group', 'aria-label': 'Formen zur Auswahl' }));
      const buttons = choice.options.map((text, i) => h('button', { type: 'button', class: 'choice-btn', lang: tag, onclick: () => pick(i) },
        h('span', { class: 'key', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, text)));
      node.lastChild.append(...buttons);
      let locked = false;
      function pick(i) {
        if (locked || buttons[i].disabled || !evaluateFn) return;
        const ok = i === choice.correct;
        evaluateFn(ok ? { state: 'correct', picked: i } : { state: 'wrong', picked: i, wrong: [choice.options[i]], first: choice.options[i] });
      }
      return {
        node,
        noSubmit: true,
        keys: true,
        bind(evaluate, setKeys) {
          evaluateFn = evaluate;
          setKeys((e) => {
            const n = Number(e.key);
            if (!locked && n >= 1 && n <= buttons.length && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pick(n - 1); }
          });
        },
        check: () => ({ empty: true }),
        mark(res) {
          buttons[res.picked].disabled = true;
          buttons[res.picked].classList.add('is-wrong');
        },
        canRetry: () => buttons.filter((b) => !b.disabled).length > 1,
        reveal(res, how) {
          locked = true;
          buttons.forEach((b, j) => {
            b.disabled = true;
            if (j === choice.correct) b.classList.add('is-right');
          });
          if (res.picked != null && res.picked !== choice.correct) buttons[res.picked].classList.add('is-wrong');
          blank.textContent = choice.options[choice.correct];
          blank.classList.add(how === 'wrong' ? 'is-wrong' : 'is-right');
        },
        solution: () => h('span', { class: 'sentence-ex', lang: tag }, segments(item).map((s) => (s.mark ? h('b', { class: 'form' }, s.text) : s.text))),
      };
    }

    // Satzteile in die richtige Reihenfolge bringen
    function buildOrder(item) {
      const tiles = shuffledChunks(item).map((text, id) => ({ text, id }));
      const chosen = [];
      const pool = h('div', { class: 'chunks pool', role: 'group', 'aria-label': 'Satzteile' });
      const line = h('div', { class: 'chunks answer-line', role: 'group', 'aria-label': 'Dein Satz', 'aria-live': 'polite' });
      let locked = false;
      let marks = [];
      // Nach jedem Klick wird neu gezeichnet; der Fokus bleibt dabei bei der Tastatur-Bedienung nicht verloren:
      // entfernter Satzteil → zurück im Vorrat, hinzugefügter → nächster Satzteil im Vorrat (sonst „Prüfen“)
      const chunkBtn = (tile, inLine, i) => h('button', {
        type: 'button', class: `chunk${inLine && marks[i] === false ? ' is-wrong' : ''}`, lang: tag, disabled: locked,
        dataset: { id: tile.id },
        onclick: () => {
          if (inLine) chosen.splice(i, 1); else chosen.push(tile);
          marks = [];
          render();
          const next = inLine ? pool.querySelector(`[data-id="${tile.id}"]`) : pool.firstElementChild ?? node.closest('form')?.querySelector('button[type=submit]');
          next?.focus();
        },
      }, tile.text);
      function render() {
        fill(pool, tiles.filter((t) => !chosen.includes(t)).map((t) => chunkBtn(t, false)));
        fill(line, chosen.length ? chosen.map((t, i) => chunkBtn(t, true, i)) : h('span', { class: 'muted small' }, 'Tippe die Satzteile in der richtigen Reihenfolge an.'));
        pool.parentNode?.classList.toggle('all-placed', chosen.length === tiles.length);
      }
      const node = h('div', { class: 'order' }, line, pool);
      render();
      return {
        node,
        focus: () => pool.firstChild?.focus(),
        check() {
          if (chosen.length < tiles.length) {
            toast('Setze erst alle Satzteile ein.', 'warn');
            return { empty: true };
          }
          const texts = chosen.map((t) => t.text);
          const res = checkOrder(item, texts, options);
          return { ...res, wrong: [texts.join(' ')], first: texts.join(' '), texts };
        },
        mark(res) {
          // Satzteile an der falschen Stelle gegen die nächstliegende richtige Reihenfolge markieren
          const closest = closestSolution(item, res.texts.join(' '), options);
          marks = orderMarks(res.texts, item.orders.find((o) => o.join(' ') === closest) ?? item.orders[0], options);
          render();
        },
        reveal(res) {
          locked = true;
          marks = [];
          render();
          line.classList.add(res.state === 'correct' ? 'is-right' : 'is-wrong');
        },
        solution: (res, asSolution) => h('span', { class: 'sentence-ex', lang: tag }, res && !asSolution ? res.texts.join(' ') : solutionText(item)),
      };
    }

    // Ganzer Satz: Fehler finden (Satz steht vorausgefüllt da), Umformen, Übersetzen
    function buildText(item) {
      const error = item.type === 'error';
      const input = h('input', {
        class: 'answer', lang: tag, value: error ? item.given : '', autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
        'aria-label': error ? 'Verbesserter Satz' : 'Dein Satz',
      });
      const shown = h('div', { class: 'diff', 'aria-live': 'polite' });
      const prompt = error ? null : h('p', { class: 'prompt-text', lang: item.type === 'translate' ? undefined : tag }, item.prompt);
      const chips = (tokens, cls) => h('span', { class: 'diff-line', lang: tag }, tokens.map((t) => h('span', { class: t.ok ? 'word-ok' : cls }, t.text, ' ')));
      const closestOf = (value) => closestSolution(item, value, options);
      return {
        node: h('div', { class: 'text-exercise' }, prompt, input, shown),
        input,
        focus() {
          input.focus();
          if (error) input.setSelectionRange(input.value.length, input.value.length);
        },
        check() {
          const value = input.value;
          if (!value.trim()) return { empty: true };
          const res = checkSentence(item, value, options);
          return { ...res, wrong: [value.trim()], first: value.trim(), value };
        },
        mark(res) {
          if (res.unchanged) {
            fill(shown, h('p', { class: 'small' }, 'Der Satz ist noch nicht verändert – irgendwo steckt ein Fehler.'));
          } else {
            const d = diffWords(res.value, closestOf(res.value), options);
            fill(shown, h('p', { class: 'small muted' }, 'Deine Antwort – rot markiert: passt nicht:'), chips(d.given, 'word-wrong'));
          }
          input.focus();
        },
        reveal(res, how) {
          input.readOnly = true;
          fill(shown);
          if (how === 'wrong' && res.value) fill(shown, h('p', { class: 'small muted' }, 'Dein Satz:'), chips(diffWords(res.value, closestOf(res.value), options).given, 'word-wrong'));
        },
        solution(res, asSolution) {
          const value = res?.value;
          const solutionSentence = res && res.match && !asSolution ? res.match : solutionText(item);
          // bei falscher Antwort: die Stelle markieren, an der sie abweicht; weitere gültige Lösungen nennen
          const d = asSolution && value ? diffWords(value, closestOf(value), options).expected : null;
          const others = asSolution ? item.solutions.flatMap((s) => expand(s).slice(0, 1)).filter((s) => s !== solutionText(item)).slice(0, 3) : [];
          return h('span', { class: 'sentence-ex', lang: tag },
            d ? h('span', { class: 'diff-line' }, d.map((t) => h('span', { class: t.ok ? 'word-ok' : 'word-fix' }, t.text, ' '))) : solutionSentence,
            others.length ? h('span', { class: 'muted small' }, ` · auch richtig: ${others.join(' · ')}`) : null);
        },
      };
    }

    // ---------- Ende der Runde ----------

    function finish() {
      leaveRound?.();
      ctx.cleanupKeys();
      const firstTry = results.filter((r) => r.firstTry).length;
      const asked = results.length; // Erstversuche; Wiederholungen zählen nicht mit
      const pct = asked ? Math.round((firstTry / asked) * 100) : 0;
      const missed = results.filter((r) => !r.correct);
      const outlook = h('p', { class: 'small muted' });
      const remaining = h('div', {});
      const perRuleGrade = [...states.entries()].map(([id, st]) => [ruleById.get(id), roundGrade(st.grades)]).filter(([, g]) => g);
      view(h('section', { class: 'panel result' },
        h('h1', {}, pct === 100 ? 'Perfekt!' : pct >= 70 ? 'Gut gemacht!' : 'Weiter üben!'),
        h('p', { class: 'score' }, `${firstTry} von ${asked} Aufgaben beim ersten Versuch richtig (${pct} %)`),
        outlook,
        h('ul', { class: 'rule-results' }, perRuleGrade.map(([rule, grade]) => h('li', {}, h('span', {}, rule.title), h('span', { class: `chip grade-${grade}` }, GRADE_TEXT[grade])))),
        missed.length
          ? h('div', {}, h('h2', {}, 'Noch üben'),
              h('ul', { class: 'wrong-list' }, missed.map(({ task }) => {
                const rule = ruleById.get(task.ruleId);
                const entry = rule.items.find((e) => e.id === task.itemId);
                return h('li', {}, h('span', { class: 'sentence-ex', lang: tag }, solutionText(entry.item)), ' ',
                  h('button', { class: 'btn ghost small', onclick: () => showRulePage(rule) }, [icon('book'), ` ${rule.title}`]));
              })))
          : null,
        remaining,
        h('div', { class: 'actions' },
          missed.length ? h('button', { class: 'btn', onclick: () => startRound(buildRound({ rules: usable, progress, seen, mode: 'free', ruleIds: [...new Set(missed.map((m) => m.task.ruleId))], perRule: 3, blocked: true })) }, 'Fehler wiederholen') : null,
          h('button', { class: 'btn ghost', onclick: setupView }, 'Einstellungen'),
          h('a', { class: 'btn ghost', href: '#/' }, 'Zur Übersicht'))));
      // Wann kommen die Regeln dieser Runde wieder? (schon auf dem Gerät verplant)
      const buckets = { morgen: 0, 'in 2–7 Tagen': 0, 'in 1–4 Wochen': 0, später: 0 };
      for (const id of states.keys()) {
        const p = progress.get(id);
        if (!p?.due) continue;
        const d = (new Date(p.due) - Date.now()) / 86400000;
        buckets[d <= 1.5 ? 'morgen' : d <= 7.5 ? 'in 2–7 Tagen' : d <= 30 ? 'in 1–4 Wochen' : 'später']++;
      }
      const parts = Object.entries(buckets).filter(([, n]) => n).map(([when, n]) => `${when}: ${n}`);
      outlook.textContent = parts.length ? `Kommt wieder – ${parts.join(' · ')}` : '';
      const left = dueNow() + (nextNew() ? 1 : 0);
      if (left) {
        fill(remaining, h('p', {}, `Heute noch fällig oder neu: ${left} ${left === 1 ? 'Regel' : 'Regeln'}`),
          h('button', { class: 'btn primary', onclick: () => { mode = 'due'; startRound(); } }, 'Weiterlernen'));
      }
    }

    next();
  }

  // Sonderzeichen-Leiste für das zuletzt benutzte Eingabefeld (wie bei Vokabeln: Fokus bleibt im Feld)
  function charBar(ui, langTag_, chars) {
    const inputs = ui.inputs ?? (ui.input ? [ui.input] : []);
    if (!chars.length || !inputs.length) return null;
    let last = inputs[0];
    for (const input of inputs) input.addEventListener('focus', () => { last = input; });
    return h('div', { class: 'charbar', role: 'group', 'aria-label': 'Sonderzeichen einfügen' }, chars.map((ch) => h('button', {
      type: 'button', class: 'char', lang: langTag_, 'aria-label': `${ch} einfügen`,
      onpointerdown: (e) => e.preventDefault(),
      onclick: () => {
        if (last.readOnly) return;
        const start = last.selectionStart ?? last.value.length;
        last.setRangeText(ch, start, last.selectionEnd ?? start, 'end');
        last.focus();
      },
    }, ch)));
  }

  ctx.setLeaveGuard(() => { leaveRound?.(); ctx.progressListeners.delete(onProgress); ctx.cleanupKeys(); stopSpeaking(); return true; });
  setupView();
}
