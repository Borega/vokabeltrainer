// CSV-Import/-Export für Wortlisten. Spalten: Wort A, Wort B, (optional) Notiz, (optional) Beispielsatz.
// Trennzeichen (Semikolon, Komma, Tab) wird automatisch erkannt – Excel speichert
// in Deutschland meist mit Semikolon.

const HEADER_WORDS = /^(deutsch|englisch|französisch|franzoesisch|latein|spanisch|italienisch|russisch|german|english|french|spanish|latin|français|francais|español|espanol|wort|begriff|vokabel|übersetzung|uebersetzung|bedeutung|a|b|word|term|translation|definition|notiz|note|hinweis)$/i;

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
const count = (line, sep) => line.split(sep).length - 1;

// Welches Trennzeichen passt? Es muss in den meisten Zeilen vorkommen; am besten jedes Mal gleich oft
// (CSV mit vier Spalten: drei Semikolons pro Zeile). So gewinnt bei „dog – Hund; Tier“ der Gedankenstrich.
function pickSeparator(lines) {
  let best = null;
  for (const sep of SEPARATORS) {
    const counts = lines.map((l) => count(l, sep));
    const withSep = counts.filter((n) => n > 0);
    if (withSep.length < lines.length * 0.6) continue;
    const modal = withSep.sort((x, y) => withSep.filter((n) => n === y).length - withSep.filter((n) => n === x).length)[0];
    const steady = counts.filter((n) => n === modal).length / lines.length;
    if (!best || steady > best.steady) best = { sep, steady };
  }
  return best?.sep ?? null;
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
// Zeilen ohne erkennbare zwei Spalten (Einleitungssätze der KI) fallen weg.
export function textToWords(text) {
  let t = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const fence = t.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fence) t = fence[1];
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { words: [], header: null, format: null };

  // Markdown-Tabelle: | dog | Hund |
  const tableLines = lines.filter((l) => l.startsWith('|'));
  if (tableLines.length >= 2 && tableLines.length >= lines.length * 0.5) {
    const rows = tableLines
      .filter((l) => !/^\|[\s:|-]+\|?$/.test(l))
      .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|'));
    return { ...rowsToWords(rows), format: 'Tabelle' };
  }

  // Zeilen, ggf. mit Aufzählungszeichen: „1. dog – Hund“, „- dog – Hund“
  const unlisted = lines.map((l) => l.replace(/^(\d{1,3}[.)]|[-*•])\s+/, ''));
  const sep = pickSeparator(unlisted);
  if (!sep) return { words: [], header: null, format: null };
  if (['\t', ';', ','].includes(sep)) {
    return { ...rowsToWords(parseCsv(unlisted.join('\n'), sep)), format: sep === '\t' ? 'Tabelle' : 'CSV' };
  }
  return { ...rowsToWords(unlisted.map((l) => l.split(sep))), format: 'Liste' };
}

// Prompt für eine KI, die eine Liste genau in dem Format liefert, das textToWords versteht.
// Beispielsätze in der Fremdsprache mit markierter Lücke, damit Lückentexte entstehen.
export function aiPrompt({ langA = 'Englisch', langB = 'Deutsch', grade = null, topic = '', count = 20 } = {}) {
  const german = (l) => /^(deutsch|german)/i.test(l.trim());
  const foreign = german(langA) && !german(langB) ? langB : langA;
  const describe = (lang) => (lang === foreign
    ? `das Wort auf ${lang} (Nomen mit bestimmtem Artikel, Verben im Infinitiv)`
    : `die Bedeutung auf ${lang}; mehrere richtige Bedeutungen mit | trennen, z. B. „groß | hoch“`);
  return [
    `Erstelle eine Vokabelliste für den ${foreign}-Unterricht${grade ? ` in Jahrgang ${grade}` : ''}${topic.trim() ? ` zum Thema „${topic.trim()}“` : ''} mit ${count} Einträgen.`,
    'Antworte nur mit einem Codeblock im CSV-Format mit Semikolon als Trennzeichen, ohne weitere Erklärungen.',
    `Erste Zeile: ${langA};${langB};Notiz;Beispielsatz`,
    'Regeln:',
    `- Spalte 1: ${describe(langA)}.`,
    `- Spalte 2: ${describe(langB)}.`,
    '- Teile, die man weglassen darf, in Klammern, z. B. „(to) go“. Männliche und weibliche Form zusammen als „bueno/a“ oder „heureux, -euse“.',
    '- Spalte 3 (Notiz): nur wenn nötig und sehr kurz (z. B. Genus, unregelmäßig), sonst leer lassen.',
    `- Spalte 4 (Beispielsatz): ein kurzer, einfacher Satz auf ${foreign}${grade ? ` für Jahrgang ${grade}` : ''}. Das gesuchte Wort im Satz mit *Sternchen* markieren, auch in gebeugter Form, z. B. „Yesterday I *went* home.“`,
    '- Keine Semikolons innerhalb der Felder.',
  ].join('\n');
}
