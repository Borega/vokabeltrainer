import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiPrompt, csvToWords, detectDelimiter, parseCsv, textToWords, wordsToCsv } from '../public/csv.js';

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

test('KI-Antwort: CSV im Codeblock mit Einleitungssatz, Kopfzeile, Lücke im Beispielsatz', () => {
  const reply = 'Gern! Hier ist deine Liste:\n\n```csv\nFranzösisch;Deutsch;Notiz;Beispielsatz\nle fromage;der Käse;m.;*Le fromage* est bon.\nboire;trinken;unregelmäßig;Nous *buvons* de l\'eau.\n```\n\nViel Erfolg!';
  const { words, header, format } = textToWords(reply);
  assert.equal(format, 'CSV');
  assert.deepEqual(header, ['Französisch', 'Deutsch', 'Notiz', 'Beispielsatz']);
  assert.deepEqual(words, [
    { a: 'le fromage', b: 'der Käse', note: 'm.', example: '*Le fromage* est bon.' },
    { a: 'boire', b: 'trinken', note: 'unregelmäßig', example: "Nous *buvons* de l'eau." },
  ]);
});

test('Markdown-Tabelle: Spalten nach Namen, Fettdruck weg', () => {
  const md = '| Englisch | Deutsch | Beispielsatz |\n|---|:---:|---|\n| **dog** | Hund | The *dog* barks. |\n| cat | Katze | |';
  const { words, format } = textToWords(md);
  assert.equal(format, 'Tabelle');
  assert.deepEqual(words, [
    { a: 'dog', b: 'Hund', note: '', example: 'The *dog* barks.' },
    { a: 'cat', b: 'Katze', note: '', example: '' },
  ]);
});

test('Listen mit Aufzählungszeichen und Gedankenstrich oder Gleichheitszeichen', () => {
  const dash = textToWords('1. dog – Hund; Tier\n2. cat – Katze\n3. (to) go – gehen');
  assert.equal(dash.format, 'Liste');
  assert.deepEqual(dash.words.map((w) => [w.a, w.b]), [['dog', 'Hund; Tier'], ['cat', 'Katze'], ['(to) go', 'gehen']]);
  const eq = textToWords('- el perro = der Hund\n- el gato = die Katze');
  assert.deepEqual(eq.words.map((w) => [w.a, w.b]), [['el perro', 'der Hund'], ['el gato', 'die Katze']]);
});

test('aus Excel kopiert (Tab) und reiner Fließtext', () => {
  const tab = textToWords('dog\tHund\ncat\tKatze\n');
  assert.equal(tab.format, 'Tabelle');
  assert.equal(tab.words.length, 2);
  assert.deepEqual(textToWords('Das ist nur ein Satz ohne Vokabeln').words, []);
  assert.deepEqual(textToWords('').words, []);
});

test('KI-Prompt: Fremdsprache, Jahrgang, Thema, Format', () => {
  const p = aiPrompt({ langA: 'Deutsch', langB: 'Spanisch', grade: 7, topic: ' Familie ', count: 15 });
  assert.match(p, /Spanisch-Unterricht in Jahrgang 7 zum Thema „Familie“ mit 15 Einträgen/);
  assert.match(p, /Erste Zeile: Deutsch;Spanisch;Notiz;Beispielsatz/);
  assert.match(p, /Spalte 2: das Wort auf Spanisch/);
  assert.match(p, /Satz auf Spanisch für Jahrgang 7/);
  const plain = aiPrompt({ langA: 'Französisch', langB: 'Deutsch' });
  assert.match(plain, /Französisch-Unterricht mit 20 Einträgen\./);
});
