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
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Änderungen am Schema für bestehende Datenbanken. Nur anhängen, nie umsortieren.
const MIGRATIONS = [
  // 1: Listen für Kolleg:innen freigeben und kopieren
  `ALTER TABLE lists ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE lists ADD COLUMN copied_from TEXT NOT NULL DEFAULT '';
   CREATE INDEX IF NOT EXISTS lists_shared ON lists(shared);`,
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
