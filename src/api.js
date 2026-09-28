import express from 'express';
import { now, transaction } from './db.js';

// Ab diesem Kästchen gilt ein Wort als „sicher“ (Leitner, 0 = neu … 5 = fertig).
export const SAFE_BOX = 3;
const MAX_BOX = 5;
const MAX_WORDS = 2000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function text(value, max, field) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `Ungültiges Feld: ${field}`);
  const t = value.trim();
  if (t.length > max) throw new HttpError(400, `${field} ist zu lang (max. ${max} Zeichen).`);
  return t;
}

function parseListBody(body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Ungültige Daten.');
  const title = text(body.title, 200, 'Titel');
  if (!title) throw new HttpError(400, 'Bitte einen Titel angeben.');
  const mode = body.mode === 'type' ? 'type' : 'flip';
  const direction = ['ab', 'ba', 'mixed'].includes(body.direction) ? body.direction : 'ab';
  if (!Array.isArray(body.words)) throw new HttpError(400, 'Wörter fehlen.');
  if (body.words.length > MAX_WORDS) throw new HttpError(400, `Höchstens ${MAX_WORDS} Wörter pro Liste.`);
  const words = [];
  for (const w of body.words) {
    const a = text(w?.a, 500, 'Wort');
    const b = text(w?.b, 500, 'Wort');
    if (!a && !b) continue;
    if (!a || !b) throw new HttpError(400, `Unvollständige Zeile: „${a || b}“`);
    words.push({ id: Number.isInteger(w.id) ? w.id : null, a, b, note: text(w.note, 1000, 'Notiz') });
  }
  if (!words.length) throw new HttpError(400, 'Die Liste enthält keine Wörter.');
  const groups = Array.isArray(body.groups)
    ? body.groups
        .filter((g) => g && typeof g.id === 'string' && g.id.trim())
        .map((g) => ({ id: g.id.trim().slice(0, 200), name: text(g.name || g.id, 200, 'Gruppe') }))
    : [];
  return {
    title,
    lang_a: text(body.lang_a, 50, 'Sprache A'),
    lang_b: text(body.lang_b, 50, 'Sprache B'),
    mode,
    case_sensitive: body.case_sensitive ? 1 : 0,
    accent_sensitive: body.accent_sensitive ? 1 : 0,
    direction,
    allow_switch: body.allow_switch === false ? 0 : 1,
    shared: body.shared ? 1 : 0,
    words,
    groups,
  };
}

function listJson(row) {
  return {
    id: row.id,
    title: row.title,
    lang_a: row.lang_a,
    lang_b: row.lang_b,
    mode: row.mode,
    case_sensitive: !!row.case_sensitive,
    accent_sensitive: !!row.accent_sensitive,
    direction: row.direction,
    allow_switch: !!row.allow_switch,
    shared: !!row.shared,
    copied_from: row.copied_from || '',
    updated_at: row.updated_at,
  };
}

export function apiRouter(db, config) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  const q = {
    user: db.prepare('SELECT id, name, is_teacher FROM users WHERE id = ?'),
    userGroups: db.prepare('SELECT group_id AS id, group_name AS name FROM user_groups WHERE user_id = ? ORDER BY group_name'),
    list: db.prepare('SELECT * FROM lists WHERE id = ?'),
    listGroups: db.prepare('SELECT group_id AS id, group_name AS name FROM list_groups WHERE list_id = ? ORDER BY group_name'),
    words: db.prepare('SELECT id, a, b, note FROM words WHERE list_id = ? ORDER BY pos, id'),
    canSee: db.prepare(
      `SELECT 1 FROM list_groups lg JOIN user_groups ug ON ug.group_id = lg.group_id
       WHERE lg.list_id = ? AND ug.user_id = ? LIMIT 1`,
    ),
    ownLists: db.prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM words w WHERE w.list_id = l.id) AS word_count
       FROM lists l WHERE l.owner_id = ? ORDER BY l.updated_at DESC`,
    ),
    assignedLists: db.prepare(
      `SELECT DISTINCT l.*, u.name AS owner_name,
         (SELECT COUNT(*) FROM words w WHERE w.list_id = l.id) AS word_count
       FROM lists l
       JOIN list_groups lg ON lg.list_id = l.id
       JOIN user_groups ug ON ug.group_id = lg.group_id AND ug.user_id = ?
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.owner_id IS NOT ? ORDER BY l.updated_at DESC`,
    ),
    myProgressSummary: db.prepare(
      `SELECT w.list_id, COUNT(DISTINCT p.word_id) AS seen,
         COUNT(DISTINCT CASE WHEN p.box >= ${SAFE_BOX} THEN p.word_id END) AS safe,
         MAX(p.last_seen) AS last_seen
       FROM progress p JOIN words w ON w.id = p.word_id
       WHERE p.user_id = ? GROUP BY w.list_id`,
    ),
    myProgress: db.prepare(
      `SELECT p.word_id, p.direction, p.box, p.right, p.wrong, p.last_seen
       FROM progress p JOIN words w ON w.id = p.word_id
       WHERE p.user_id = ? AND w.list_id = ?`,
    ),
    sharedLists: db.prepare(
      `SELECT l.*, u.name AS owner_name, (SELECT COUNT(*) FROM words w WHERE w.list_id = l.id) AS word_count
       FROM lists l LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.shared = 1 AND l.owner_id IS NOT ? ORDER BY l.updated_at DESC LIMIT 1000`,
    ),
    ownerName: db.prepare('SELECT name FROM users WHERE id = ?'),
    wordInList: db.prepare('SELECT 1 FROM words WHERE id = ? AND list_id = ?'),
    getProgress: db.prepare('SELECT box FROM progress WHERE user_id = ? AND word_id = ? AND direction = ?'),
    putProgress: db.prepare(
      `INSERT INTO progress (user_id, word_id, direction, box, right, wrong, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id, direction) DO UPDATE SET
         box = excluded.box, right = right + excluded.right, wrong = wrong + excluded.wrong,
         last_seen = excluded.last_seen`,
    ),
  };

  // Angemeldete Person laden
  router.use((req, res, next) => {
    const id = req.session.data.userId;
    const user = id && q.user.get(id);
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet.' });
    req.user = { id: user.id, name: user.name, isTeacher: !!user.is_teacher };
    next();
  });

  function requireTeacher(req) {
    if (!req.user.isTeacher) throw new HttpError(403, 'Nur für Lehrkräfte.');
  }

  function loadList(id) {
    const list = q.list.get(Number(id));
    if (!list) throw new HttpError(404, 'Liste nicht gefunden.');
    return list;
  }

  function assertCanSee(list, user) {
    if (list.owner_id === user.id) return;
    if (list.shared && user.isTeacher) return;
    if (!q.canSee.get(list.id, user.id)) throw new HttpError(403, 'Kein Zugriff auf diese Liste.');
  }

  function assertOwner(list, user) {
    if (list.owner_id !== user.id) throw new HttpError(403, 'Nur die Ersteller:in darf diese Liste ändern.');
  }

  function teacherGroups(userId) {
    return q.userGroups
      .all(userId)
      .filter((g) => !config.hiddenGroups.includes(g.id.toLowerCase()) && !config.hiddenGroups.includes(g.name.toLowerCase()));
  }

  const wrap = (fn) => (req, res, next) => {
    try {
      const result = fn(req, res);
      if (result !== undefined) res.json(result);
    } catch (err) {
      next(err);
    }
  };

  router.get('/me', wrap((req) => ({
    ...req.user,
    groups: req.user.isTeacher ? teacherGroups(req.user.id) : [],
  })));

  router.get('/lists', wrap((req) => {
    const summary = new Map(q.myProgressSummary.all(req.user.id).map((s) => [s.list_id, s]));
    const withProgress = (row) => {
      const s = summary.get(row.id);
      return {
        ...listJson(row),
        owner_name: row.owner_name,
        word_count: row.word_count,
        progress: { seen: s?.seen ?? 0, safe: s?.safe ?? 0, last_seen: s?.last_seen ?? null },
      };
    };
    const own = req.user.isTeacher
      ? q.ownLists.all(req.user.id).map((row) => ({ ...withProgress(row), groups: q.listGroups.all(row.id) }))
      : [];
    const assigned = q.assignedLists.all(req.user.id, req.user.id).map(withProgress);
    return { own, assigned };
  }));

  router.get('/lists/:id', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    const isOwner = list.owner_id === req.user.id;
    return {
      ...listJson(list),
      is_owner: isOwner,
      owner_name: isOwner ? req.user.name : q.ownerName.get(list.owner_id)?.name ?? '',
      can_copy: req.user.isTeacher && (isOwner || !!list.shared),
      groups: isOwner ? q.listGroups.all(list.id) : undefined,
      words: q.words.all(list.id),
      progress: q.myProgress.all(req.user.id, list.id),
    };
  }));

  function writeList(listId, data) {
    const ts = now();
    db.prepare(
      `UPDATE lists SET title = ?, lang_a = ?, lang_b = ?, mode = ?, case_sensitive = ?, accent_sensitive = ?,
         direction = ?, allow_switch = ?, shared = ?, updated_at = ? WHERE id = ?`,
    ).run(data.title, data.lang_a, data.lang_b, data.mode, data.case_sensitive, data.accent_sensitive,
      data.direction, data.allow_switch, data.shared, ts, listId);

    // Bestehende Wörter behalten ihre ID, damit der Lernstand erhalten bleibt.
    const existing = new Set(db.prepare('SELECT id FROM words WHERE list_id = ?').all(listId).map((r) => r.id));
    const keep = new Set();
    const update = db.prepare('UPDATE words SET pos = ?, a = ?, b = ?, note = ? WHERE id = ? AND list_id = ?');
    const insert = db.prepare('INSERT INTO words (list_id, pos, a, b, note) VALUES (?, ?, ?, ?, ?)');
    data.words.forEach((w, pos) => {
      if (w.id && existing.has(w.id) && !keep.has(w.id)) {
        update.run(pos, w.a, w.b, w.note, w.id, listId);
        keep.add(w.id);
      } else {
        insert.run(listId, pos, w.a, w.b, w.note);
      }
    });
    const remove = db.prepare('DELETE FROM words WHERE id = ?');
    for (const id of existing) if (!keep.has(id)) remove.run(id);

    db.prepare('DELETE FROM list_groups WHERE list_id = ?').run(listId);
    const addGroup = db.prepare('INSERT OR IGNORE INTO list_groups (list_id, group_id, group_name) VALUES (?, ?, ?)');
    for (const g of data.groups) addGroup.run(listId, g.id, g.name);
  }

  router.post('/lists', wrap((req, res) => {
    requireTeacher(req);
    const data = parseListBody(req.body);
    const id = transaction(db, () => {
      const ts = now();
      const { id } = db
        .prepare('INSERT INTO lists (owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id')
        .get(req.user.id, data.title, ts, ts);
      writeList(id, data);
      return id;
    });
    res.status(201);
    return { id };
  }));

  router.put('/lists/:id', wrap((req) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    const data = parseListBody(req.body);
    transaction(db, () => writeList(list.id, data));
    return { id: list.id };
  }));

  router.delete('/lists/:id', wrap((req) => {
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    db.prepare('DELETE FROM lists WHERE id = ?').run(list.id);
    return { ok: true };
  }));

  // Von Kolleg:innen freigegebene Listen (ohne die eigenen)
  router.get('/shared', wrap((req) => {
    requireTeacher(req);
    return q.sharedLists.all(req.user.id).map((row) => ({
      ...listJson(row),
      owner_name: row.owner_name ?? '',
      word_count: row.word_count,
    }));
  }));

  // Eigene Kopie einer freigegebenen (oder eigenen) Liste anlegen – ohne Gruppen, nicht freigegeben.
  router.post('/lists/:id/copy', wrap((req, res) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    const isOwner = list.owner_id === req.user.id;
    if (!isOwner && !list.shared) throw new HttpError(403, 'Diese Liste ist nicht freigegeben.');
    const ownerName = isOwner ? '' : q.ownerName.get(list.owner_id)?.name ?? '';
    const id = transaction(db, () => {
      const ts = now();
      const { id } = db
        .prepare(
          `INSERT INTO lists (owner_id, title, lang_a, lang_b, mode, case_sensitive, accent_sensitive,
             direction, allow_switch, shared, copied_from, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?) RETURNING id`,
        )
        .get(req.user.id, isOwner ? `${list.title} (Kopie)` : list.title, list.lang_a, list.lang_b, list.mode,
          list.case_sensitive, list.accent_sensitive, list.direction, list.allow_switch,
          ownerName ? `${list.title} – ${ownerName}` : list.copied_from, ts, ts);
      db.prepare(
        `INSERT INTO words (list_id, pos, a, b, note)
         SELECT ?, pos, a, b, note FROM words WHERE list_id = ? ORDER BY pos, id`,
      ).run(id, list.id);
      return id;
    });
    res.status(201);
    return { id };
  }));

  // Ergebnisse einer Lernrunde: [{ word_id, direction, correct }]
  router.post('/lists/:id/results', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    const results = Array.isArray(req.body?.results) ? req.body.results.slice(0, 500) : [];
    const ts = now();
    transaction(db, () => {
      for (const r of results) {
        const wordId = Number(r?.word_id);
        const direction = r?.direction === 'ba' ? 'ba' : 'ab';
        if (!Number.isInteger(wordId) || !q.wordInList.get(wordId, list.id)) continue;
        const box = q.getProgress.get(req.user.id, wordId, direction)?.box ?? 0;
        const next = r.correct ? Math.min(box + 1, MAX_BOX) : 1;
        q.putProgress.run(req.user.id, wordId, direction, next, r.correct ? 1 : 0, r.correct ? 0 : 1, ts);
      }
    });
    return { progress: q.myProgress.all(req.user.id, list.id) };
  }));

  router.delete('/lists/:id/progress', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    db.prepare('DELETE FROM progress WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE list_id = ?)')
      .run(req.user.id, list.id);
    return { ok: true };
  }));

  // Übersicht für die Lehrkraft: Lernstand aller Schüler:innen der zugewiesenen Gruppen.
  router.get('/lists/:id/stats', wrap((req) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    const words = q.words.all(list.id);
    const groups = q.listGroups.all(list.id).map((g) => {
      const students = db
        .prepare(
          `SELECT u.id, u.name,
             COUNT(DISTINCT p.word_id) AS seen,
             COUNT(DISTINCT CASE WHEN p.box >= ${SAFE_BOX} THEN p.word_id END) AS safe,
             COALESCE(SUM(p.right), 0) AS right, COALESCE(SUM(p.wrong), 0) AS wrong,
             MAX(p.last_seen) AS last_seen
           FROM user_groups ug
           JOIN users u ON u.id = ug.user_id AND u.is_teacher = 0
           LEFT JOIN progress p ON p.user_id = u.id AND p.word_id IN (SELECT id FROM words WHERE list_id = ?)
           WHERE ug.group_id = ?
           GROUP BY u.id ORDER BY u.name COLLATE NOCASE`,
        )
        .all(list.id, g.id);
      return { ...g, students };
    });
    // Schwierigste Wörter: höchste Fehlerquote über alle Lernenden
    const hardest = db
      .prepare(
        `SELECT w.a, w.b, SUM(p.right) AS right, SUM(p.wrong) AS wrong
         FROM progress p JOIN words w ON w.id = p.word_id
         JOIN users u ON u.id = p.user_id AND u.is_teacher = 0
         WHERE w.list_id = ? GROUP BY w.id HAVING SUM(p.wrong) > 0
         ORDER BY CAST(SUM(p.wrong) AS REAL) / (SUM(p.right) + SUM(p.wrong)) DESC, SUM(p.wrong) DESC
         LIMIT 10`,
      )
      .all(list.id);
    return { list: listJson(list), word_count: words.length, safe_box: SAFE_BOX, groups, hardest };
  }));

  router.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ungültiges JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Liste ist zu groß.' });
    next(err);
  });

  return router;
}
