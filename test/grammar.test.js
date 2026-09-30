import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asKind, buildRound, capabilities, checkGaps, checkOrder, checkSentence, checkText, choiceOrder, closestSolution, diffWords,
  expand, feedbackFor, gradeFor, introKinds, lastItem, matchItems, orderMarks, parseItem, parseRulesText, pickExamples, pickItems,
  pickKind, roundGrade, rulesToText, segments, shuffledChunks, solutionText, splitExplanation, splitItems, validateRules,
} from '../public/grammar.js';

// Zufall mit festem Ablauf
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const item = (source) => {
  const parsed = parseItem(source);
  assert.equal(parsed.error, undefined, `${source}: ${parsed.error}`);
  return parsed;
};

// ---------- Parser ----------

test('Lücke mit Varianten, Grundform und mehreren Lücken', () => {
  const one = item('She *has lived* (live) here since 2010.');
  assert.equal(one.type, 'gap');
  assert.deepEqual(one.gaps, [{ answers: ['has lived'], hint: 'live' }]);
  assert.deepEqual(one.parts, [{ text: 'She ' }, { gap: 0 }, { text: ' here since 2010.' }]);

  const variants = item("I *haven't seen|have not seen* (not see) him for weeks.");
  assert.deepEqual(variants.gaps[0].answers, ["haven't seen", 'have not seen']);

  const two = item('*Has* she *lived* (live) here?');
  assert.equal(two.gaps.length, 2);
  assert.equal(two.gaps[0].hint, '');
  assert.equal(two.gaps[1].hint, 'live');

  assert.equal(item('He *is* (very) happy.').gaps[0].hint, 'very', 'Klammer direkt hinter der Lücke ist der Hinweis');
  assert.equal(item('He *is*(be) happy.').gaps[0].hint, 'be', 'auch ohne Leerzeichen');
  assert.deepEqual(item('They *(have) known* each other.').gaps[0].answers, ['(have) known'], 'Klammern in der Lücke sind optionale Teile');
});

test('Auswählen: die erste Form ist richtig', () => {
  const c = item('They {have known|knew|are knowing} each other since school.');
  assert.equal(c.type, 'choice');
  assert.deepEqual(c.options, ['have known', 'knew', 'are knowing']);
  assert.deepEqual(c.gaps, [{ answers: ['have known'], hint: '' }]);
  const shuffled = choiceOrder(c, seeded(3));
  assert.equal(shuffled.options[shuffled.correct], 'have known');
  assert.deepEqual([...shuffled.options].sort(), [...c.options].sort());
});

test('Phase-2-Typen: Fehler, Ordnen, Übersetzen, Umformen', () => {
  const e = item('Fehler: He have worked here. → He has worked here.');
  assert.deepEqual({ type: e.type, given: e.given, solutions: e.solutions }, { type: 'error', given: 'He have worked here.', solutions: ['He has worked here.'] });
  assert.equal(item('fehler finden: a b -> a c').type, 'error', 'Kleinschreibung, „finden“ und -> gehen auch');

  const o = item('Ordnen: I / have never been / to Spain');
  assert.deepEqual(o.chunks, ['I', 'have never been', 'to Spain']);
  assert.equal(item('Ordnen: Yesterday / I / went home | I / went home / yesterday').orders.length, 2);

  const t = item('Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years. | I’ve known her for three years.');
  assert.equal(t.type, 'translate');
  assert.equal(t.prompt, 'Ich kenne sie seit drei Jahren.');
  assert.equal(t.solutions.length, 2);
  assert.equal(item('Uebersetzen: a → b').type, 'translate');

  const u = item('Umformen: Ins Passiv: They built the house. → The house was built.');
  assert.equal(u.type, 'transform');
  assert.equal(u.prompt, 'Ins Passiv: They built the house.');
});

test('Hinweise: gezielt je falscher Antwort oder allgemein', () => {
  const it = item('They *have known* each other since school.\n! knew|know = Seit wann? Mit „since“ steht das present perfect.\n! Denk an das Signalwort.');
  assert.deepEqual(it.feedback, [
    { keys: ['knew', 'know'], text: 'Seit wann? Mit „since“ steht das present perfect.' },
    { keys: null, text: 'Denk an das Signalwort.' },
  ]);
  assert.equal(it.source.split('\n').length, 3);
});

test('Fehlermeldungen nennen die Zeile der Aufgabe', () => {
  const bad = {
    '': /leer/,
    'Kein Stern in diesem Satz.': /Keine Lücke/,
    'Ein *Stern bleibt offen.': /nicht geschlossen/,
    'Zwei Sternchen ** leer.': /Lücke zwischen den Sternchen ist leer/,
    'They {a} each other.': /2 bis 4/,
    'They {a|b|c|d|e} each other.': /2 bis 4/,
    'They {a|a} each other.': /zweimal/,
    'They {a||b} each other.': /leer/,
    'They {a|b} and {c|d}.': /Nur eine Auswahl/,
    'They {a|b} and *c*.': /nicht mischen/,
    'Fehler: nur ein Satz': /Erwartet/,
    'Fehler: gleich → gleich': /identisch/,
    'Ordnen: nur ein Teil': /Mindestens zwei/,
    'Ordnen: a / / b': /leer/,
    'Ordnen: a / b | a / c': /dieselben Satzteile/,
    'Übersetzen: Hallo': /Erwartet/,
    'Umformen: → Lösung': /Erwartet/,
    '! Hinweis ohne Aufgabe': /unter eine Aufgabe/,
  };
  for (const [source, re] of Object.entries(bad)) {
    const r = parseItem(source);
    assert.match(r.error ?? '', re, source);
    assert.equal(r.part, 0);
  }
  assert.deepEqual(parseItem('Wir *gehen*.\n!'), { error: 'Der Hinweis ist leer.', part: 1 });
  assert.match(parseItem('Wir *gehen*.\n! = Hinweis').error, /Erwartet: „! falsche Antwort/);
  assert.equal(parseItem('Wir *gehen*.\n! gut = ').part, 1);
  assert.match(parseItem('Wir *gehen*.\nnoch ein Satz').error, /beginnen mit „!“/);
  assert.match(parseItem(`Wir *${'x'.repeat(2000)}*.`).error, /zu lang/);
});

test('Text in Aufgaben zerlegen, Hinweise hängen an der Aufgabe darüber', () => {
  const { items, errors } = splitItems('! verwaist\n\nA *b* c.\n! b = x\n\n  \nD *e* f.\n');
  assert.deepEqual(errors, [{ line: 1, error: 'Ein Hinweis mit „!“ gehört unter eine Aufgabe.' }]);
  assert.deepEqual(items.map((i) => i.source), ['A *b* c.\n! b = x', 'D *e* f.']);
  assert.deepEqual(items.map((i) => i.lines), [[3, 4], [7]], 'echte Zeilennummern trotz Leerzeilen');
  assert.deepEqual(splitItems('').items, []);
});

// ---------- Prüfen ----------

const opts = { caseSensitive: false, accentSensitive: true };

test('Lücken prüfen: richtig, Varianten, optionale Teile, Groß-/Kleinschreibung', () => {
  const gap = item('I *haven’t seen|have not seen* (not see) him.');
  assert.equal(checkGaps(gap, ["haven't seen"], opts).state, 'correct', 'Apostroph wird vereinheitlicht');
  assert.equal(checkGaps(gap, ['Have not seen.'], opts).state, 'correct', 'Variante, Großschreibung und Punkt egal');
  assert.equal(checkGaps(gap, ['have seen'], opts).state, 'wrong');
  assert.equal(checkGaps(gap, [''], opts).state, 'wrong');
  assert.equal(checkGaps(item('They *(have) known* it.'), ['known'], opts).state, 'correct', 'optionaler Teil');
  assert.equal(checkGaps(item('They *(have) known* it.'), ['have known'], opts).state, 'correct');
  const strict = { caseSensitive: true, accentSensitive: true };
  assert.deepEqual(checkGaps(item('Das ist *Hund*.'), ['hund'], strict).gaps[0], { state: 'almost', reason: 'case', match: 'Hund' });
});

test('mehrere Lücken: die schlechteste zählt, jede Lücke einzeln', () => {
  const two = item('*Has* she *lived* here?');
  const both = checkGaps(two, ['has', 'lived'], opts);
  assert.equal(both.state, 'correct');
  const res = checkGaps(two, ['have', 'lived'], opts);
  assert.equal(res.state, 'wrong');
  assert.deepEqual(res.gaps.map((g) => g.state), ['wrong', 'correct']);
  assert.equal(checkGaps(two, ['has', 'live'], opts).gaps[1].state, 'wrong', 'fehlende Endung ist kein Tippfehler');
});

test('Akzente: fast, außer die Liste ignoriert Akzente', () => {
  const fr = item('Elle *est allée* (aller) au cinéma.');
  assert.deepEqual(checkGaps(fr, ['est allee'], opts).gaps[0], { state: 'almost', reason: 'accents', match: 'est allée' });
  assert.equal(checkGaps(fr, ['est allee'], { accentSensitive: false }).state, 'correct');
});

test('Tippfehler: vertauschte oder ausgelassene Buchstaben ja – andere Formen nie', () => {
  const almost = (answer, input) => checkText(input, [answer], opts);
  assert.equal(almost('received', 'recieved').state, 'almost', 'vertauscht');
  assert.equal(almost('received', 'recieved').reason, 'typo');
  assert.equal(almost('running', 'runing').state, 'almost', 'Buchstabe ausgelassen');
  assert.equal(almost('address', 'adress').state, 'almost');
  assert.equal(almost('has lived', 'has lvied').state, 'almost', 'ein Wort abweichend');
  // das sind falsche Formen, keine Tippfehler
  assert.equal(almost('knew', 'know').state, 'wrong', 'Buchstabe ersetzt');
  assert.equal(almost('has lived', 'has live').state, 'wrong', 'Endung fehlt');
  assert.equal(almost('lived', 'lives').state, 'wrong');
  assert.equal(almost('walked', 'walk').state, 'wrong');
  assert.equal(almost('has lived', 'have lived').state, 'wrong');
  assert.equal(almost('has', 'ahs').state, 'almost', 'kurze Wörter: Vertauschung');
  assert.equal(almost('has', 'as').state, 'wrong', 'kurze Wörter: kein Ausgelassen');
  assert.equal(almost('has lived here', 'has lvied here too').state, 'wrong', 'zusätzliches Wort');
});

test('Sätze prüfen: Fehler finden, Übersetzen mit mehreren Lösungen, Zeichensetzung egal', () => {
  const e = item('Fehler: He have worked here. → He has worked here.');
  assert.equal(checkSentence(e, 'He has worked here.', opts).state, 'correct');
  assert.equal(checkSentence(e, 'he has worked here', opts).state, 'correct');
  assert.deepEqual(checkSentence(e, 'He have worked here.', opts), { state: 'wrong', unchanged: true });
  assert.equal(checkSentence(e, 'He has worked there.', opts).state, 'wrong');

  const t = item('Übersetzen: Ich kenne sie. → I know her. | I do know her.');
  assert.equal(checkSentence(t, 'I do know her', opts).state, 'correct');
  assert.equal(checkSentence(t, 'I knew her', opts).state, 'wrong');

  const comma = item('Umformen: Zeit ändern: Yesterday, I went home. → Yesterday, I go home.');
  assert.equal(checkSentence(comma, 'Yesterday I go home', opts).state, 'correct', 'Komma fehlt: egal');
});

test('Satzbau: nur die richtige Reihenfolge (auch alternative)', () => {
  const o = item('Ordnen: Yesterday / I / went home | I / went home / yesterday');
  assert.equal(checkOrder(o, ['Yesterday', 'I', 'went home'], opts).state, 'correct');
  assert.equal(checkOrder(o, ['I', 'went home', 'Yesterday'], opts).state, 'correct', 'zweite Reihenfolge');
  assert.equal(checkOrder(o, ['I', 'Yesterday', 'went home'], opts).state, 'wrong');
  assert.deepEqual(orderMarks(['I', 'Yesterday', 'went home'], ['Yesterday', 'I', 'went home']), [false, false, true]);
});

test('Satzteile mischen: nie in der richtigen Reihenfolge', () => {
  const o = item('Ordnen: I / have never been / to Spain');
  for (let seed = 1; seed < 30; seed++) {
    assert.notDeepEqual(shuffledChunks(o, seeded(seed)), o.chunks, `seed ${seed}`);
  }
  assert.deepEqual([...shuffledChunks(o)].sort(), [...o.chunks].sort());
});

// ---------- Fehlerstelle ----------

test('Wort-Diff markiert, was nicht zur Lösung passt', () => {
  const d = diffWords('He have worked here.', 'He has worked here.', opts);
  assert.deepEqual(d.given.map((w) => w.ok), [true, false, true, true]);
  assert.deepEqual(d.expected.map((w) => w.ok), [true, false, true, true]);
  const missing = diffWords('He worked here', 'He has worked here', opts);
  assert.deepEqual(missing.given.map((w) => w.ok), [true, true, true]);
  assert.deepEqual(missing.expected.map((w) => w.ok), [true, false, true, true], 'fehlendes Wort in der Lösung');
  assert.deepEqual(diffWords('', 'a b', opts).expected.map((w) => w.ok), [false, false]);
  assert.equal(diffWords('Home.', 'home', opts).given[0].ok, true, 'Satzzeichen und Großschreibung stören nicht');
});

test('nächste Lösung für die Markierung', () => {
  const t = item('Übersetzen: x → I have known her for years. | She has gone home.');
  assert.equal(closestSolution(t, 'She have gone home', opts), 'She has gone home.');
  assert.equal(closestSolution(item('Ordnen: a / b | b / a'), 'b a', opts), 'b a');
});

// ---------- Hinweise ----------

test('Hinweis: passende falsche Antwort, sonst allgemein, sonst Merksatz', () => {
  const it = item('They *have known* each other.\n! knew = Mit „since“ steht das present perfect.\n! have knew|has known = Partizip!\n! Schau aufs Signalwort.');
  const rule = { summary: 'since/for → present perfect' };
  assert.deepEqual(feedbackFor(it, ['knew'], rule), { text: 'Mit „since“ steht das present perfect.', source: 'item' });
  assert.equal(feedbackFor(it, ['Knew.'], rule).text, 'Mit „since“ steht das present perfect.', 'Groß-/Kleinschreibung und Punkt egal');
  assert.equal(feedbackFor(it, ['have knew'], rule).text, 'Partizip!');
  assert.equal(feedbackFor(it, ['They have knew each other.'], rule).text, 'Partizip!', 'in längerer Antwort als ganze Wörter');
  assert.equal(feedbackFor(it, ['unknew'], rule).text, 'Schau aufs Signalwort.', 'Teilwörter zählen nicht → allgemeiner Hinweis');
  const plain = item('They *have known* each other.\n! knew = x');
  assert.deepEqual(feedbackFor(plain, ['other'], rule), { text: 'since/for → present perfect', source: 'rule' }, 'Merksatz der Regel');
  assert.equal(feedbackFor(plain, [], undefined).text, '');
  assert.equal(feedbackFor(item('A *b* c.'), ['x'], rule).source, 'rule');
});

// ---------- Anzeige ----------

test('Satz mit der Lösung für Anzeige und Vorlesen', () => {
  const gap = item('She *has lived* (live) here since *2010*.');
  assert.equal(solutionText(gap), 'She has lived here since 2010.');
  assert.deepEqual(segments(gap).filter((s) => s.mark).map((s) => s.text), ['has lived', '2010']);
  assert.equal(solutionText(item('They *(have) known* it.')), 'They have known it.', 'optionale Teile ausgeschrieben');
  assert.equal(solutionText(item('Ordnen: I / have never been / to Spain')), 'I have never been to Spain');
  assert.equal(solutionText(item('Fehler: a b → He has worked here.')), 'He has worked here.');
  assert.equal(solutionText(item('Übersetzen: Hallo → Hello | Hi')), 'Hello');
});

// ---------- Aufgabenarten und Auswahl ----------

test('Übungsarten einer Aufgabe: Lücke wird zur Auswahl, wenn Ablenker bekannt sind', () => {
  assert.deepEqual(capabilities(item('A *b* c.')), ['gap']);
  const withErrors = item('They *have known* it.\n! knew = x\n! known|have known = y\n! Allgemein');
  assert.deepEqual(capabilities(withErrors), ['gap', 'choice']);
  const asChoice = asKind(withErrors, 'choice');
  assert.equal(asChoice.type, 'choice');
  assert.deepEqual(asChoice.options, ['have known', 'knew', 'known'], 'richtige Antwort ist dabei, nicht als Ablenker');
  assert.equal(asKind(item('A *b* c.'), 'choice'), null);
  assert.deepEqual(capabilities(item('A {b|c} d.')), ['choice'], 'Auswahl wird nie zur Lücke');
  assert.equal(asKind(item('A {b|c} d.'), 'gap'), null);
  assert.deepEqual(capabilities(item('Fehler: a → b')), ['error']);
  assert.deepEqual(capabilities(item('Ordnen: a / b')), ['order']);
  assert.deepEqual(capabilities(item('Umformen: a → b')), ['translate']);
  assert.deepEqual(capabilities(item('Übersetzen: a → b')), ['translate']);
  // zwei Lücken: keine Auswahl
  assert.deepEqual(capabilities(item('*A* *b* c.\n! x = y')), ['gap']);
  // Ablenker gleich der Lösung zählen nicht
  assert.deepEqual(capabilities(item('A *b|c* d.\n! C = x')), ['gap']);
});

test('Einführung: erst Auswählen, dann Lücke; fehlende Arten werden ersetzt', () => {
  assert.deepEqual(introKinds(['gap', 'choice'], 4), ['choice', 'choice', 'gap', 'gap']);
  assert.deepEqual(introKinds(['gap'], 3), ['gap', 'gap', 'gap']);
  assert.deepEqual(introKinds(['choice'], 4), ['choice', 'choice', 'choice', 'choice']);
  assert.deepEqual(introKinds(['order'], 2), ['order', 'order']);
});

test('Stufen: Anfang vor allem Lücke, später im Wechsel, nach Fehler Auswählen', () => {
  const r = seeded(7);
  const kinds = ['gap', 'choice', 'error', 'order', 'translate'];
  const at1 = new Set(Array.from({ length: 60 }, () => pickKind({ level: 1, kinds, random: r })));
  assert.deepEqual([...at1].sort(), ['gap', 'order'], 'Auswählen nur als Ausweichlösung');
  const at3 = new Set(Array.from({ length: 200 }, () => pickKind({ level: 3, kinds, random: r })));
  assert.deepEqual([...at3].sort(), ['error', 'gap', 'order', 'translate']);
  assert.equal(pickKind({ level: 1, kinds, retry: true }), 'choice');
  assert.equal(pickKind({ level: 3, kinds, retry: true, random: () => 0 }), 'gap', 'ab „lernt“ keine Erleichterung');
  assert.equal(pickKind({ level: 1, kinds: ['choice'] }), 'choice', 'nichts anderes da');
  assert.equal(pickKind({ level: 1, kinds: [] }), null);
  // Abwechslung: nicht zweimal dieselbe Art, wenn es eine andere gibt
  for (let i = 0; i < 50; i++) assert.notEqual(pickKind({ level: 3, kinds, previous: 'gap', random: r }), 'gap');
  assert.equal(pickKind({ level: 3, kinds: ['gap'], previous: 'gap' }), 'gap');
});

test('Aufgaben wählen: am längsten nicht gesehen, nie gesehene zuerst, nicht die letzte', () => {
  const entries = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const seen = { 1: '2026-09-01', 2: '2026-09-20', 3: '2026-09-10' }; // 4 noch nie
  assert.deepEqual(pickItems(entries, seen, 2, { random: seeded(1) }).map((e) => e.id), [4, 1]);
  assert.deepEqual(pickItems(entries, seen, 4).map((e) => e.id), [4, 1, 3, 2]);
  assert.equal(lastItem(entries, seen), 2);
  assert.equal(lastItem(entries, {}), null);
  // die zuletzt bearbeitete kommt nur, wenn es nicht anders geht
  const recent = { 1: '2026-09-29', 2: '2026-09-01', 3: '2026-09-02', 4: '2026-09-03' };
  assert.deepEqual(pickItems(entries, recent, 4, { avoid: 1 }).map((e) => e.id), [2, 3, 4, 1]);
  assert.deepEqual(pickItems(entries, { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }, 3, { avoid: 1 }).map((e) => e.id), [2, 3, 4], 'verdrängt');
  assert.deepEqual(pickItems(entries.slice(0, 2), {}, 2, { avoid: 1 }).length, 2);
});

// ---------- Runde ----------

function makeRules() {
  const gapItem = (n, extra = '') => ({ id: n, item: item(`Sentence ${n} *form${n}* here.${extra}`) });
  return [
    { id: 1, items: [1, 2, 3, 4, 5, 6].map((n) => gapItem(n, '\n! bad = x')) },
    { id: 2, items: [11, 12, 13].map((n) => gapItem(n)) },
    { id: 3, items: [21, 22, 23, 24].map((n) => gapItem(n, '\n! bad = x')) },
    { id: 4, items: [31, 32].map((n) => gapItem(n)) },
    { id: 5, items: [] },
  ];
}
const row = (due, box = 2) => ({ due, box });

test('Heute fällig: fällige Regeln gemischt, eine neue Regel als Block vorweg', () => {
  const rules = makeRules();
  const progress = new Map([[2, row('2026-09-28T00:00:00Z')], [3, row('2026-09-27T00:00:00Z')], [4, row('2026-10-20T00:00:00Z')]]);
  const until = new Date('2026-09-30T23:59:59Z');
  const { tasks, newRuleId } = buildRound({ rules, progress, mode: 'due', until, random: seeded(5) });
  assert.equal(newRuleId, 1, 'die erste Regel ohne Lernstand, in Reihenfolge der Lehrkraft');
  const byRule = (id) => tasks.filter((t) => t.ruleId === id);
  assert.equal(byRule(1).length, 4, 'neue Regel: 2 × Auswählen + 2 × Lücke');
  assert.deepEqual(byRule(1).map((t) => t.kind), ['choice', 'choice', 'gap', 'gap']);
  assert.ok(byRule(1)[0].card, 'Regelkarte vor der ersten Aufgabe');
  assert.deepEqual(tasks.slice(0, 4).map((t) => t.ruleId), [1, 1, 1, 1], 'neue Regel geschlossen am Anfang');
  assert.equal(byRule(2).length, 2);
  assert.equal(byRule(3).length, 2);
  assert.equal(byRule(4).length, 0, 'noch nicht fällig');
  assert.equal(byRule(5).length, 0, 'Regel ohne Aufgaben');
  assert.ok(!byRule(2).some((t) => t.card), 'Karte nur bei neuen Regeln');
  // die beiden Aufgaben einer bekannten Regel sind verschieden
  assert.equal(new Set(byRule(3).map((t) => t.itemId)).size, 2);
});

test('Heute fällig: Anzahl der Regeln begrenzt, älteste zuerst; ohne neue Regel, wenn alle geübt sind', () => {
  const rules = makeRules().slice(0, 4);
  const progress = new Map(rules.map((r, i) => [r.id, row(`2026-09-${20 + i}T00:00:00Z`)]));
  const until = new Date('2026-09-30T23:59:59Z');
  const { tasks, newRuleId } = buildRound({ rules, progress, mode: 'due', maxRules: 2, until, random: seeded(2) });
  assert.equal(newRuleId, null);
  assert.deepEqual([...new Set(tasks.map((t) => t.ruleId))].sort(), [1, 2]);
  assert.deepEqual(buildRound({ rules, progress: new Map(), mode: 'due', until, random: seeded(2) }).tasks.every((t) => t.ruleId === 1), true);
});

test('gemischt: dieselbe Regel nicht direkt hintereinander', () => {
  const rules = makeRules().slice(1, 4);
  const progress = new Map(rules.map((r) => [r.id, row('2026-09-01T00:00:00Z')]));
  for (let seed = 1; seed <= 25; seed++) {
    const { tasks } = buildRound({ rules, progress, mode: 'due', until: new Date('2026-10-01'), random: seeded(seed) });
    tasks.slice(1).forEach((t, i) => assert.notEqual(t.ruleId, tasks[i].ruleId, `seed ${seed} an Stelle ${i}`));
  }
});

test('Frei üben: gewählte Regeln, nach Regeln geordnet oder gemischt', () => {
  const rules = makeRules();
  const progress = new Map([[2, row('2026-10-20T00:00:00Z')], [3, row('2026-10-20T00:00:00Z', 3)]]);
  const blocked = buildRound({ rules, progress, mode: 'free', ruleIds: [3, 2], perRule: 3, blocked: true, random: seeded(3) });
  assert.deepEqual(blocked.tasks.map((t) => t.ruleId), [2, 2, 2, 3, 3, 3], 'geblockt in der Reihenfolge der Liste');
  const mixed = buildRound({ rules, progress, mode: 'free', ruleIds: [2, 3], perRule: 3, random: seeded(3) });
  assert.equal(mixed.tasks.length, 6);
  assert.equal(new Set(mixed.tasks.map((t) => t.itemId)).size, 6, 'keine Aufgabe doppelt');
  const withNew = buildRound({ rules, progress, mode: 'free', ruleIds: [1, 2], perRule: 3, random: seeded(3) });
  assert.deepEqual(withNew.tasks.slice(0, 4).map((t) => t.ruleId), [1, 1, 1, 1], 'neue Regel als Block vorweg');
  assert.equal(withNew.newRuleId, null, 'newRuleId nur im Modus „fällig“');
  assert.equal(buildRound({ rules, progress, mode: 'free', ruleIds: [5] }).tasks.length, 0);
});

test('wenige Aufgaben: nicht mehr Aufgaben als vorhanden, keine doppelt', () => {
  const rules = makeRules();
  const progress = new Map([[4, row('2026-09-01T00:00:00Z')]]);
  const { tasks } = buildRound({ rules, progress, mode: 'free', ruleIds: [4], perRule: 5, random: seeded(4) });
  assert.deepEqual(tasks.map((t) => t.itemId).sort(), [31, 32]);
});

test('Stufen wirken in der Runde: Anfang nur Lücke, später Mischung der Arten', () => {
  const mk = (id, sources) => ({ id, items: sources.map((s, i) => ({ id: id * 100 + i, item: item(s) })) });
  const rule = mk(1, ['A *b* c.', 'Fehler: a b → a c', 'Ordnen: x / y / z', 'Umformen: Passiv → b', 'D *e* f.', 'Fehler: g h → g i']);
  const low = buildRound({ rules: [rule], progress: new Map([[1, row('2026-09-01', 1)]]), mode: 'free', ruleIds: [1], perRule: 4, random: seeded(9) });
  assert.ok(low.tasks.every((t) => ['gap', 'order'].includes(t.kind)), low.tasks.map((t) => t.kind).join());
  const high = buildRound({ rules: [rule], progress: new Map([[1, row('2026-09-01', 3)]]), mode: 'free', ruleIds: [1], perRule: 4, random: seeded(9) });
  assert.ok(new Set(high.tasks.map((t) => t.kind)).size >= 3, high.tasks.map((t) => t.kind).join());
  for (const t of [...low.tasks, ...high.tasks]) {
    const entry = rule.items.find((e) => e.id === t.itemId);
    assert.ok(capabilities(entry.item).includes(t.kind), 'Aufgabe passt zur Übungsart');
  }
});

test('Beispiele für die Regelkarte: bevorzugt Lücken mit hervorgehobener Form', () => {
  const entries = [1, 2, 3, 4].map((n) => ({ id: n, item: item(`S${n} *f${n}* x.`) })).concat([{ id: 9, item: item('Ordnen: a / b') }]);
  const ex = pickExamples(entries, 3, seeded(1));
  assert.equal(ex.length, 3);
  assert.ok(ex.every((e) => e.segments.some((s) => s.mark)));
  assert.equal(pickExamples(entries.slice(4), 3).length, 1);
  assert.equal(new Set(ex.map((e) => e.id)).size, 3);
});

// ---------- Bewertung ----------

test('Bewertung einer Aufgabe', () => {
  assert.equal(gradeFor('gap', { correct: true }), 'good');
  assert.equal(gradeFor('error', { correct: true, attempts: 1 }), 'good');
  assert.equal(gradeFor('choice', { correct: true }), 'hard', 'nur Wiedererkennen');
  assert.equal(gradeFor('gap', { correct: true, attempts: 2 }), 'hard', 'nach Hinweis');
  assert.equal(gradeFor('gap', { correct: true, helped: true }), 'hard', 'Regel vorher nachgelesen');
  assert.equal(gradeFor('gap', { correct: false, almost: true }), 'hard', 'Fast!');
  assert.equal(gradeFor('gap', { correct: false, attempts: 2 }), 'again');
  assert.equal(gradeFor('choice', { correct: false }), 'again');
});

test('Runde: die schlechteste Bewertung zählt', () => {
  assert.equal(roundGrade(['good', 'hard', 'good']), 'hard');
  assert.equal(roundGrade(['good', 'again']), 'again');
  assert.equal(roundGrade(['good', 'good']), 'good');
  assert.equal(roundGrade(['easy', 'good']), 'good');
  assert.equal(roundGrade([]), null);
  assert.equal(roundGrade(['quatsch']), null);
});

// ---------- Regeln prüfen, Aufgaben zuordnen, Datei ----------

test('Regeln prüfen: Pflichtfelder und Fehler mit Ort', () => {
  const ok = { title: 'Present perfect', summary: 'since/for', items: [{ source: 'She *has lived* here.' }] };
  assert.equal(validateRules([ok]), null);
  assert.match(validateRules([]), /keine Regeln/);
  assert.match(validateRules([{ ...ok, title: '' }]), /Regel 1: Bitte einen Titel/);
  assert.match(validateRules([{ ...ok, summary: '' }]), /Regel „Present perfect“: Der Merksatz fehlt/);
  assert.match(validateRules([{ ...ok, items: [] }]), /noch keine Aufgaben/);
  assert.match(validateRules([ok, { ...ok, title: 'Zwei', items: [{ source: 'ok *x* y' }, { source: 'kaputt' }] }]), /Regel „Zwei“, Aufgabe 2: Keine Lücke/);
  assert.match(validateRules(Array.from({ length: 101 }, () => ok)), /Höchstens 100 Regeln/);
});

test('Aufgaben beim Bearbeiten wiedererkennen: gleich, bearbeitet, neu', () => {
  const old = [
    { id: 1, source: 'She *has lived* here since 2010.' },
    { id: 2, source: 'They *have known* each other.\n! knew = x' },
    { id: 3, source: 'I *went* to school yesterday.' },
  ];
  const ids = matchItems(old, [
    'A totally new *sentence* here.', // neu
    'She *has lived* here since 2010.', // gleich, verschoben
    'I *went* to school yesterday morning.', // bearbeitet
    'They *have known* each other.\n! knew = anderer Hinweis', // Hinweis geändert
  ]);
  assert.deepEqual(ids, [null, 1, 3, 2]);
  assert.deepEqual(matchItems(old, []), []);
  assert.deepEqual(matchItems([], ['a *b* c.']), [null]);
  // ein anderer Satz mit derselben Lösung und ähnlichem Wortlaut erbt die ID nicht (Statistik gehört zum alten Satz)
  assert.deepEqual(matchItems([{ id: 5, source: 'I *went* to school yesterday.' }], ['I *went* to the park yesterday.']), [null]);
  // wechselt die gesuchte Form, ist es eine neue Aufgabe – auch bei sonst gleichem Satz
  assert.deepEqual(matchItems([{ id: 6, source: 'She *has lived* here since 2010.' }], ['She *lives* here since 2010.']), [null]);
  // nur Jahreszahl oder Hinweis geändert: dieselbe Aufgabe
  assert.deepEqual(matchItems([{ id: 7, source: 'She *has lived* (live) here since 2010.' }], ['She *has lived* (live) here since 2012.']), [7]);
  // doppelte Sätze bekommen verschiedene IDs
  assert.deepEqual(matchItems([{ id: 7, source: 'x *y* z' }, { id: 8, source: 'x *y* z' }], ['x *y* z', 'x *y* z']), [7, 8]);
});

test('Textdatei: Export und Import gleichen sich aus', () => {
  const rules = [
    { title: 'Present perfect', summary: 'since/for → present perfect', discover: true, explanation: '? Was fällt dir auf?\nMit *since* …\n\nZweiter Absatz.', tasks: 'She *has lived* here.\n! lived = Partizip\nFehler: a b → a c' },
    { title: 'Simple past', summary: 'yesterday → simple past', discover: false, explanation: '', tasks: 'I *went* home.' },
  ];
  const text = rulesToText(rules);
  assert.match(text, /^## Present perfect\nMerksatz: since\/for → present perfect\nEntdecken: ja\nErklärung:\n\? Was fällt dir auf\?/);
  assert.doesNotMatch(text, /Erklärung:\n\nAufgaben/);
  const back = parseRulesText(text);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.rules, rules);
  const messy = parseRulesText('Vorspann\n## \n## Regel\nMerksatz: x\nEntdecken: nein\nBla\n');
  assert.deepEqual(messy.errors.map((e) => e.line), [1, 2, 6]);
  assert.equal(messy.rules.length, 2);
  assert.equal(parseRulesText('## R\nErklärung: gleich in der Zeile\nweiter\nAufgaben: A *b* c.').rules[0].tasks, 'A *b* c.');
  assert.equal(parseRulesText('## R\nErklärung: gleich in der Zeile\nweiter').rules[0].explanation, 'gleich in der Zeile\nweiter');
});

test('Frage für „Entdecken“ aus der Erklärung', () => {
  assert.deepEqual(splitExplanation('? Wann steht welche Form?\nMit *since* …'), { question: 'Wann steht welche Form?', text: 'Mit *since* …' });
  assert.deepEqual(splitExplanation('Nur Text'), { question: '', text: 'Nur Text' });
  assert.deepEqual(splitExplanation(''), { question: '', text: '' });
});

test('expand: optionale Teile', () => {
  assert.deepEqual(expand('(have) known'), ['have known', 'known']);
  assert.deepEqual(expand('plain  text'), ['plain text']);
});

// ---------- Robustheit: der Server liest beliebige Eingaben ----------

test('zufällige Zeichenfolgen: Parser und Prüfung werfen nie einen Fehler', () => {
  const random = seeded(Number(process.env.FUZZ_SEED) || 42);
  const pieces = ['*', '{', '}', '|', '(', ')', '→', '->', '/', '!', '=', ' ', '  ', 'a', 'has', 'lived', 'é', 'Fehler:', 'Ordnen:', 'Übersetzen:', 'Umformen:', '\n', '\n!', '.', ',', '?', "'", '’', '0'];
  let valid = 0;
  for (let n = 0; n < 12000; n++) {
    const source = Array.from({ length: 1 + Math.floor(random() * 14) }, () => pieces[Math.floor(random() * pieces.length)]).join('');
    const parsed = parseItem(source);
    if (parsed.error) {
      assert.equal(typeof parsed.error, 'string', source);
      assert.ok(Number.isInteger(parsed.part) && parsed.part >= 0, source);
      continue;
    }
    valid++;
    const caps = capabilities(parsed);
    assert.ok(caps.length >= 1, source);
    for (const kind of caps) assert.ok(asKind(parsed, kind), `${source} → ${kind}`);
    assert.equal(typeof solutionText(parsed), 'string');
    segments(parsed);
    feedbackFor(parsed, ['a', ''], { summary: 'x' });
    if (parsed.gaps) checkGaps(parsed, parsed.gaps.map(() => 'a'), opts);
    else if (parsed.orders) checkOrder(parsed, [...parsed.chunks].reverse(), opts);
    else checkSentence(parsed, 'a b', opts);
    if (parsed.type === 'choice') choiceOrder(parsed, random);
    if (parsed.type === 'order') shuffledChunks(parsed, random);
    // die Lösung ist immer richtig
    if (parsed.gaps) assert.equal(checkGaps(parsed, parsed.gaps.map((g) => expand(g.answers[0])[0]), opts).state, 'correct', source);
    else if (parsed.orders) assert.equal(checkOrder(parsed, parsed.chunks, opts).state, 'correct', source);
    else if (parsed.type !== 'error') assert.equal(checkSentence(parsed, solutionText(parsed), opts).state, 'correct', source);
    // das erneute Lesen des bereinigten Textes ergibt dieselbe Aufgabe
    assert.deepEqual(parseItem(parsed.source).source, parsed.source);
  }
  assert.ok(valid > 100, `genug gültige Zufallsaufgaben (${valid})`);
  // Text in Aufgaben zerlegen und Datei lesen: ebenfalls robust
  for (let n = 0; n < 300; n++) {
    const text = Array.from({ length: 30 }, () => pieces[Math.floor(random() * pieces.length)]).join('');
    splitItems(text);
    parseRulesText(`## ${text}\nMerksatz: ${text}\nAufgaben:\n${text}`);
    matchItems([{ id: 1, source: text }], [text, text.slice(3)]);
  }
});

test('lange Eingaben brauchen keine Sekunden (keine aufwendigen Muster)', () => {
  const started = Date.now();
  const long = `${'*a '.repeat(3000)}${'{a|b '.repeat(3000)}${'( '.repeat(3000)}`;
  parseItem(long);
  parseItem(`Fehler: ${'a '.repeat(5000)} → ${'b '.repeat(5000)}`);
  splitItems(`${'x *y* z\n! a = b\n'.repeat(5000)}`);
  checkText('a '.repeat(5000), ['(a) '.repeat(200)], opts);
  diffWords('a b '.repeat(300), 'b a '.repeat(300), opts);
  assert.ok(Date.now() - started < 3000, `dauerte ${Date.now() - started} ms`);
});
