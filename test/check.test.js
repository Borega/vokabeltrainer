import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almostReason, checkAnswer, variants, withEnding } from '../public/check.js';

const lenient = { caseSensitive: false, accentSensitive: false };
const strict = { caseSensitive: true, accentSensitive: true };

test('exakte Antwort ist richtig', () => {
  assert.equal(checkAnswer('Hund', 'Hund', strict), 'correct');
});

test('Leerzeichen und Satzzeichen am Ende zählen nicht', () => {
  assert.equal(checkAnswer('  the   dog. ', 'the dog', strict), 'correct');
});

test('Alternativen mit ; und |', () => {
  assert.equal(checkAnswer('large', 'big; large', lenient), 'correct');
  assert.equal(checkAnswer('big', 'big | large', lenient), 'correct');
});

test('Teile in Klammern sind optional', () => {
  assert.deepEqual(variants('(to) go').sort(), ['(to) go', 'go', 'to go']);
  assert.equal(checkAnswer('go', '(to) go', lenient), 'correct');
  assert.equal(checkAnswer('to go', '(to) go', lenient), 'correct');
});

test('Mehrere optionale Teile: jede Auswahl zählt', () => {
  for (const input of ['to buy sth.', 'to buy', 'buy sth.', 'buy']) {
    assert.equal(checkAnswer(input, '(to) buy (sth.)', lenient), 'correct', input);
  }
  assert.equal(variants('(to) buy (sth.)')[0], 'to buy sth.', 'die vollständige Form steht vorn (Tipps)');
  assert.equal(checkAnswer('sth.', '(to) buy (sth.)', lenient), 'wrong');
});

test('Wer die Klammern mitschreibt, hat auch recht', () => {
  assert.equal(checkAnswer('go (to school)', 'go (to school)', lenient), 'correct');
  assert.equal(checkAnswer('(to) go', '(to) go', lenient), 'correct');
  assert.equal(checkAnswer('go(to school)', 'go (to school)', lenient), 'correct');
  assert.equal(checkAnswer('go', 'go (to school)', lenient), 'correct');
  assert.equal(checkAnswer('der Hund (m)', 'Hund (m)', lenient), 'wrong');
  assert.equal(almostReason('Hund (m)', 'Hund (m)', lenient), null);
});

test('Rückmeldung aus dem Unterricht: „to fight (irr)“ samt Klammern ist richtig', () => {
  for (const input of ['to fight (irr)', 'to fight irr', 'to fight', 'fight', 'fight (irr)']) {
    assert.equal(checkAnswer(input, 'to fight (irr)', { caseSensitive: false, accentSensitive: true }), 'correct', input);
  }
});

test('Englische Verben gelten auch ohne „to“', () => {
  assert.equal(checkAnswer('go', 'to go', strict), 'correct');
  assert.equal(checkAnswer('to go', 'to go', strict), 'correct');
  assert.equal(checkAnswer('take part in', 'to take part in', strict), 'correct');
  assert.equal(checkAnswer('go', 'to go; to walk', strict), 'correct');
  assert.equal(checkAnswer('walk', 'to go; to walk', strict), 'correct');
  assert.equal(checkAnswer('GO', 'to go', { caseSensitive: false }), 'correct');
  assert.equal(variants('to go')[0], 'to go', 'die Form mit „to“ bleibt die Hauptlösung (Tipps)');
});

test('„to“ vor Artikel oder Possessivpronomen ist eine Richtung, kein Verb', () => {
  assert.equal(checkAnswer('the left', 'to the left', strict), 'wrong');
  assert.equal(checkAnswer('my right', 'to my right', strict), 'wrong');
  assert.equal(checkAnswer('to the left', 'to the left', strict), 'correct');
  assert.equal(checkAnswer('to', 'to', strict), 'correct');
});

test('„to“ vor Pronomen, Zielen und Eigennamen bleibt Pflicht', () => {
  for (const solution of ['to you', 'to school', 'to bed', 'to Berlin', 'to them']) {
    const rest = solution.slice(3);
    assert.equal(checkAnswer(rest, solution, lenient), 'wrong', solution);
    assert.equal(checkAnswer(solution, solution, lenient), 'correct', solution);
  }
  assert.equal(checkAnswer('o', 'to o', strict), 'correct', 'schneidet genau das „to“ ab');
});

test('Klammern in der Eingabe fallen nur weg, wenn die Lösung selbst Klammern hat', () => {
  assert.notEqual(checkAnswer('2 * (3 + 4)', '2 * 3 + 4', lenient), 'correct');
  assert.equal(checkAnswer('2 * 3 + 4', '2 * 3 + 4', lenient), 'correct');
  assert.equal(checkAnswer('(a + b)^2', '(a + b)^2', lenient), 'correct', 'die Lösung genau so, wie sie dasteht');
  assert.equal(checkAnswer('go (to)', 'go', lenient), 'wrong');
});

test('Klammern, die zur Formel gehören, sind nicht optional', () => {
  assert.deepEqual(variants('(a + b)^2'), ['(a + b)^2']);
  assert.equal(checkAnswer('(a + b)^2', '(a + b)^2', lenient), 'correct');
  assert.notEqual(checkAnswer('a + b^2', '(a + b)^2', lenient), 'correct');
  assert.equal(checkAnswer('^2', '(a + b)^2', lenient), 'wrong');
  assert.deepEqual(variants('(x)^2').sort(), ['(x)^2']);
  assert.equal(checkAnswer('x^2', '(x)^2', lenient), 'wrong');
  // Optionale Zusätze daneben bleiben optional
  assert.equal(checkAnswer('(a * b) + c', '(a * b) + c (Summe)', lenient), 'correct');
  assert.equal(checkAnswer('(a * b) + c Summe', '(a * b) + c (Summe)', lenient), 'correct');
  assert.equal(checkAnswer('go', '(to) go', lenient), 'correct');
});

test('Viele optionale Teile: jede Auswahl bis zu acht Klammern', () => {
  const solution = '(a) b (c) d (e) f (g) h (i)';
  assert.equal(checkAnswer('b d f h', solution, lenient), 'correct');
  assert.equal(checkAnswer('a b d f g h', solution, lenient), 'correct', 'gemischte Auswahl bei fünf Klammern');
  assert.equal(checkAnswer('a b c d e f g h i', solution, lenient), 'correct');
});

test('Groß-/Kleinschreibung je nach Einstellung', () => {
  assert.equal(checkAnswer('hund', 'Hund', { caseSensitive: false }), 'correct');
  assert.equal(checkAnswer('hund', 'Hund', { caseSensitive: true }), 'almost');
});

test('Akzente und Umlaute je nach Einstellung', () => {
  assert.equal(checkAnswer('ecole', 'école', lenient), 'correct');
  assert.equal(checkAnswer('strasse', 'Straße', lenient), 'correct');
  assert.equal(checkAnswer('ecole', 'école', strict), 'almost');
  assert.equal(checkAnswer('schon', 'schön', { accentSensitive: true }), 'almost');
});

test('kleiner Tippfehler ist „fast“, großer falsch', () => {
  assert.equal(checkAnswer('elefant', 'elephant', lenient), 'almost');
  assert.equal(checkAnswer('giraffe', 'elephant', lenient), 'wrong');
  assert.equal(checkAnswer('', 'dog', lenient), 'wrong');
});

test('Apostrophe werden vereinheitlicht', () => {
  assert.equal(checkAnswer('don’t', "don't", strict), 'correct');
});

test('Spanisch: ¿ und ¡ zählen nicht', () => {
  assert.equal(checkAnswer('qué tal', '¿Qué tal?'), 'correct');
  assert.equal(checkAnswer('¡hola!', 'hola'), 'correct');
  assert.equal(checkAnswer('hola, qué tal', 'Hola, ¿qué tal?'), 'correct');
});

test('Französisch: Leerzeichen vor Satzzeichen, Auslassungspunkte', () => {
  assert.equal(checkAnswer('comment ça va', 'Comment ça va ?'), 'correct');
  assert.equal(checkAnswer('et alors', 'et alors…'), 'correct');
});

test('Endungen für die weibliche Form', () => {
  assert.deepEqual(variants('bueno/a'), ['bueno/a', 'bueno', 'buena']);
  for (const [input, solution] of [
    ['bueno', 'bueno/a'], ['buena', 'bueno/-a'], ['trabajadora', 'trabajador, -a'], ['alemán', 'alemán/a'],
    ['alemana', 'alemán/a'], ['inglesa', 'inglés, -a'], ['dormilona', 'dormilón/a'], ['japonesa', 'japonés/a'],
    ['heureuse', 'heureux, -euse'], ['active', 'actif, -ive'], ['italienne', 'italien, -ienne'],
    ['francesa', 'francés/-esa'], ['grande', 'grande/e'], ['el chico', 'el chico/a'],
  ]) assert.equal(checkAnswer(input, solution), 'correct', `${input} ↔ ${solution}`);
  assert.equal(withEnding('petit', 'e'), 'petite');
  assert.equal(withEnding('alemán', 'a'), 'alemana', 'Akzent fällt weg, kein „alemána“');
  assert.equal(checkAnswer('alemána', 'alemán/a'), 'almost', 'falsche Form wird nicht mehr akzeptiert');
  assert.equal(checkAnswer('bueni', 'bueno/a'), 'almost');
  assert.deepEqual(variants('Hund/Hündin'), ['Hund/Hündin'], 'ganze Wörter mit Großbuchstaben sind keine Endung');
  assert.deepEqual(variants('rojo; roja'), ['rojo', 'roja'], 'Alternativen wie bisher mit ;');
});

test('Warum „fast“: Akzente, Groß-/Kleinschreibung oder Tippfehler', () => {
  const opts = { accentSensitive: true, caseSensitive: false };
  assert.equal(checkAnswer('manana', 'mañana', opts), 'almost');
  assert.equal(almostReason('manana', 'mañana', opts), 'accents');
  assert.equal(almostReason('ecole', "l'école; école", opts), 'accents');
  assert.equal(almostReason('hund', 'Hund', { caseSensitive: true }), 'case');
  assert.equal(almostReason('mañama', 'mañana', opts), null);
});
