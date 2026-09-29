// „Angemeldet bleiben“: ein Geräteschlüssel, den die App auf dem Gerät speichert. Fehlt das
// Sitzungs-Cookie (abgelaufen oder von iOS verworfen), startet die App damit still eine neue Sitzung.
//
// Der Schlüssel gilt eine feste Zeit ab der IServ-Anmeldung (REMEMBER_DAYS) und verlängert sich nicht
// durch Benutzung: Gruppen (Klasse, Kurse) werden nur bei einer echten Anmeldung aktualisiert.
// In der Datenbank steht nur der Hash; Abmelden löscht den Schlüssel.
import { createHash, randomBytes } from 'node:crypto';
import { now } from './db.js';

const DAY = 24 * 60 * 60 * 1000;
const hash = (token) => createHash('sha256').update(token).digest('base64url');

export function issueDeviceToken(db, userId, days) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO device_tokens (hash, user_id, created, expires) VALUES (?, ?, ?, ?)')
    .run(hash(token), userId, now(), Date.now() + days * DAY);
  return { token, hash: hash(token) };
}

// Gültiger Schlüssel → { userId, hash }, sonst null
export function resumeDevice(db, token) {
  if (typeof token !== 'string' || token.length > 100) return null;
  const h = hash(token);
  const row = db.prepare('SELECT user_id FROM device_tokens WHERE hash = ? AND expires > ?').get(h, Date.now());
  if (!row) return null;
  db.prepare('UPDATE device_tokens SET last_used = ? WHERE hash = ?').run(now(), h);
  return { userId: row.user_id, hash: h };
}

export function forgetDevice(db, h) {
  if (h) db.prepare('DELETE FROM device_tokens WHERE hash = ?').run(h);
}

// Alten Schlüssel der App ungültig machen, wenn sie nach einer neuen Anmeldung einen neuen bekommt
export function forgetDeviceToken(db, token, userId) {
  if (typeof token === 'string' && token.length <= 100) {
    db.prepare('DELETE FROM device_tokens WHERE hash = ? AND user_id = ?').run(hash(token), userId);
  }
}

export function purgeDevices(db) {
  db.prepare('DELETE FROM device_tokens WHERE expires <= ?').run(Date.now());
}
