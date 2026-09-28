import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvToWords, detectDelimiter, parseCsv, wordsToCsv } from '../public/csv.js';

test('erkennt Semikolon (Excel, deutsch)', () => {
  assert.equal(detectDelimiter('dog;Hund\ncat;Katze'), ';');
});

test('erkennt Tab und Komma', () => {
  assert.equal(detectDelimiter('dog\tHund\ncat\tKatze'), '\t');
  assert.equal(detectDelimiter('dog,Hund\ncat,Katze'), ',');
});

test('Anführungszeichen, Trennzeichen im Feld, Zeilenumbrüche', () => {
  const comma = parseCsv('"yes, please","ja, bitte"\r\n"line\nbreak",Zeile\n', ',');
  assert.deepEqual(comma, [['yes, please', 'ja, bitte'], ['line\nbreak', 'Zeile']]);
  const semi = parseCsv('"yes, please";"ja, bitte"\r\n"say ""hi""";sag hallo\n', ';');
  assert.deepEqual(semi, [['yes, please', 'ja, bitte'], ['say "hi"', 'sag hallo']]);
});

test('Kopfzeile wird erkannt, Notizspalte übernommen, BOM entfernt', () => {
  const { words, header } = csvToWords('﻿Englisch;Deutsch;Notiz\ndog;Hund;animal\ncat;Katze\n\n');
  assert.deepEqual(header, ['Englisch', 'Deutsch', 'Notiz']);
  assert.deepEqual(words, [
    { a: 'dog', b: 'Hund', note: 'animal', example: '' },
    { a: 'cat', b: 'Katze', note: '', example: '' },
  ]);
});

test('vierte Spalte ist der Beispielsatz', () => {
  const { words } = csvToWords('dog;Hund;;The *dog* barks.\ncat;Katze;animal');
  assert.deepEqual(words, [
    { a: 'dog', b: 'Hund', note: '', example: 'The *dog* barks.' },
    { a: 'cat', b: 'Katze', note: 'animal', example: '' },
  ]);
});

test('ohne Kopfzeile bleibt die erste Zeile ein Wort', () => {
  const { words, header } = csvToWords('dog;Hund\ncat;Katze');
  assert.equal(header, null);
  assert.equal(words.length, 2);
});

test('Export und Re-Import ergeben dieselben Wörter', () => {
  const words = [
    { a: 'yes; please', b: 'ja "bitte"', note: '', example: '' },
    { a: 'dog', b: 'Hund', note: 'animal', example: 'The dog barks; loudly.' },
  ];
  const csv = wordsToCsv(words, ['Englisch', 'Deutsch', 'Notiz', 'Beispielsatz']);
  assert.deepEqual(csvToWords(csv).words, words);
});
