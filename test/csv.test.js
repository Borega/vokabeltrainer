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
  assert.deepEqual(textToWords('Hier:\ndog – Hund').words.map((w) => w.a), ['dog']);
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
  const daz = aiPrompt({ langA: 'Deutsch', langB: 'Türkisch', learn: 'a' });
  assert.match(daz, /Vokabelliste für den Deutsch-Unterricht/);
  assert.match(daz, /Spalte 1: das Wort auf Deutsch/);
  assert.match(daz, /Spalte 2: die Bedeutung auf Türkisch/);
  const mono = aiPrompt({ langA: 'Deutsch', langB: 'Deutsch', topic: 'Fremdwörter' });
  assert.match(mono, /Wortschatzliste \(Begriffe mit Bedeutung\) für den Deutsch-Unterricht zum Thema „Fremdwörter“/);
  assert.match(mono, /Spalte 1: der Begriff auf Deutsch/);
  assert.match(mono, /Spalte 2: eine kurze, einfache Erklärung oder ein Synonym auf Deutsch/);
});

test('KI-Antwort ohne Codeblock: Einleitung und Schluss fallen weg', () => {
  const dash = textToWords('Hier ist deine Liste:\ndog – Hund\ncat – Katze\nViel Erfolg beim Lernen!');
  assert.deepEqual(dash.words.map((w) => [w.a, w.b]), [['dog', 'Hund'], ['cat', 'Katze']]);
  const comma = textToWords('Klar, hier ist eine kurze Liste.\n\ndog,Hund\ncat,Katze\n\nViel Spaß, und frag gern nach!');
  assert.deepEqual(comma.words.map((w) => [w.a, w.b]), [['dog', 'Hund'], ['cat', 'Katze']]);
});

test('Datei-Import verändert keine Daten: Anführungszeichen, Zeilenumbrüche, Trennzeichen im Feld', () => {
  const words = [
    { a: 'dog', b: 'Hund', note: 'a;b', example: 'First line.\n\nSecond line.' },
    { a: 'say "hi"', b: 'hallo sagen', note: '', example: '' },
  ];
  assert.deepEqual(textToWords(wordsToCsv(words, ['Englisch', 'Deutsch', 'Notiz', 'Beispielsatz'])).words, words);
  const comma = textToWords('dog,Hund,"a;b"\ncat,Katze,x');
  assert.equal(comma.format, 'CSV');
  assert.deepEqual(comma.words.map((w) => [w.a, w.b, w.note]), [['dog', 'Hund', 'a;b'], ['cat', 'Katze', 'x']]);
  assert.deepEqual(textToWords('12" – 30 cm\ncat – Katze\ndog – Hund').words.length, 3, 'einzelnes Zollzeichen');
});

test('Kopfzeile mit allen Sprachen aus dem Editor', () => {
  for (const lang of ['Niederländisch', 'Polnisch', 'Türkisch', 'Altgriechisch', 'Chinesisch']) {
    const { words, header } = textToWords(`${lang};Deutsch\nx;y\nz;w`);
    assert.deepEqual(header, [lang, 'Deutsch']);
    assert.equal(words.length, 2);
  }
});

test('Listen aus Sätzen bleiben vollständig', () => {
  const text = 'How are you today.,Wie geht es dir heute.\nI like it a lot.,Es gefällt mir sehr.\nSee you soon then.,Bis bald dann.';
  assert.equal(textToWords(text).words.length, 3);
});
