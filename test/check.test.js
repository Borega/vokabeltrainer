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
  assert.deepEqual(variants('(to) go').sort(), ['go', 'to go']);
  assert.equal(checkAnswer('go', '(to) go', lenient), 'correct');
  assert.equal(checkAnswer('to go', '(to) go', lenient), 'correct');
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
