import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  choiceOptions, clozeFor, editorChars, exampleSide, gapProblem, gradeFor, hintPattern, hintTarget, langTag, markGap, maxHints, pickExercise, specialChars, speechLang, speechText,
} from '../public/exercises.js';

const fixed = (v) => () => v;

test('Lernleiter: neu → Einführung, dann Eintippen, später Lückentext oder Hören', () => {
  const base = { mode: 'auto', choiceOk: true, clozeOk: true, listenOk: true };
  assert.equal(pickExercise({ ...base, level: 0 }), 'intro');
  assert.equal(pickExercise({ ...base, level: 0, knownOther: true }), 'choice', 'Gegenrichtung bekannt: keine Einführung');
  assert.equal(pickExercise({ ...base, level: 1 }), 'type');
  assert.equal(pickExercise({ ...base, level: 3, random: fixed(0.1) }), 'cloze');
  assert.equal(pickExercise({ ...base, level: 3, random: fixed(0.5) }), 'listen');
  assert.equal(pickExercise({ ...base, level: 3, random: fixed(0.9) }), 'type');
  assert.equal(pickExercise({ ...base, level: 3, clozeOk: false, listenOk: false }), 'type');
});

test('feste Modi bleiben bei ihrer Übung', () => {
  assert.equal(pickExercise({ mode: 'flip', level: 0 }), 'flip');
  assert.equal(pickExercise({ mode: 'type', level: 0, clozeOk: true }), 'type');
  assert.equal(pickExercise({ mode: 'choice', level: 4, choiceOk: true }), 'choice');
  assert.equal(pickExercise({ mode: 'choice', level: 4, choiceOk: false }), 'flip', 'zu kleine Liste');
});

test('Bewertung: Auswählen und Tipps zählen als „hard“', () => {
  assert.equal(gradeFor('choice', { correct: true }), 'hard');
  assert.equal(gradeFor('choice', { correct: false }), 'again');
  assert.equal(gradeFor('type', { correct: true }), 'good');
  assert.equal(gradeFor('type', { correct: true, hints: 2 }), 'hard');
  assert.equal(gradeFor('cloze', { correct: false, almost: true }), 'hard');
  assert.equal(gradeFor('listen', { correct: false }), 'again');
});

const words = [
  { id: 1, a: 'to go', b: 'gehen' },
  { id: 2, a: 'to run', b: 'laufen' },
  { id: 3, a: 'the dog', b: 'der Hund' },
  { id: 4, a: 'to see', b: 'sehen' },
  { id: 5, a: 'big; large', b: 'groß' },
  { id: 6, a: 'to swim', b: 'schwimmen' },
  { id: 7, a: 'large', b: 'weit' },
];

test('Auswählen: vier Möglichkeiten, ähnliche Ablenker, keine doppelten Lösungen', () => {
  const { options, correct } = choiceOptions(words, words[0], 'a', { random: fixed(0) });
  assert.equal(options.length, 4);
  assert.equal(options[correct], 'to go');
  assert.equal(new Set(options).size, 4);
  assert.ok(options.filter((o) => o.startsWith('to ')).length === 4, 'Verben als Ablenker für Verben');
  // „large“ ist eine Variante von „big; large“ und darf nicht als falsche Antwort erscheinen
  const big = choiceOptions(words, words[4], 'a', { random: fixed(0) });
  assert.ok(!big.options.includes('large'));
});

test('Auswählen braucht mindestens einen Ablenker', () => {
  assert.equal(choiceOptions([words[0]], words[0], 'a'), null);
  assert.equal(choiceOptions(words.slice(0, 2), words[0], 'b').options.length, 2);
});

test('Tipps: erste Buchstaben jedes Worts, Rest als Lücken', () => {
  assert.equal(hintTarget('(to) go; walk'), 'to go');
  assert.equal(hintPattern('to go', 1), 't _   g _');
  assert.equal(hintPattern("l'école", 2), "l ' é _ _ _ _");
  assert.equal(maxHints('der Hund'), 3);
  assert.equal(maxHints('a'), 1);
});

test('Lückentext: Wort im Satz finden oder markierte Lücke nehmen', () => {
  const dog = { a: 'dog', b: 'Hund', example: 'The Dog barks at the doghouse.' };
  assert.deepEqual(clozeFor(dog, 'a'), { before: 'The ', gap: 'Dog', after: ' barks at the doghouse.' });
  assert.equal(clozeFor(dog, 'b'), null, 'Satz gehört zu Seite A');
  const go = { a: '(to) go', b: 'gehen', example: 'Yesterday I *went* home.' };
  assert.deepEqual(clozeFor(go, 'a', { langA: 'Englisch', langB: 'Deutsch' }), { before: 'Yesterday I ', gap: 'went', after: ' home.' });
  const de = { a: 'gehen', b: '(to) go', example: 'Yesterday I *went* home.' };
  assert.equal(exampleSide(de, { langA: 'Deutsch', langB: 'Englisch' }), 'b', 'deutsche Seite A: Satz gehört zu B');
  assert.equal(clozeFor({ a: 'cat', b: 'Katze', example: 'Cats are cute.' }, 'a'), null, 'nur ganze Wörter');
  assert.equal(clozeFor({ a: 'cat', b: 'Katze', example: '' }, 'a'), null);
});

test('Sprachausgabe: Sprachcode aus der Bezeichnung, Text ohne Klammern', () => {
  assert.equal(speechLang('Englisch'), 'en-GB');
  assert.equal(speechLang('Englisch (USA)'), 'en-US');
  assert.equal(speechLang('Französisch'), 'fr-FR');
  assert.equal(speechLang('en-AU'), 'en-AU');
  assert.equal(speechLang('Latein'), null);
  assert.equal(speechLang(''), null);
  assert.equal(speechText('(to) go; walk'), 'to go, walk');
});

test('Französisch: elidierte Artikel gelten als Signalwort beim Auswählen', () => {
  const fr = [
    { id: 1, a: "l'arbre", b: 'der Baum' }, { id: 2, a: 'manger', b: 'essen' }, { id: 3, a: "l'école", b: 'die Schule' },
    { id: 4, a: 'courir', b: 'laufen' }, { id: 5, a: "l'eau", b: 'das Wasser' }, { id: 6, a: 'parler', b: 'sprechen' },
  ];
  const { options } = choiceOptions(fr, fr[0], 'a', { random: fixed(0) });
  assert.deepEqual(options.filter((o) => o.startsWith("l'")).length, 3, 'Nomen mit l\' als Ablenker für ein Nomen mit l\'');
});

test('Sonderzeichen aus den Wörtern der Liste, ohne Zeichen der deutschen Tastatur', () => {
  const words = [
    { a: 'le cœur', b: 'das Herz' }, { a: 'le garçon', b: 'der Junge' }, { a: 'l’été', b: 'der Sommer' },
    { a: 'Été', b: 'Sommer' }, { a: '¿Qué tal?', b: 'Wie geht’s?' }, { a: 'el niño', b: 'das Kind' },
  ];
  assert.deepEqual(specialChars(words, 'a'), ['ç', 'é', 'ñ', 'œ', 'É', '¿']);
  assert.deepEqual(specialChars(words, 'b'), [], 'ä, ö, ü, ß hat die deutsche Tastatur');
});

test('Vorlesen: Französisch aus Frankreich, Spanisch aus Spanien', () => {
  assert.equal(speechText('bueno/a'), 'bueno, buena');
  assert.equal(speechLang('Französisch'), 'fr-FR');
  assert.equal(speechLang('Französisch (Kanada)'), 'fr-FR');
  assert.equal(speechLang('Spanisch (Lateinamerika)'), 'es-ES');
  assert.equal(speechLang('Español'), 'es-ES');
  assert.equal(speechLang('fr-CA'), 'fr-FR', 'auch als Code');
  assert.equal(speechLang('es-MX'), 'es-ES');
  assert.equal(speechLang('en-AU'), 'en-AU');
});

test('Sprachkennung für lang-Attribute, auch ohne Stimme', () => {
  assert.equal(langTag('Latein'), 'la');
  assert.equal(langTag('Altgriechisch'), 'grc');
  assert.equal(langTag('Französisch'), 'fr-FR');
  assert.equal(langTag('Deutsch'), 'de-DE');
  assert.equal(langTag('Klingonisch'), null);
  assert.equal(speechLang('Latein'), null, 'Vorlesen bleibt für Latein aus');
});

test('Lücke automatisch setzen: Artikel und Klammern dürfen fehlen, bereits markiert bleibt', () => {
  assert.equal(markGap('Le fromage est bon.', 'le fromage'), 'Le *fromage* est bon.');
  assert.equal(markGap('The dog barks.', 'the dog'), 'The *dog* barks.');
  assert.equal(markGap('I like my dog.', 'the dog'), 'I like my *dog*.');
  assert.equal(markGap("J'aime l'eau.", "l'eau"), "J'aime l'*eau*.");
  assert.equal(markGap('The day is nice.', 'today'), null, '„to“ nur als eigenes Wort');
  assert.equal(markGap('I am here today.', 'today'), 'I am here *today*.');
  assert.equal(markGap('We go home.', '(to) go'), 'We *go* home.');
  assert.equal(markGap('We *go* home.', 'go'), null);
  assert.equal(markGap('Nous buvons de l\'eau.', 'boire'), null);
  assert.equal(markGap('', 'dog'), null);
});

test('Hinweis im Editor, wenn aus dem Beispielsatz kein Lückentext wird', () => {
  assert.equal(gapProblem({ a: 'boire', b: 'trinken', example: 'Nous buvons de l\'eau.' }), true);
  assert.equal(gapProblem({ a: 'boire', b: 'trinken', example: 'Nous *buvons* de l\'eau.' }), false);
  assert.equal(gapProblem({ a: 'dog', b: 'Hund', example: 'The dog barks.' }), false);
  assert.equal(gapProblem({ a: 'dog', b: 'Hund', example: '' }), false);
});

test('Sonderzeichen-Leiste im Editor je Sprache', () => {
  assert.ok(editorChars('fr-FR').includes('ç'));
  assert.ok(editorChars('es-ES').includes('ñ'));
  assert.deepEqual(editorChars('en-GB'), []);
  assert.deepEqual(editorChars(null), []);
});
