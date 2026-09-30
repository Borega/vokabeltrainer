import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY,
  sub         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_teacher  INTEGER NOT NULL DEFAULT 0,
  last_login  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_groups (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  group_name  TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX IF NOT EXISTS user_groups_group ON user_groups(group_id);

-- Ursprüngliches Schema (Version 0); spätere Änderungen stehen in MIGRATIONS.
-- Die erlaubten Werte für mode erweitert Migration 4.
CREATE TABLE IF NOT EXISTS lists (
  id                INTEGER PRIMARY KEY,
  owner_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  lang_a            TEXT NOT NULL DEFAULT '',
  lang_b            TEXT NOT NULL DEFAULT '',
  mode              TEXT NOT NULL DEFAULT 'flip' CHECK (mode IN ('flip', 'type')),
  case_sensitive    INTEGER NOT NULL DEFAULT 0,
  accent_sensitive  INTEGER NOT NULL DEFAULT 1,
  direction         TEXT NOT NULL DEFAULT 'ab' CHECK (direction IN ('ab', 'ba', 'mixed')),
  allow_switch      INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id       INTEGER PRIMARY KEY,
  list_id  INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  pos      INTEGER NOT NULL,
  a        TEXT NOT NULL,
  b        TEXT NOT NULL,
  note     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS words_list ON words(list_id, pos);

CREATE TABLE IF NOT EXISTS list_groups (
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  group_name  TEXT NOT NULL,
  PRIMARY KEY (list_id, group_id)
);
CREATE INDEX IF NOT EXISTS list_groups_group ON list_groups(group_id);

-- Leitner-Kästchen pro Schüler:in, Wort und Abfragerichtung.
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id    INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('ab', 'ba')),
  box        INTEGER NOT NULL DEFAULT 0,
  right      INTEGER NOT NULL DEFAULT 0,
  wrong      INTEGER NOT NULL DEFAULT 0,
  last_seen  TEXT NOT NULL,
  PRIMARY KEY (user_id, word_id, direction)
);
CREATE INDEX IF NOT EXISTS progress_word ON progress(word_id);

CREATE TABLE IF NOT EXISTS sessions (
  id       TEXT PRIMARY KEY,
  data     TEXT NOT NULL,
  expires  INTEGER NOT NULL
);
`;

export function openDb(dataDir) {
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    mkdirSync(dataDir, { recursive: true });
    file = join(dataDir, 'vokabeltrainer.sqlite');
  }
  const db = new DatabaseSync(file);
  // Fremdschlüssel erst nach den Migrationen einschalten (node:sqlite schaltet sie standardmäßig ein):
  // Beim Neuaufbau einer Tabelle würde DROP TABLE sonst abhängige Zeilen (z. B. alle Wörter einer Liste) mitlöschen.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000;');
  // SQLites LOWER() kennt nur ASCII („Étais“ ≠ „étais“); die Auswertung fasst Antworten Unicode-fest zusammen
  db.function('unicode_lower', { deterministic: true }, (value) => (value == null ? null : String(value).normalize('NFC').toLocaleLowerCase('de').replace(/\s+/g, ' ').trim()));
  db.exec(SCHEMA);
  migrate(db);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

// Änderungen am Schema für bestehende Datenbanken. Nur anhängen, nie umsortieren.
export const MIGRATIONS = [
  // 1: Listen für Kolleg:innen freigeben und kopieren
  `ALTER TABLE lists ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE lists ADD COLUMN copied_from TEXT NOT NULL DEFAULT '';
   CREATE INDEX IF NOT EXISTS lists_shared ON lists(shared);`,
  // 2: Wiederholungsplanung (FSRS). Bisherige Kästchen werden in passende Startwerte umgerechnet,
  //    sodass die Stufe (box) gleich bleibt: 1→0,5 Tage, 2→3, 3→14, 4→45, 5→120 Tage Stabilität.
  `ALTER TABLE progress ADD COLUMN stability REAL;
   ALTER TABLE progress ADD COLUMN difficulty REAL;
   ALTER TABLE progress ADD COLUMN due TEXT;
   ALTER TABLE progress ADD COLUMN state INTEGER;
   ALTER TABLE progress ADD COLUMN reps INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE progress ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE progress ADD COLUMN scheduled_days INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE progress ADD COLUMN last_review TEXT;
   UPDATE progress SET
     stability = CASE box WHEN 1 THEN 0.5 WHEN 2 THEN 3 WHEN 3 THEN 14 WHEN 4 THEN 45 ELSE 120 END,
     scheduled_days = CASE box WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 14 WHEN 4 THEN 45 ELSE 120 END,
     difficulty = 5, state = 2, reps = right + wrong, lapses = wrong, last_review = last_seen
   WHERE box > 0;
   UPDATE progress SET due = strftime('%Y-%m-%dT%H:%M:%fZ', last_seen, '+' || scheduled_days || ' days')
   WHERE box > 0;
   CREATE INDEX IF NOT EXISTS progress_due ON progress(user_id, due);`,
  // 3: Verlauf für die Auswertung. Jede Antwort wird mit der danach geschätzten Stabilität protokolliert.
  //    Der bisherige Stand dient als erster Eintrag.
  `CREATE TABLE review_log (
     id         INTEGER PRIMARY KEY,
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     word_id    INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
     direction  TEXT NOT NULL,
     grade      TEXT NOT NULL,
     stability  REAL NOT NULL,
     at         TEXT NOT NULL
   );
   CREATE INDEX review_log_word ON review_log(word_id, at);
   CREATE INDEX review_log_user ON review_log(user_id, at);
   INSERT INTO review_log (user_id, word_id, direction, grade, stability, at)
     SELECT user_id, word_id, direction, 'import', stability, COALESCE(last_review, last_seen)
     FROM progress WHERE stability IS NOT NULL;`,
  // 4: Neue Abfragearten „auto“ (Lernleiter) und „choice“ (Auswählen). Die CHECK-Bedingung für mode
  //    lässt sich in SQLite nur durch Neuaufbau der Tabelle ändern. Dazu Beispielsätze für Lückentexte
  //    und die Übungsart im Verlauf.
  `CREATE TABLE lists_new (
     id                INTEGER PRIMARY KEY,
     owner_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
     title             TEXT NOT NULL,
     lang_a            TEXT NOT NULL DEFAULT '',
     lang_b            TEXT NOT NULL DEFAULT '',
     mode              TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'flip', 'type', 'choice')),
     case_sensitive    INTEGER NOT NULL DEFAULT 0,
     accent_sensitive  INTEGER NOT NULL DEFAULT 1,
     direction         TEXT NOT NULL DEFAULT 'ab' CHECK (direction IN ('ab', 'ba', 'mixed')),
     allow_switch      INTEGER NOT NULL DEFAULT 1,
     created_at        TEXT NOT NULL,
     updated_at        TEXT NOT NULL,
     shared            INTEGER NOT NULL DEFAULT 0,
     copied_from       TEXT NOT NULL DEFAULT ''
   );
   INSERT INTO lists_new (id, owner_id, title, lang_a, lang_b, mode, case_sensitive, accent_sensitive,
       direction, allow_switch, created_at, updated_at, shared, copied_from)
     SELECT id, owner_id, title, lang_a, lang_b, mode, case_sensitive, accent_sensitive,
       direction, allow_switch, created_at, updated_at, shared, copied_from FROM lists;
   DROP TABLE lists;
   ALTER TABLE lists_new RENAME TO lists;
   CREATE INDEX lists_shared ON lists(shared);
   ALTER TABLE words ADD COLUMN example TEXT NOT NULL DEFAULT '';
   ALTER TABLE review_log ADD COLUMN exercise TEXT NOT NULL DEFAULT '';`,
  // 5: Lernen ohne Internet. Jede Antwort bekommt im Browser eine eindeutige ID; kommt sie beim
  //    Übertragen doppelt an (z. B. Verbindung während des Sendens abgerissen), zählt sie nur einmal.
  `ALTER TABLE review_log ADD COLUMN client_id TEXT;
   CREATE UNIQUE INDEX review_log_client ON review_log(user_id, client_id) WHERE client_id IS NOT NULL;`,
  // 6: „Angemeldet bleiben“ – Geräteschlüssel (nur als Hash), siehe devices.js
  `CREATE TABLE device_tokens (
     hash       TEXT PRIMARY KEY,
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created    TEXT NOT NULL,
     last_used  TEXT,
     expires    INTEGER NOT NULL
   );
   CREATE INDEX device_tokens_user ON device_tokens(user_id);`,
  // 7: Schüler:innen dürfen die Abfrageart (Lernleiter, Karteikarten, …) selbst wählen – pro Liste abschaltbar
  `ALTER TABLE lists ADD COLUMN allow_mode_switch INTEGER NOT NULL DEFAULT 1;`,
  // 8: Jahrgangsstufe einer Liste (1–13), zum Filtern und Sortieren der geteilten Listen.
  //    Bestehende Listen haben noch keine; beim nächsten Speichern muss sie gewählt werden.
  `ALTER TABLE lists ADD COLUMN grade INTEGER;`,
  // 9: Grammatik. Eine Liste ist entweder eine Vokabelliste oder eine Grammatikliste (kind). Grammatik besteht
  //    aus Regeln mit Aufgaben; geplant wird pro Regel (rule_progress, gleiche Spalten wie progress ohne Richtung).
  //    grammar_log hält jede Aufgabe einzeln fest (mit der ersten falschen Antwort, für die Fehlerauswertung)
  //    und je Runde eine Zeile der Regel (exercise = 'round', mit der Stabilität danach).
  `ALTER TABLE lists ADD COLUMN kind TEXT NOT NULL DEFAULT 'vocab' CHECK (kind IN ('vocab', 'grammar'));
   CREATE TABLE rules (
     id           INTEGER PRIMARY KEY,
     list_id      INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
     pos          INTEGER NOT NULL,
     title        TEXT NOT NULL,
     summary      TEXT NOT NULL,
     explanation  TEXT NOT NULL DEFAULT '',
     discover     INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX rules_list ON rules(list_id, pos);
   CREATE TABLE items (
     id       INTEGER PRIMARY KEY,
     rule_id  INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
     pos      INTEGER NOT NULL,
     source   TEXT NOT NULL
   );
   CREATE INDEX items_rule ON items(rule_id, pos);
   CREATE TABLE rule_progress (
     user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rule_id         INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
     box             INTEGER NOT NULL DEFAULT 0,
     right           INTEGER NOT NULL DEFAULT 0,
     wrong           INTEGER NOT NULL DEFAULT 0,
     last_seen       TEXT NOT NULL,
     stability       REAL,
     difficulty      REAL,
     due             TEXT,
     state           INTEGER,
     reps            INTEGER NOT NULL DEFAULT 0,
     lapses          INTEGER NOT NULL DEFAULT 0,
     scheduled_days  INTEGER NOT NULL DEFAULT 0,
     last_review     TEXT,
     PRIMARY KEY (user_id, rule_id)
   );
   CREATE INDEX rule_progress_due ON rule_progress(user_id, due);
   CREATE TABLE grammar_log (
     id         INTEGER PRIMARY KEY,
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rule_id    INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
     item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
     grade      TEXT NOT NULL,
     exercise   TEXT NOT NULL,
     attempts   INTEGER NOT NULL DEFAULT 1,
     answer     TEXT,
     stability  REAL,
     at         TEXT NOT NULL,
     client_id  TEXT
   );
   CREATE INDEX grammar_log_rule ON grammar_log(rule_id, at);
   CREATE INDEX grammar_log_user ON grammar_log(user_id, at);
   CREATE INDEX grammar_log_item ON grammar_log(item_id);
   CREATE UNIQUE INDEX grammar_log_client ON grammar_log(user_id, client_id) WHERE client_id IS NOT NULL;`,
];

function migrate(db) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  for (let v = version; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function now() {
  return new Date().toISOString();
}
