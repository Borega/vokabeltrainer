// CSV-Import/-Export für Wortlisten. Spalten: Wort A, Wort B, (optional) Notiz, (optional) Beispielsatz.
// Trennzeichen (Semikolon, Komma, Tab) wird automatisch erkannt – Excel speichert
// in Deutschland meist mit Semikolon.

const HEADER_WORDS = /^(deutsch|englisch|französisch|franzoesisch|latein|spanisch|italienisch|russisch|german|english|french|spanish|latin|wort|begriff|vokabel|übersetzung|uebersetzung|bedeutung|a|b|word|term|translation|definition|notiz|note|hinweis)$/i;

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
