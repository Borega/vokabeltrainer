import { randomBytes } from 'node:crypto';

// Schlanke Server-Sessions in SQLite. Im Cookie steht nur eine zufällige ID.

const COOKIE = 'vt_sid';

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionMiddleware(db, { days, secure }) {
  const maxAge = days * 24 * 60 * 60;
  const get = db.prepare('SELECT data FROM sessions WHERE id = ? AND expires > ?');
  const put = db.prepare(
    'INSERT INTO sessions (id, data, expires) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, expires = excluded.expires',
  );
  const del = db.prepare('DELETE FROM sessions WHERE id = ?');

  function setCookie(res, id, age) {
    const parts = [`${COOKIE}=${id}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${age}`];
    if (secure) parts.push('Secure');
    res.append('Set-Cookie', parts.join('; '));
  }

  return (req, res, next) => {
    let id = parseCookies(req.headers.cookie)[COOKIE];
    const row = id && get.get(id, Date.now());
    let data = row ? JSON.parse(row.data) : {};
    if (!row) id = null;
    const original = JSON.stringify(data);

    req.session = {
      get data() {
        return data;
      },
      // Neue ID nach dem Login verhindert Session-Fixation.
      regenerate() {
        if (id) del.run(id);
        id = null;
        data = {};
      },
      destroy() {
        if (id) del.run(id);
        id = null;
        data = null;
        setCookie(res, '', 0);
      },
    };

    const end = res.end;
    res.end = function (...args) {
      if (data && (JSON.stringify(data) !== original || !id) && Object.keys(data).length) {
        const fresh = !id;
        if (fresh) id = randomBytes(32).toString('base64url');
        put.run(id, JSON.stringify(data), Date.now() + maxAge * 1000);
        if (fresh && !res.headersSent) setCookie(res, id, maxAge);
      }
      return end.apply(this, args);
    };
    next();
  };
}

export function purgeSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
}
