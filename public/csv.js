// CSV-Import/-Export für Wortlisten. Spalten: Wort A, Wort B, (optional) Notiz, (optional) Beispielsatz.
// Trennzeichen (Semikolon, Komma, Tab) wird automatisch erkannt – Excel speichert
// in Deutschland meist mit Semikolon.

import { learnSide, sameLanguage } from './exercises.js';

const HEADER_WORDS = /^(deutsch|englisch|französisch|franzoesisch|latein|spanisch|italienisch|russisch|niederländisch|niederlaendisch|polnisch|türkisch|tuerkisch|altgriechisch|griechisch|chinesisch|arabisch|ukrainisch|persisch|farsi|kurdisch|rumänisch|bulgarisch|albanisch|kroatisch|serbisch|portugiesisch|japanisch|schwedisch|dänisch|norwegisch|german|english|french|spanish|latin|italian|russian|dutch|polish|turkish|greek|chinese|arabic|ukrainian|persian|portuguese|français|francais|español|espanol|wort|begriff|vokabel|übersetzung|uebersetzung|bedeutung|a|b|word|term|translation|definition|notiz|note|hinweis)$/i;

export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let best = ';';
  let bestScore = -1;
  for (const d of ['\t', ';', ',']) {
    // Zeilen, in denen das Zeichen vorkommt (außerhalb von Anführungszeichen grob geschätzt)
    const score = lines.filter((l) => l.replace(/"[^"]*"/g, '').includes(d)).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some(Boolean));
}

// Wandelt CSV-Text in Wörter um. Erkennt eine Kopfzeile wie „Englisch;Deutsch“.
export function csvToWords(text) {
  const rows = parseCsv(text);
  let header = null;
  if (rows.length && rows[0].slice(0, 2).every((f) => HEADER_WORDS.test(f))) header = rows.shift();
  const words = rows
    .filter((r) => r[0] || r[1])
    .map((r) => ({ a: r[0] ?? '', b: r[1] ?? '', note: r[2] ?? '', example: r.slice(3).filter(Boolean).join(' ') }));
  return { words, header };
}

function quote(field) {
  return /[";\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

// Beliebige Tabelle als CSV (Semikolon, mit BOM für Excel)
export function rowsToCsv(rows) {
  return '\uFEFF' + rows.map((r) => r.map((f) => quote(String(f ?? ''))).join(';')).join('\r\n') + '\r\n';
}

export function wordsToCsv(words, header) {
  const lines = [];
  if (header) lines.push(header.map(quote).join(';'));
  for (const w of words) lines.push([w.a, w.b, w.note ?? '', w.example ?? ''].map(quote).join(';'));
  // BOM, damit Excel Umlaute richtig anzeigt
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---------- Text aus KI, Excel oder Dokumenten ----------

// Trennzeichen zwischen Wort und Übersetzung, in dieser Reihenfolge bevorzugt
const SEPARATORS = ['\t', ';', ' – ', ' — ', ' = ', ' - ', ': ', ','];
const CSV_SEPARATORS = ['\t', ';', ','];
const unquoted = (line) => line.replace(/"(?:[^"]|"")*"/g, '');
const count = (line, sep) => (CSV_SEPARATORS.includes(sep) ? unquoted(line) : line).split(sep).length - 1;

// Text in Datensätze teilen – Zeilenumbrüche in Anführungszeichen (CSV) gehören zum Feld.
// Leere Zeilen fallen weg, Aufzählungszeichen („1.“, „-“) auch.
function splitRecords(text) {
  const records = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // Anführungszeichen öffnen nur am Anfang eines Felds (wie parseCsv), "" im Feld ist ein Zeichen
    if (c === '"' && quoted && text[i + 1] === '"') {
      current += '""';
      i++;
      continue;
    }
    if (c === '"') quoted = quoted ? false : /(^|[\t;,])\s*$/.test(current);
    if (c === '\n' && !quoted) {
      records.push(current);
      current = '';
    } else current += c;
  }
  records.push(current);
  return records.map((r) => r.trim().replace(/^(\d{1,3}[.)]|[-*•])\s+(?=\S)/, '')).filter(Boolean);
}

// Zeilen, die zu einem Trennzeichen passen: gleich viele Trennzeichen wie die meisten Zeilen
// (CSV mit vier Spalten: drei Semikolons pro Zeile), keine Einleitung wie „Hier ist die Liste:“.
function dataLines(lines, sep) {
  const counts = lines.map((l) => count(l, sep));
  const freq = new Map();
  for (const n of counts) if (n > 0) freq.set(n, (freq.get(n) ?? 0) + 1);
  if (!freq.size) return [];
  const modal = [...freq].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  return lines.filter((l, i) => counts[i] === modal && !/:$/.test(l));
}

// Einleitungs- oder Schlusssätze am Rand der Liste („Klar, hier ist deine Liste.“ wird bei Komma als
// zwei Spalten gelesen) weglassen – außer die Liste besteht selbst aus Sätzen.
function trimProse(rows) {
  const prose = (r) => r.length === 2 && /[.!:]$/.test(r[1]) && r.join(' ').split(/\s+/).length >= 4;
  let from = 0;
  let to = rows.length;
  while (from < to && prose(rows[from])) from++;
  while (to > from && prose(rows[to - 1])) to--;
  const inner = rows.slice(from, to);
  return inner.length && !inner.some(prose) ? inner : rows;
}

function rowsToWords(rows) {
  const clean = rows
    .map((r) => r.map((f) => f.replace(/\*\*(.+?)\*\*/g, '$1').trim()))
    .filter((r) => r.filter(Boolean).length >= 2);
  let header = null;
  if (clean.length && clean[0].slice(0, 2).every((f) => HEADER_WORDS.test(f))) header = clean.shift();
  // Mit Kopfzeile Spalten 3+ nach Namen zuordnen („Beispielsatz“ kann auch an dritter Stelle stehen)
  const find = (re) => (header ? header.findIndex((h, i) => i >= 2 && re.test(h)) : -1);
  let noteCol = find(/notiz|note|hinweis|anmerkung|bemerkung/i);
  let exampleCol = find(/beispiel|example|satz|sentence|kontext/i);
  if (noteCol < 0 && exampleCol < 0) [noteCol, exampleCol] = [2, 3];
  const words = clean.map((r) => ({
    a: r[0] ?? '',
    b: r[1] ?? '',
    note: noteCol >= 0 ? r[noteCol] ?? '' : '',
    example: exampleCol >= 0 ? (exampleCol === 3 && noteCol === 2 ? r.slice(3).filter(Boolean).join(' ') : r[exampleCol] ?? '') : '',
  }));
  return { words, header };
}

// Wörter aus beliebigem Text: CSV-Datei, aus Excel kopierte Tabelle oder die Antwort einer KI –
// Markdown-Tabelle, CSV im Codeblock, Zeilen wie „dog – Hund“ oder „1. to go = gehen“.
// Zeilen ohne das Trennzeichen der Liste (Einleitungs- und Schlusssätze der KI) fallen weg.
export function textToWords(text) {
  let t = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fence = t.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fence) t = fence[1];
  const lines = splitRecords(t);
  if (!lines.length) return { words: [], header: null, format: null };

  // Markdown-Tabelle: | dog | Hund |
  const tableLines = lines.filter((l) => l.startsWith('|'));
  if (tableLines.length >= 2 && tableLines.length >= lines.length * 0.5) {
    const rows = tableLines
      .filter((l) => !/^\|[\s:|-]+\|?$/.test(l))
      .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|'));
    return { ...rowsToWords(rows), format: 'Tabelle' };
  }

  // Das Trennzeichen, zu dem die meisten Zeilen passen; bei Gleichstand das weiter vorn in SEPARATORS
  let best = null;
  for (const sep of SEPARATORS) {
    const data = dataLines(lines, sep);
    if ((data.length >= 2 || data.length * 2 >= lines.length) && data.length > (best?.data.length ?? 0)) best = { sep, data };
  }
  if (!best) return { words: [], header: null, format: null };
  const { sep, data } = best;
  const rows = CSV_SEPARATORS.includes(sep) ? data.map((l) => parseCsv(l, sep)[0] ?? []) : data.map((l) => l.split(sep));
  const format = sep === '\t' ? 'Tabelle' : CSV_SEPARATORS.includes(sep) ? 'CSV' : 'Liste';
  return { ...rowsToWords(trimProse(rows)), format };
}

// Prompt für eine KI, die eine Liste genau in dem Format liefert, das textToWords versteht.
// Beispielsätze in der Fremdsprache mit markierter Lücke, damit Lückentexte entstehen.
// learn: gelernte Seite ('a' | 'b'), sonst wie learnSide geschätzt. Gleiche Sprache auf beiden Seiten
// (Deutschunterricht): Begriff ↔ kurze Erklärung.
export function aiPrompt({ langA = 'Englisch', langB = 'Deutsch', learn = '', grade = null, topic = '', count = 20 } = {}) {
  const mono = sameLanguage({ lang_a: langA, lang_b: langB });
  const side = learnSide({ lang_a: langA, lang_b: langB, learn_side: learn });
  const foreign = side === 'b' ? langB : langA;
  const describe = (s, lang) => (mono
    ? (s === 'a'
      ? `der Begriff auf ${lang} (Nomen mit bestimmtem Artikel, Verben im Infinitiv)`
      : `eine kurze, einfache Erklärung oder ein Synonym auf ${lang}; mehrere richtige Antworten mit | trennen`)
    : s === side
      ? `das Wort auf ${lang} (Nomen mit bestimmtem Artikel, Verben im Infinitiv)`
      : `die Bedeutung auf ${lang}; mehrere richtige Bedeutungen mit | trennen, z. B. „groß | hoch“`);
  const kind = mono ? 'Wortschatzliste (Begriffe mit Bedeutung)' : 'Vokabelliste';
  return [
    `Erstelle eine ${kind} für den ${foreign}-Unterricht${grade ? ` in Jahrgang ${grade}` : ''}${topic.trim() ? ` zum Thema „${topic.trim()}“` : ''} mit ${count} Einträgen.`,
    'Antworte nur mit einem Codeblock im CSV-Format mit Semikolon als Trennzeichen, ohne weitere Erklärungen.',
    `Erste Zeile: ${langA};${langB};Notiz;Beispielsatz`,
    'Regeln:',
    `- Spalte 1: ${describe('a', langA)}.`,
    `- Spalte 2: ${describe('b', langB)}.`,
    '- Teile, die man weglassen darf, in Klammern, z. B. „(to) go“. Männliche und weibliche Form zusammen als „bueno/a“ oder „heureux, -euse“.',
    '- Spalte 3 (Notiz): nur wenn nötig und sehr kurz (z. B. Genus, unregelmäßig), sonst leer lassen.',
    `- Spalte 4 (Beispielsatz): ein kurzer, einfacher Satz auf ${foreign}${grade ? ` für Jahrgang ${grade}` : ''}. Das gesuchte Wort im Satz mit *Sternchen* markieren, auch in gebeugter Form, z. B. „Yesterday I *went* home.“`,
    '- Keine Semikolons innerhalb der Felder.',
  ].join('\n');
}
