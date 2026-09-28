import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAnswer, variants } from '../public/check.js';

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
