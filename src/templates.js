// Mitgelieferte Grammatik-Vorlagen (vorlagen/grammatik): Beim Start werden sie als freigegebene Listen ohne
// Besitzer:in angelegt und aktuell gehalten. Lehrkräfte finden sie unter „Geteilte Listen“, probieren sie aus und
// legen eine eigene Kopie an, die sie bearbeiten und ihren Gruppen zuweisen. Ohne Besitzer:in kann niemand eine
// Vorlage ändern oder löschen; Schüler:innen sehen sie nicht, weil sie keiner Gruppe zugewiesen ist.
//
// vorlagen.json nennt die Dateien mit Titel, Sprache und Jahrgang; die Dateien haben das Format von
// „Als Textdatei exportieren“ (parseRulesText). Eine geänderte Datei aktualisiert die Vorlage beim nächsten Start –
// Regeln und Aufgaben behalten dabei ihre IDs, wo es geht (wie beim Bearbeiten im Editor).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchItems, parseItem, parseRulesText, splitItems, validateRules } from '../public/grammar.js';
import { writeRules } from './api.js';
import { now, transaction } from './db.js';

export const TEMPLATE_DIR = fileURLToPath(new URL('../vorlagen/grammatik', import.meta.url));

const isGerman = (lang) => /^deutsch/i.test(lang);

// Vorlagen aus dem Verzeichnis lesen und prüfen. Ergebnis: { templates: [{ key, title, lang, grade, rules }], errors }
// oder null, wenn es kein vorlagen.json gibt.
export function loadTemplates(dir = TEMPLATE_DIR) {
  const manifest = join(dir, 'vorlagen.json');
  if (!existsSync(manifest)) return null;
  const templates = [];
  const errors = [];
  for (const entry of JSON.parse(readFileSync(manifest, 'utf8'))) {
    const fail = (error) => errors.push({ key: entry.file, error });
    if (!entry.file || !entry.title || !entry.lang || !Number.isInteger(entry.grade)) {
      fail('Eintrag braucht file, title, lang und grade.');
      continue;
    }
    let text;
    try {
      text = readFileSync(join(dir, entry.file), 'utf8');
    } catch {
      fail('Datei nicht gefunden.');
      continue;
    }
    const parsed = parseRulesText(text);
    if (parsed.errors.length) {
      fail(`Zeile ${parsed.errors[0].line}: ${parsed.errors[0].error}`);
      continue;
    }
    const rules = parsed.rules.map((r) => ({
      title: r.title,
      summary: r.summary,
      explanation: r.explanation,
      discover: r.discover ? 1 : 0,
      // gespeichert wird die bereinigte Fassung, wie beim Speichern im Editor
      items: splitItems(r.tasks).items.map((it) => ({ source: parseItem(it.source).source ?? it.source })),
    }));
    const problem = validateRules(rules);
    if (problem) {
      fail(problem);
      continue;
    }
    templates.push({ key: entry.file, title: entry.title, lang: entry.lang, grade: entry.grade, rules });
  }
  return { templates, errors };
}

function storedRules(db, listId) {
  const rules = db.prepare('SELECT id, title, summary, explanation, discover FROM rules WHERE list_id = ? ORDER BY pos, id').all(listId);
  const items = db.prepare('SELECT id, source FROM items WHERE rule_id = ? ORDER BY pos, id');
  return rules.map((r) => ({ ...r, items: items.all(r.id).map((it) => ({ ...it })) }));
}

// Inhalt ohne IDs – zum Erkennen, ob sich eine Vorlage geändert hat
const signature = (t, rules) => JSON.stringify([t.title, t.lang, t.grade,
  rules.map((r) => [r.title, r.summary, r.explanation, r.discover, r.items.map((it) => it.source)])]);

// IDs der gespeicherten Fassung übernehmen: Regeln nach Titel, sonst nach Position; Aufgaben wie im Editor
function withIds(old, rules) {
  const free = new Set(old.map((_, i) => i));
  const pick = (pos, title) => {
    const byTitle = [...free].find((i) => old[i].title === title);
    const i = byTitle ?? (free.has(pos) ? pos : undefined);
    if (i === undefined) return null;
    free.delete(i);
    return old[i];
  };
  return rules.map((rule, pos) => {
    const match = pick(pos, rule.title);
    if (!match) return rule;
    const ids = matchItems(match.items, rule.items.map((it) => it.source));
    return { ...rule, id: match.id, items: rule.items.map((it, i) => ({ ...it, id: ids[i] ?? undefined })) };
  });
}

// Vorlagen in der Datenbank auf den Stand der Dateien bringen. enabled = false entfernt sie.
// Ergebnis: { added, updated, removed, errors } oder null, wenn es keine Vorlagen gibt (dann bleibt alles, wie es ist).
export function syncTemplates(db, { dir = TEMPLATE_DIR, enabled = true } = {}) {
  const loaded = enabled ? loadTemplates(dir) : { templates: [], errors: [] };
  if (!loaded) return null;
  const result = { added: 0, updated: 0, removed: 0, errors: loaded.errors };
  const existing = new Map(db.prepare('SELECT * FROM lists WHERE template IS NOT NULL').all().map((r) => [r.template, r]));
  // Eine fehlerhafte Datei lässt die bisherige Fassung stehen
  for (const { key } of loaded.errors) existing.delete(key);
  transaction(db, () => {
    for (const t of loaded.templates) {
      const row = existing.get(t.key);
      existing.delete(t.key);
      const caseSensitive = isGerman(t.lang) ? 1 : 0;
      const ts = now();
      if (!row) {
        const { id } = db.prepare(
          `INSERT INTO lists (owner_id, kind, title, lang_a, lang_b, learn_side, mode, case_sensitive, accent_sensitive,
             grade, shared, template, created_at, updated_at)
           VALUES (NULL, 'grammar', ?, ?, '', 'a', 'auto', ?, 1, ?, 1, ?, ?, ?) RETURNING id`,
        ).get(t.title, t.lang, caseSensitive, t.grade, t.key, ts, ts);
        writeRules(db, id, t.rules);
        result.added++;
        continue;
      }
      const old = storedRules(db, row.id);
      if (row.shared && signature({ title: row.title, lang: row.lang_a, grade: row.grade }, old) === signature(t, t.rules)) continue;
      db.prepare('UPDATE lists SET title = ?, lang_a = ?, grade = ?, case_sensitive = ?, shared = 1, updated_at = ? WHERE id = ?')
        .run(t.title, t.lang, t.grade, caseSensitive, ts, row.id);
      writeRules(db, row.id, withIds(old, t.rules));
      result.updated++;
    }
    // Nicht mehr mitgelieferte Vorlagen entfernen; eigene Kopien der Lehrkräfte bleiben unberührt
    for (const row of existing.values()) {
      db.prepare('DELETE FROM lists WHERE id = ?').run(row.id);
      result.removed++;
    }
  });
  return result;
}
