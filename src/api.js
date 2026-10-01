import express from 'express';
import { now, transaction } from './db.js';
import { forgetDevice, forgetDeviceToken, issueDeviceToken } from './devices.js';
import { GRADES, SAFE_LEVEL, levelFor, review } from './scheduler.js';
import { LIMITS, parseItem, roundGrade, validateRules } from '../public/grammar.js';
import { BADGES, LONG_RECALL_DAYS, collection, newlyEarned, titleOf } from './badges.js';
import { DAILY_GOAL, computeStreak, endOfDay, localDay, weekOf } from './streak.js';

// Ab dieser Stufe gilt ein Wort als „sicher“ (0 = neu … 5, siehe scheduler.js).
export const SAFE_BOX = SAFE_LEVEL;
const MAX_WORDS = 2000;
const DAY = 24 * 60 * 60 * 1000;
const HISTORY_WEEKS = 8;
// Höchstzahl Antworten pro Übertragung (der Browser schickt größere Mengen in Teilen)
const MAX_RESULTS = 500;
// Jahrgangsstufen, für die eine Liste gedacht sein kann
const GRADES_MIN = 1;
const GRADES_MAX = 13;
// auto = Lernleiter: Übungsart passt sich dem Lernstand jedes Worts an (siehe public/exercises.js)
const MODES = ['auto', 'flip', 'type', 'choice'];
// Übungsarten, die im Verlauf protokolliert werden
const EXERCISES = ['flip', 'type', 'choice', 'cloze', 'listen'];
const GRAMMAR_EXERCISES = ['choice', 'gap', 'error', 'order', 'translate'];
// Höchstzahl Aufgaben, die eine Regel-Antwort (eine Runde) enthalten darf
const MAX_ROUND_ITEMS = 30;
// Wie viele häufige Fehler die Auswertung zeigt
const MAX_ERRORS = 30;

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

function parseGrade(rawGrade) {
  // Nur eine Zahl oder eine schlichte Dezimalzahl als Text – kein true, [7] oder "0xA"
  const grade = typeof rawGrade === 'number' || (typeof rawGrade === 'string' && /^\d{1,2}$/.test(rawGrade.trim()))
    ? Number(rawGrade)
    : NaN;
  if (!Number.isInteger(grade) || grade < GRADES_MIN || grade > GRADES_MAX) {
    throw new HttpError(400, 'Bitte die Jahrgangsstufe angeben.');
  }
  return grade;
}

function parseGroups(raw) {
  return Array.isArray(raw)
    ? raw
        .filter((g) => g && typeof g.id === 'string' && g.id.trim())
        .map((g) => ({ id: g.id.trim().slice(0, 200), name: text(g.name || g.id, 200, 'Gruppe') }))
    : [];
}

// Regeln einer Grammatikliste: { id?, title, summary, explanation, discover, items: [{ id?, source }] }.
// Die Aufgaben werden mit demselben Parser geprüft wie im Browser (public/grammar.js).
function parseRules(raw) {
  if (!Array.isArray(raw)) throw new HttpError(400, 'Regeln fehlen.');
  if (raw.length > LIMITS.rules) throw new HttpError(400, `Höchstens ${LIMITS.rules} Regeln pro Liste.`);
  const rules = raw.map((r) => ({
    id: Number.isInteger(r?.id) ? r.id : null,
    title: text(r?.title, LIMITS.title, 'Titel der Regel'),
    summary: text(r?.summary, LIMITS.summary, 'Merksatz'),
    explanation: text(r?.explanation, LIMITS.explanation, 'Erklärung'),
    discover: r?.discover ? 1 : 0,
    items: (Array.isArray(r?.items) ? r.items : [])
      .map((it) => ({ id: Number.isInteger(it?.id) ? it.id : null, source: text(it?.source, LIMITS.source, 'Aufgabe') }))
      .filter((it) => it.source),
  }));
  const error = validateRules(rules);
  if (error) throw new HttpError(400, error);
  // gespeichert wird die bereinigte Fassung (getrimmte Zeilen, keine Leerzeilen)
  for (const rule of rules) for (const it of rule.items) it.source = parseItem(it.source).source;
  return rules;
}

function parseListBody(body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Ungültige Daten.');
  const kind = body.kind === 'grammar' ? 'grammar' : 'vocab';
  const title = text(body.title, 200, 'Titel');
  if (!title) throw new HttpError(400, 'Bitte einen Titel angeben.');
  const grade = parseGrade(body.grade);
  const common = {
    kind,
    title,
    lang_a: text(body.lang_a, 50, 'Sprache A'),
    lang_b: text(body.lang_b, 50, 'Sprache B'),
    grade,
    case_sensitive: body.case_sensitive ? 1 : 0,
    accent_sensitive: body.accent_sensitive ? 1 : 0,
    shared: body.shared ? 1 : 0,
    groups: parseGroups(body.groups),
  };
  if (kind === 'grammar') {
    // Eine Sprache; Richtung und Abfrageart gibt es bei Grammatik nicht
    return { ...common, lang_b: '', learn_side: 'a', mode: 'auto', direction: 'ab', allow_switch: 1, allow_mode_switch: 1, rules: parseRules(body.rules) };
  }
  const mode = MODES.includes(body.mode) ? body.mode : 'auto';
  const direction = ['ab', 'ba', 'mixed'].includes(body.direction) ? body.direction : 'ab';
  if (!Array.isArray(body.words)) throw new HttpError(400, 'Wörter fehlen.');
  if (body.words.length > MAX_WORDS) throw new HttpError(400, `Höchstens ${MAX_WORDS} Wörter pro Liste.`);
  const words = [];
  for (const w of body.words) {
    const a = text(w?.a, 500, 'Wort');
    const b = text(w?.b, 500, 'Wort');
    if (!a && !b) continue;
    if (!a || !b) throw new HttpError(400, `Unvollständige Zeile: „${a || b}“`);
    words.push({
      id: Number.isInteger(w.id) ? w.id : null,
      a,
      b,
      note: text(w.note, 1000, 'Notiz'),
      example: text(w.example, 1000, 'Beispielsatz'),
    });
  }
  if (!words.length) throw new HttpError(400, 'Die Liste enthält keine Wörter.');
  return {
    ...common,
    mode,
    direction,
    allow_switch: body.allow_switch === false ? 0 : 1,
    allow_mode_switch: body.allow_mode_switch === false ? 0 : 1,
    // Ohne Angabe (ältere Clients) bleibt es bei der Schätzung im Browser
    learn_side: ['a', 'b'].includes(body.learn_side) ? body.learn_side : '',
    words,
  };
}

function listJson(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    lang_a: row.lang_a,
    lang_b: row.lang_b,
    learn_side: row.learn_side ?? '',
    mode: row.mode,
    case_sensitive: !!row.case_sensitive,
    accent_sensitive: !!row.accent_sensitive,
    direction: row.direction,
    allow_switch: !!row.allow_switch,
    allow_mode_switch: !!row.allow_mode_switch,
    grade: row.grade ?? null,
    shared: !!row.shared,
    copied_from: row.copied_from || '',
    template: !!row.template,
    updated_at: row.updated_at,
  };
}

// Anzahl der Einheiten einer Liste: Wörter (Vokabeln) bzw. Regeln und Aufgaben (Grammatik)
const COUNTS = `(SELECT COUNT(*) FROM words w WHERE w.list_id = l.id) AS word_count,
  (SELECT COUNT(*) FROM rules r WHERE r.list_id = l.id) AS rule_count,
  (SELECT COUNT(*) FROM items i JOIN rules r ON r.id = i.rule_id WHERE r.list_id = l.id) AS item_count`;

// Regeln und Aufgaben mit ihren IDs: Lernstand und Fehlerstatistik bleiben erhalten, wo die ID bleibt.
// Auch für die mitgelieferten Vorlagen (siehe templates.js).
export function writeRules(db, listId, rules) {
  const existingRules = new Set(db.prepare('SELECT id FROM rules WHERE list_id = ?').all(listId).map((r) => r.id));
  const existingItems = new Set(
    db.prepare('SELECT i.id FROM items i JOIN rules r ON r.id = i.rule_id WHERE r.list_id = ?').all(listId).map((r) => r.id),
  );
  const keepRules = new Set();
  const keepItems = new Set();
  const updateRule = db.prepare('UPDATE rules SET pos = ?, title = ?, summary = ?, explanation = ?, discover = ? WHERE id = ?');
  const insertRule = db.prepare(
    'INSERT INTO rules (list_id, pos, title, summary, explanation, discover) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
  );
  const updateItem = db.prepare('UPDATE items SET rule_id = ?, pos = ?, source = ? WHERE id = ?');
  const insertItem = db.prepare('INSERT INTO items (rule_id, pos, source) VALUES (?, ?, ?)');
  rules.forEach((rule, pos) => {
    let ruleId = rule.id;
    if (ruleId && existingRules.has(ruleId) && !keepRules.has(ruleId)) {
      updateRule.run(pos, rule.title, rule.summary, rule.explanation, rule.discover, ruleId);
    } else {
      ruleId = insertRule.get(listId, pos, rule.title, rule.summary, rule.explanation, rule.discover).id;
    }
    keepRules.add(ruleId);
    rule.items.forEach((it, itemPos) => {
      if (it.id && existingItems.has(it.id) && !keepItems.has(it.id)) {
        updateItem.run(ruleId, itemPos, it.source, it.id);
        keepItems.add(it.id);
      } else {
        insertItem.run(ruleId, itemPos, it.source);
      }
    });
  });
  // Aufgaben zuerst: Eine in eine andere Regel verschobene Aufgabe hängt schon dort und bleibt erhalten.
  for (const id of existingItems) if (!keepItems.has(id)) db.prepare('DELETE FROM items WHERE id = ?').run(id);
  for (const id of existingRules) if (!keepRules.has(id)) db.prepare('DELETE FROM rules WHERE id = ?').run(id);
}

// Listen, die für die Lernserie einer Person (:u) zählen (siehe dueCount)
const STREAK_LISTS = `SELECT id FROM lists WHERE owner_id = :u
  UNION
  SELECT lg.list_id FROM list_groups lg
    JOIN user_groups ug ON ug.group_id = lg.group_id AND ug.user_id = :u
    LEFT JOIN group_settings gs ON gs.group_id = lg.group_id
    WHERE COALESCE(gs.gamification, 1) = 1`;

export function apiRouter(db, config) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  const q = {
    user: db.prepare('SELECT id, name, is_teacher FROM users WHERE id = ?'),
    userGroups: db.prepare('SELECT group_id AS id, group_name AS name FROM user_groups WHERE user_id = ? ORDER BY group_name'),
    list: db.prepare('SELECT * FROM lists WHERE id = ?'),
    listGroups: db.prepare('SELECT group_id AS id, group_name AS name FROM list_groups WHERE list_id = ? ORDER BY group_name'),
    words: db.prepare('SELECT id, a, b, note, example FROM words WHERE list_id = ? ORDER BY pos, id'),
    canSee: db.prepare(
      `SELECT 1 FROM list_groups lg JOIN user_groups ug ON ug.group_id = lg.group_id
       WHERE lg.list_id = ? AND ug.user_id = ? LIMIT 1`,
    ),
    ownLists: db.prepare(
      `SELECT l.*, ${COUNTS} FROM lists l WHERE l.owner_id = ? ORDER BY l.updated_at DESC`,
    ),
    assignedLists: db.prepare(
      `SELECT DISTINCT l.*, u.name AS owner_name, ${COUNTS}
       FROM lists l
       JOIN list_groups lg ON lg.list_id = l.id
       JOIN user_groups ug ON ug.group_id = lg.group_id AND ug.user_id = ?
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.owner_id IS NOT ? ORDER BY l.updated_at DESC`,
    ),
    myProgressSummary: db.prepare(
      `SELECT w.list_id, COUNT(DISTINCT p.word_id) AS seen,
         COUNT(DISTINCT CASE WHEN p.box >= ${SAFE_BOX} THEN p.word_id END) AS safe,
         COUNT(CASE WHEN p.due <= ? THEN 1 END) AS due,
         MAX(p.last_seen) AS last_seen
       FROM progress p JOIN words w ON w.id = p.word_id
       WHERE p.user_id = ? GROUP BY w.list_id`,
    ),
    // Grammatik: dasselbe je Regel
    myRuleSummary: db.prepare(
      `SELECT r.list_id, COUNT(*) AS seen,
         COUNT(CASE WHEN p.box >= ${SAFE_BOX} THEN 1 END) AS safe,
         COUNT(CASE WHEN p.due <= ? THEN 1 END) AS due,
         MAX(p.last_seen) AS last_seen
       FROM rule_progress p JOIN rules r ON r.id = p.rule_id
       WHERE p.user_id = ? GROUP BY r.list_id`,
    ),
    // Mit allen FSRS-Werten, damit der Browser ohne Internet weiterplanen kann
    myProgress: db.prepare(
      `SELECT p.word_id, p.direction, p.box, p.right, p.wrong, p.last_seen, p.due, p.stability,
         p.difficulty, p.state, p.reps, p.lapses, p.scheduled_days, p.last_review
       FROM progress p JOIN words w ON w.id = p.word_id
       WHERE p.user_id = ? AND w.list_id = ?`,
    ),
    sharedLists: db.prepare(
      `SELECT l.*, u.name AS owner_name, ${COUNTS}
       FROM lists l LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.shared = 1 AND l.owner_id IS NOT ? ORDER BY l.updated_at DESC LIMIT 1000`,
    ),
    myRuleProgress: db.prepare(
      `SELECT p.rule_id, p.box, p.right, p.wrong, p.last_seen, p.due, p.stability,
         p.difficulty, p.state, p.reps, p.lapses, p.scheduled_days, p.last_review
       FROM rule_progress p JOIN rules r ON r.id = p.rule_id
       WHERE p.user_id = ? AND r.list_id = ?`,
    ),
    rules: db.prepare('SELECT id, pos, title, summary, explanation, discover FROM rules WHERE list_id = ? ORDER BY pos, id'),
    ruleCount: db.prepare('SELECT COUNT(*) AS n FROM rules WHERE list_id = ?'),
    wordCount: db.prepare('SELECT COUNT(*) AS n FROM words WHERE list_id = ?'),
    ruleItems: db.prepare(
      `SELECT i.id, i.rule_id, i.source FROM items i JOIN rules r ON r.id = i.rule_id
       WHERE r.list_id = ? ORDER BY r.pos, r.id, i.pos, i.id`,
    ),
    // Wann hat diese Person die Aufgabe zuletzt bearbeitet? (für die Auswahl „am längsten nicht gesehen“)
    itemSeen: db.prepare(
      `SELECT g.item_id, MAX(g.at) AS seen FROM grammar_log g JOIN rules r ON r.id = g.rule_id
       WHERE g.user_id = ? AND r.list_id = ? AND g.item_id IS NOT NULL GROUP BY g.item_id`,
    ),
    ownerName: db.prepare('SELECT name FROM users WHERE id = ?'),
    wordInList: db.prepare('SELECT 1 FROM words WHERE id = ? AND list_id = ?'),
    ruleInList: db.prepare('SELECT 1 FROM rules WHERE id = ? AND list_id = ?'),
    itemInRule: db.prepare('SELECT 1 FROM items WHERE id = ? AND rule_id = ?'),
    logGrammar: db.prepare(
      `INSERT INTO grammar_log (user_id, rule_id, item_id, grade, exercise, attempts, answer, stability, at, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    seenGrammarClientId: db.prepare('SELECT 1 FROM grammar_log WHERE user_id = ? AND client_id = ?'),
    getRuleProgress: db.prepare('SELECT * FROM rule_progress WHERE user_id = ? AND rule_id = ?'),
    putRuleProgress: db.prepare(
      `INSERT INTO rule_progress (user_id, rule_id, box, right, wrong, last_seen,
         stability, difficulty, due, state, reps, lapses, scheduled_days, last_review)
       VALUES (:user_id, :rule_id, :box, :right, :wrong, :last_seen,
         :stability, :difficulty, :due, :state, :reps, :lapses, :scheduled_days, :last_review)
       ON CONFLICT(user_id, rule_id) DO UPDATE SET
         box = excluded.box, right = right + excluded.right, wrong = wrong + excluded.wrong,
         last_seen = MAX(last_seen, excluded.last_seen), stability = excluded.stability, difficulty = excluded.difficulty,
         due = excluded.due, state = excluded.state, reps = excluded.reps, lapses = excluded.lapses,
         scheduled_days = excluded.scheduled_days, last_review = excluded.last_review`,
    ),
    logReview: db.prepare(
      `INSERT INTO review_log (user_id, word_id, direction, grade, stability, at, exercise, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    seenClientId: db.prepare('SELECT 1 FROM review_log WHERE user_id = ? AND client_id = ?'),
    // Lernserie: nur Listen, die die Person selbst besitzt oder über eine Gruppe bekommt, in der sie nicht abgeschaltet ist
    dueCount: db.prepare(
      `SELECT (SELECT COUNT(*) FROM progress p JOIN words w ON w.id = p.word_id
                WHERE p.user_id = :u AND p.due <= :until AND w.list_id IN (${STREAK_LISTS}))
            + (SELECT COUNT(*) FROM rule_progress p JOIN rules r ON r.id = p.rule_id
                WHERE p.user_id = :u AND p.due <= :until AND r.list_id IN (${STREAK_LISTS})) AS n`,
    ),
    firstDue: db.prepare(
      `SELECT MIN(due) AS due FROM (
         SELECT p.due FROM progress p JOIN words w ON w.id = p.word_id
           WHERE p.user_id = :u AND p.due IS NOT NULL AND w.list_id IN (${STREAK_LISTS})
         UNION ALL
         SELECT p.due FROM rule_progress p JOIN rules r ON r.id = p.rule_id
           WHERE p.user_id = :u AND p.due IS NOT NULL AND r.list_id IN (${STREAK_LISTS}))`,
    ),
    streakListIds: db.prepare(`SELECT id FROM (${STREAK_LISTS})`),
    // Abzeichen: Kennzahlen aus dem Lernstand, nur aus Listen mit Lernserie (siehe badges.js)
    badgeStats: db.prepare(
      `SELECT
         (SELECT COUNT(DISTINCT p.word_id) FROM progress p JOIN words w ON w.id = p.word_id
           WHERE p.user_id = :u AND p.box >= ${SAFE_BOX} AND w.list_id IN (${STREAK_LISTS})) AS safeWords,
         (SELECT COUNT(*) FROM (SELECT p.word_id FROM progress p JOIN words w ON w.id = p.word_id
           WHERE p.user_id = :u AND p.box >= ${SAFE_BOX} AND w.list_id IN (${STREAK_LISTS})
           GROUP BY p.word_id HAVING COUNT(DISTINCT p.direction) = 2)) AS bothWays,
         (SELECT COUNT(*) FROM rule_progress p JOIN rules r ON r.id = p.rule_id
           WHERE p.user_id = :u AND p.box >= ${SAFE_BOX} AND r.list_id IN (${STREAK_LISTS})) AS safeRules,
         (SELECT COUNT(*) FROM lists l WHERE l.id IN (${STREAK_LISTS}) AND (
           (l.kind = 'vocab' AND (SELECT COUNT(*) FROM words w WHERE w.list_id = l.id) >= 5
             AND NOT EXISTS (SELECT 1 FROM words w WHERE w.list_id = l.id AND NOT EXISTS
               (SELECT 1 FROM progress p WHERE p.word_id = w.id AND p.user_id = :u AND p.box >= ${SAFE_BOX})))
           OR (l.kind = 'grammar' AND (SELECT COUNT(*) FROM rules r WHERE r.list_id = l.id) >= 3
             AND NOT EXISTS (SELECT 1 FROM rules r WHERE r.list_id = l.id AND NOT EXISTS
               (SELECT 1 FROM rule_progress p WHERE p.rule_id = r.id AND p.user_id = :u AND p.box >= ${SAFE_BOX}))))) AS listsMastered`,
    ),
    earnedBadges: db.prepare('SELECT badge, earned_at FROM badges_earned WHERE user_id = ?'),
    addBadge: db.prepare('INSERT OR IGNORE INTO badges_earned (user_id, badge, earned_at) VALUES (?, ?, ?)'),
    doneDays: db.prepare('SELECT COUNT(*) AS n FROM learning_days WHERE user_id = ? AND done = 1'),
    // Wann wurde das Wort zuletzt in irgendeiner Richtung abgefragt?
    lastWordReview: db.prepare('SELECT MAX(last_review) AS at FROM progress WHERE user_id = ? AND word_id = ?'),
    lastReview: db.prepare('SELECT grade, at FROM review_log WHERE user_id = ? AND word_id = ? AND direction = ? ORDER BY at DESC, id DESC LIMIT 1'),
    learningDays: db.prepare('SELECT day, answers, had_due, done, next_due FROM learning_days WHERE user_id = ? ORDER BY day'),
    learningDay: db.prepare('SELECT answers, had_due, done FROM learning_days WHERE user_id = ? AND day = ?'),
    putLearningDay: db.prepare(
      `INSERT INTO learning_days (user_id, day, answers, had_due, done, next_due) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET answers = excluded.answers, had_due = excluded.had_due,
         done = excluded.done, next_due = excluded.next_due`,
    ),
    groupFlags: db.prepare(
      `SELECT ug.group_id AS id, ug.group_name AS name, COALESCE(gs.gamification, 1) AS enabled
       FROM user_groups ug LEFT JOIN group_settings gs ON gs.group_id = ug.group_id WHERE ug.user_id = ?`,
    ),
    setGroupSetting: db.prepare(
      `INSERT INTO group_settings (group_id, gamification) VALUES (?, ?)
       ON CONFLICT(group_id) DO UPDATE SET gamification = excluded.gamification`,
    ),
    getProgress: db.prepare('SELECT * FROM progress WHERE user_id = ? AND word_id = ? AND direction = ?'),
    putProgress: db.prepare(
      `INSERT INTO progress (user_id, word_id, direction, box, right, wrong, last_seen,
         stability, difficulty, due, state, reps, lapses, scheduled_days, last_review)
       VALUES (:user_id, :word_id, :direction, :box, :right, :wrong, :last_seen,
         :stability, :difficulty, :due, :state, :reps, :lapses, :scheduled_days, :last_review)
       ON CONFLICT(user_id, word_id, direction) DO UPDATE SET
         box = excluded.box, right = right + excluded.right, wrong = wrong + excluded.wrong,
         last_seen = MAX(last_seen, excluded.last_seen), stability = excluded.stability, difficulty = excluded.difficulty,
         due = excluded.due, state = excluded.state, reps = excluded.reps, lapses = excluded.lapses,
         scheduled_days = excluded.scheduled_days, last_review = excluded.last_review`,
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

  const isShownGroup = (g) => !config.hiddenGroups.includes(g.id.toLowerCase()) && !config.hiddenGroups.includes(g.name.toLowerCase());

  function teacherGroups(userId) {
    return q.groupFlags.all(userId).filter(isShownGroup).map((g) => ({ id: g.id, name: g.name, gamification: !!g.enabled }));
  }

  // ---------- Lernserie ----------

  const timezone = config.timezone ?? 'Europe/Berlin';
  const isoOf = (ms) => new Date(ms).toISOString();

  // Aus für die ganze Schule oder wenn alle (angezeigten) Gruppen der Person sie abgeschaltet haben
  function streakEnabled(userId) {
    if (config.gamification === false) return false;
    const groups = teacherGroups(userId);
    return !groups.length || groups.some((g) => g.gamification);
  }

  const dueUntilEndOf = (userId, day) => q.dueCount.get({ u: userId, until: isoOf(endOfDay(day, timezone)) }).n;

  // Tagesziel eines Tages nach neuen Antworten prüfen. answered: Antworten aus Listen mit Lernserie,
  // dueAnswered: davon fällige (nur sie zählen für die Obergrenze), dueBefore: was an dem Tag vor diesen Antworten
  // fällig war. Ergebnis: heute zum ersten Mal erledigt?
  function recordLearningDay(userId, day, dueAnswered, dueBefore) {
    const row = q.learningDay.get(userId, day);
    const answers = (row?.answers ?? 0) + dueAnswered;
    const hadDue = !!row?.had_due || dueBefore > 0;
    let done = !!row?.done;
    let reached = false;
    if (!done && hadDue) {
      done = dueUntilEndOf(userId, day) === 0 || answers >= DAILY_GOAL;
      reached = done && day === localDay(Date.now(), timezone);
    }
    const nextDue = q.firstDue.get({ u: userId }).due ?? null;
    q.putLearningDay.run(userId, day, answers, hadDue ? 1 : 0, done ? 1 : 0, nextDue);
    return reached;
  }

  // Für die Startseite: Serie, Lerntage, Tagesziel und die Woche
  function streakSummary(userId) {
    if (!streakEnabled(userId)) return { enabled: false };
    const stored = q.learningDays.all(userId);
    const rows = stored.map((r) => ({ day: r.day, done: !!r.done, had_due: !!r.had_due, next_due: r.next_due }));
    const today = localDay(Date.now(), timezone);
    const row = stored.find((r) => r.day === today);
    return {
      enabled: true,
      ...computeStreak(rows, today, timezone),
      goal: DAILY_GOAL,
      today: { done: !!row?.done, answers: row?.answers ?? 0, remaining: dueUntilEndOf(userId, today) },
      week: weekOf(rows, today),
      badges: { earned: q.earnedBadges.all(userId).length, total: BADGES.length },
    };
  }

  // ---------- Abzeichen ----------

  const badgeStats = (userId, events = {}) => ({
    ...q.badgeStats.get({ u: userId }),
    days: q.doneDays.get(userId).n,
    longRecall: !!events.longRecall,
    errorFixed: !!events.errorFixed,
  });

  // Neu erreichte Abzeichen vergeben. events: was in dieser Übertragung geschah (longRecall, errorFixed).
  // Ergebnis: [{ id, title }]
  function awardBadges(userId, events) {
    const have = new Set(q.earnedBadges.all(userId).map((b) => b.badge));
    if (have.size >= BADGES.length) return [];
    const ids = newlyEarned(badgeStats(userId, events), have);
    const ts = now();
    for (const id of ids) q.addBadge.run(userId, id, ts);
    return ids.map((id) => ({ id, title: titleOf(id) }));
  }

  const wrap = (fn) => (req, res, next) => {
    try {
      const result = fn(req, res);
      if (result !== undefined) res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // „Angemeldet bleiben“: Geräteschlüssel für diese App ausstellen (nach einer IServ-Anmeldung).
  // replace: bisheriger Schlüssel der App, der damit ungültig wird.
  router.post('/device-token', wrap((req) => {
    if (!(config.rememberDays > 0)) throw new HttpError(404, 'Angemeldet bleiben ist ausgeschaltet.');
    forgetDevice(db, req.session.data.device);
    forgetDeviceToken(db, req.body?.replace, req.user.id);
    const { token, hash } = issueDeviceToken(db, req.user.id, config.rememberDays);
    req.session.data.device = hash;
    return { token, days: config.rememberDays };
  }));

  // device: Sitzung hat schon einen Geräteschlüssel (sonst frische IServ-Anmeldung)
  router.get('/me', wrap((req) => ({
    ...req.user,
    device: !!req.session.data.device,
    remember: config.rememberDays > 0,
    gamification: config.gamification !== false,
    groups: req.user.isTeacher ? teacherGroups(req.user.id) : [],
  })));

  router.get('/streak', wrap((req) => streakSummary(req.user.id)));

  // Sammlung: erreichte Abzeichen und der Fortschritt zu den übrigen
  router.get('/badges', wrap((req) => {
    if (!streakEnabled(req.user.id)) return { enabled: false };
    const earned = new Map(q.earnedBadges.all(req.user.id).map((b) => [b.badge, b.earned_at]));
    return { enabled: true, badges: collection(badgeStats(req.user.id), earned) };
  }));

  // Lernserie für eine Gruppe ein- oder ausschalten (nur Lehrkräfte, die der Gruppe angehören)
  router.put('/group-settings', wrap((req) => {
    requireTeacher(req);
    const id = typeof req.body?.group_id === 'string' ? req.body.group_id : '';
    if (!teacherGroups(req.user.id).some((g) => g.id === id)) throw new HttpError(403, 'Diese Gruppe gehört nicht zu dir.');
    if (typeof req.body.gamification !== 'boolean') throw new HttpError(400, 'Ungültige Daten.');
    q.setGroupSetting.run(id, req.body.gamification ? 1 : 0);
    return { group_id: id, gamification: req.body.gamification };
  }));

  // ?due_until=<ISO-Zeitpunkt>: bis wann ein Wort als „heute fällig“ zählt (Ende des lokalen Tages im Browser)
  router.get('/lists', wrap((req) => {
    const until = new Date(String(req.query.due_until ?? ''));
    const dueUntil = Number.isNaN(until.getTime()) ? now() : until.toISOString();
    const summary = new Map([...q.myProgressSummary.all(dueUntil, req.user.id), ...q.myRuleSummary.all(dueUntil, req.user.id)]
      .map((s) => [s.list_id, s]));
    const withProgress = (row) => {
      const s = summary.get(row.id);
      return {
        ...listJson(row),
        owner_name: row.owner_name,
        word_count: row.word_count,
        rule_count: row.rule_count,
        item_count: row.item_count,
        progress: { seen: s?.seen ?? 0, safe: s?.safe ?? 0, due: s?.due ?? 0, last_seen: s?.last_seen ?? null },
      };
    };
    const own = req.user.isTeacher
      ? q.ownLists.all(req.user.id).map((row) => ({ ...withProgress(row), groups: q.listGroups.all(row.id) }))
      : [];
    const assigned = q.assignedLists.all(req.user.id, req.user.id).map(withProgress);
    return { own, assigned };
  }));

  // Regeln mit ihren Aufgaben; seen = wann diese Person die Aufgabe zuletzt bearbeitet hat
  function rulesOf(listId, userId) {
    const seen = new Map(q.itemSeen.all(userId, listId).map((r) => [r.item_id, r.seen]));
    const items = new Map();
    for (const it of q.ruleItems.all(listId)) {
      if (!items.has(it.rule_id)) items.set(it.rule_id, []);
      items.get(it.rule_id).push({ id: it.id, source: it.source, seen: seen.get(it.id) ?? null });
    }
    return q.rules.all(listId).map((r) => ({ ...r, discover: !!r.discover, items: items.get(r.id) ?? [] }));
  }

  // Lernstand der Person: bei Vokabeln je Wort und Richtung, bei Grammatik je Regel
  function progressOf(list, userId) {
    return list.kind === 'grammar' ? q.myRuleProgress.all(userId, list.id) : q.myProgress.all(userId, list.id);
  }

  function listDetail(list, user) {
    const isOwner = list.owner_id === user.id;
    return {
      ...listJson(list),
      is_owner: isOwner,
      owner_name: isOwner ? user.name : q.ownerName.get(list.owner_id)?.name ?? '',
      can_copy: user.isTeacher && (isOwner || !!list.shared),
      groups: isOwner ? q.listGroups.all(list.id) : undefined,
      ...(list.kind === 'grammar' ? { rules: rulesOf(list.id, user.id) } : { words: q.words.all(list.id) }),
      progress: progressOf(list, user.id),
    };
  }

  router.get('/lists/:id', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    return listDetail(list, req.user);
  }));

  // Alles zum Lernen ohne Internet: die zugewiesenen Listen mit Wörtern und eigenem Lernstand.
  // Der Browser lädt das bei jeder Verbindung (in der Schule) und lernt zu Hause damit weiter.
  router.get('/offline', wrap((req) => ({
    user: { id: req.user.id, name: req.user.name, isTeacher: req.user.isTeacher },
    lists: q.assignedLists.all(req.user.id, req.user.id).map((row) => listDetail(row, req.user)),
    at: now(),
  })));

  // Bestehende Wörter behalten ihre ID, damit der Lernstand erhalten bleibt.
  function writeWords(listId, words) {
    const existing = new Set(db.prepare('SELECT id FROM words WHERE list_id = ?').all(listId).map((r) => r.id));
    const keep = new Set();
    const update = db.prepare('UPDATE words SET pos = ?, a = ?, b = ?, note = ?, example = ? WHERE id = ? AND list_id = ?');
    const insert = db.prepare('INSERT INTO words (list_id, pos, a, b, note, example) VALUES (?, ?, ?, ?, ?, ?)');
    words.forEach((w, pos) => {
      if (w.id && existing.has(w.id) && !keep.has(w.id)) {
        update.run(pos, w.a, w.b, w.note, w.example, w.id, listId);
        keep.add(w.id);
      } else {
        insert.run(listId, pos, w.a, w.b, w.note, w.example);
      }
    });
    const remove = db.prepare('DELETE FROM words WHERE id = ?');
    for (const id of existing) if (!keep.has(id)) remove.run(id);
  }

  function writeList(listId, data) {
    const ts = now();
    db.prepare(
      `UPDATE lists SET title = ?, lang_a = ?, lang_b = ?, learn_side = ?, mode = ?, case_sensitive = ?, accent_sensitive = ?,
         direction = ?, allow_switch = ?, allow_mode_switch = ?, grade = ?, shared = ?, updated_at = ? WHERE id = ?`,
    ).run(data.title, data.lang_a, data.lang_b, data.learn_side, data.mode, data.case_sensitive, data.accent_sensitive,
      data.direction, data.allow_switch, data.allow_mode_switch, data.grade, data.shared, ts, listId);

    if (data.kind === 'grammar') writeRules(db, listId, data.rules);
    else writeWords(listId, data.words);

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
        .prepare('INSERT INTO lists (owner_id, kind, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .get(req.user.id, data.kind, data.title, ts, ts);
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
    if (data.kind !== list.kind) throw new HttpError(400, 'Die Art einer Liste (Vokabeln oder Grammatik) lässt sich nicht ändern.');
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
      rule_count: row.rule_count,
      item_count: row.item_count,
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
          `INSERT INTO lists (owner_id, kind, title, lang_a, lang_b, learn_side, mode, case_sensitive, accent_sensitive,
             direction, allow_switch, allow_mode_switch, grade, shared, copied_from, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?) RETURNING id`,
        )
        .get(req.user.id, list.kind, isOwner ? `${list.title} (Kopie)` : list.title, list.lang_a, list.lang_b, list.learn_side, list.mode,
          list.case_sensitive, list.accent_sensitive, list.direction, list.allow_switch, list.allow_mode_switch, list.grade,
          list.template ? `Vorlage: ${list.title}` : ownerName ? `${list.title} – ${ownerName}` : list.copied_from, ts, ts);
      if (list.kind === 'grammar') {
        for (const rule of q.rules.all(list.id)) {
          const copied = db
            .prepare(
              `INSERT INTO rules (list_id, pos, title, summary, explanation, discover)
               VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            )
            .get(id, rule.pos, rule.title, rule.summary, rule.explanation, rule.discover).id;
          db.prepare('INSERT INTO items (rule_id, pos, source) SELECT ?, pos, source FROM items WHERE rule_id = ? ORDER BY pos, id')
            .run(copied, rule.id);
        }
      } else {
        db.prepare(
          `INSERT INTO words (list_id, pos, a, b, note, example)
           SELECT ?, pos, a, b, note, example FROM words WHERE list_id = ? ORDER BY pos, id`,
        ).run(id, list.id);
      }
      return id;
    });
    res.status(201);
    return { id };
  }));

  // Grammatik: eine Runde einer Regel { list_id, rule_id, grade, items: [{ item_id, exercise, grade, attempts,
  // answer }], at, id }. Die Regel bekommt eine Bewertung (grade, die schlechteste der Runde), jede Aufgabe steht
  // einzeln im Verlauf – answer ist die erste falsche Antwort. Ergebnis: null (übergangen) oder { wasDue }:
  // war die Regel bis dahin (dueLimit) fällig?
  function applyRound(user, r, list, t, dueLimit) {
    const ruleId = Number(r?.rule_id);
    if (!Number.isInteger(ruleId) || !q.ruleInList.get(ruleId, list.id)) return null;
    const clientId = typeof r.id === 'string' && r.id.length <= 100 ? r.id : null;
    if (clientId && q.seenGrammarClientId.get(user.id, clientId)) return null;
    const items = (Array.isArray(r.items) ? r.items.slice(0, MAX_ROUND_ITEMS) : []).flatMap((it) => {
      if (!Object.hasOwn(GRADES, it?.grade)) return [];
      const itemId = Number(it.item_id);
      const answer = typeof it.answer === 'string' ? it.answer.trim().slice(0, 200) : '';
      return [{
        item_id: Number.isInteger(itemId) && q.itemInRule.get(itemId, ruleId) ? itemId : null,
        grade: it.grade,
        exercise: GRAMMAR_EXERCISES.includes(it.exercise) ? it.exercise : '',
        attempts: Math.min(5, Math.max(1, Math.trunc(Number(it.attempts)) || 1)),
        answer: answer || null,
      }];
    });
    const grade = Object.hasOwn(GRADES, r.grade) ? r.grade : roundGrade(items.map((i) => i.grade));
    if (!grade) return null;
    const right = items.length ? items.filter((i) => i.grade !== 'again').length : grade === 'again' ? 0 : 1;
    const wrong = items.length ? items.length - right : grade === 'again' ? 1 : 0;
    const previous = q.getRuleProgress.get(user.id, ruleId);
    const last = previous?.last_review ? Date.parse(previous.last_review) : 0;
    const ts = new Date(Math.max(t, last)).toISOString();
    const next = review(previous, grade, new Date(ts));
    q.putRuleProgress.run({ user_id: user.id, rule_id: ruleId, right, wrong, last_seen: ts, ...next });
    for (const it of items) q.logGrammar.run(user.id, ruleId, it.item_id, it.grade, it.exercise, it.attempts, it.answer, null, ts, null);
    q.logGrammar.run(user.id, ruleId, null, grade, 'round', 1, null, next.stability, ts, clientId);
    return { wasDue: !!previous?.due && previous.due <= dueLimit };
  }

  // Antworten übernehmen: { word_id, direction, grade: again|hard|good|easy, correct, exercise, at, id }
  // grade steuert die Wiederholungsplanung, correct die Zähler richtig/falsch, exercise
  // (flip|type|choice|cloze|listen) wird nur im Verlauf festgehalten.
  // Ohne Internet gegebene Antworten kommen später: at ist der Zeitpunkt der Antwort (nie in der Zukunft
  // und nie vor der letzten bekannten Antwort), id macht doppeltes Senden unschädlich.
  // listFor(result) liefert die Liste des Worts oder null (dann wird die Antwort übergangen).
  // Ergebnis: { touched: betroffene Listen, goalReached: das Tagesziel wurde heute damit erreicht,
  // badges: neu erreichte Abzeichen }
  function applyResults(user, results, listFor) {
    const nowMs = Date.now();
    const timeOf = (r) => {
      const t = Date.parse(r?.at);
      return Number.isNaN(t) || t > nowMs ? nowMs : t;
    };
    const sorted = results.map((r) => ({ r, t: timeOf(r) })).sort((x, y) => x.t - y.t);
    // Tag für Tag (aufsteigend): Was an einem Tag fällig war, hängt davon ab, was frühere Tage derselben
    // Übertragung schon verschoben oder neu angelegt haben.
    const byDay = new Map();
    for (const entry of sorted) {
      const day = localDay(entry.t, timezone);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(entry);
    }
    const touched = new Set();
    const events = { longRecall: false, errorFixed: false }; // für Abzeichen
    let goalReached = false;
    let badges = [];
    transaction(db, () => {
      const trackStreak = sorted.length > 0 && streakEnabled(user.id);
      const streakLists = trackStreak ? new Set(q.streakListIds.all({ u: user.id }).map((l) => l.id)) : null;
      for (const [day, entries] of byDay) {
        const dueLimit = isoOf(endOfDay(day, timezone));
        const dueBefore = trackStreak ? dueUntilEndOf(user.id, day) : 0;
        let answered = 0; // Antworten aus Listen mit Lernserie
        let dueAnswered = 0; // davon fällige: nur sie zählen für die Obergrenze
        const note = (list, wasDue) => {
          if (!streakLists?.has(list.id)) return;
          answered++;
          if (wasDue) dueAnswered++;
        };
        for (const { r, t } of entries) {
          const list = listFor(r);
          if (list?.kind === 'grammar') {
            const applied = applyRound(user, r, list, t, dueLimit);
            if (applied) {
              touched.add(list.id);
              note(list, applied.wasDue);
            }
            continue;
          }
          const wordId = Number(r?.word_id);
          if (!list || !Number.isInteger(wordId) || !q.wordInList.get(wordId, list.id)) continue;
          const clientId = typeof r.id === 'string' && r.id.length <= 100 ? r.id : null;
          if (clientId && q.seenClientId.get(user.id, clientId)) continue;
          const direction = r.direction === 'ba' ? 'ba' : 'ab';
          const grade = r.grade in GRADES ? r.grade : r.correct ? 'good' : 'again';
          const correct = typeof r.correct === 'boolean' ? r.correct : grade !== 'again';
          const previous = q.getProgress.get(user.id, wordId, direction);
          const last = previous?.last_review ? Date.parse(previous.last_review) : 0;
          const ts = new Date(Math.max(t, last)).toISOString();
          const next = review(previous, grade, new Date(ts));
          // Nur richtige Antworten zählen: „fast“ (hard, aber nicht richtig) ist für die App falsch
          if (streakLists?.has(list.id) && correct && grade !== 'again') {
            // „Vier Wochen nicht gesehen“ gilt für das Wort in beiden Richtungen; ein Fehler dagegen für die Richtung, in der er passierte
            const lastSeen = q.lastWordReview.get(user.id, wordId)?.at;
            if (lastSeen && Date.parse(ts) - Date.parse(lastSeen) >= LONG_RECALL_DAYS * DAY) events.longRecall = true;
            const lastLog = q.lastReview.get(user.id, wordId, direction);
            if (lastLog?.grade === 'again' && localDay(Date.parse(lastLog.at), timezone) < day) events.errorFixed = true;
          }
          q.putProgress.run({
            user_id: user.id,
            word_id: wordId,
            direction,
            right: correct ? 1 : 0,
            wrong: correct ? 0 : 1,
            last_seen: ts,
            ...next,
          });
          const exercise = EXERCISES.includes(r.exercise) ? r.exercise : '';
          q.logReview.run(user.id, wordId, direction, grade, next.stability, ts, exercise, clientId);
          touched.add(list.id);
          note(list, !!previous?.due && previous.due <= dueLimit);
        }
        if (trackStreak && answered && recordLearningDay(user.id, day, dueAnswered, dueBefore)) goalReached = true;
      }
      if (trackStreak && touched.size) badges = awardBadges(user.id, events);
    });
    return { touched, goalReached, badges };
  }

  // Ergebnisse einer Lernrunde für eine Liste
  router.post('/lists/:id/results', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    const results = Array.isArray(req.body?.results) ? req.body.results.slice(0, MAX_RESULTS) : [];
    const { goalReached, badges } = applyResults(req.user, results, () => list);
    return { progress: progressOf(list, req.user.id), streak: { ...streakSummary(req.user.id), reached: goalReached }, badges };
  }));

  // Antworten aus mehreren Listen auf einmal – so überträgt der Browser, was ohne Internet gelernt wurde.
  // Antwort: der neue Lernstand der betroffenen Listen, { progress: { <list_id>: [...] } }.
  router.post('/results', wrap((req) => {
    const results = Array.isArray(req.body?.results) ? req.body.results.slice(0, MAX_RESULTS) : [];
    const visible = new Map();
    const listFor = (r) => {
      const id = Number(r?.list_id);
      if (!visible.has(id)) {
        const list = Number.isInteger(id) ? q.list.get(id) : null;
        let ok = !!list;
        try {
          if (list) assertCanSee(list, req.user);
        } catch {
          ok = false; // z. B. nicht mehr in der Gruppe: Antwort verfällt
        }
        visible.set(id, ok ? list : null);
      }
      return visible.get(id);
    };
    const { touched, goalReached, badges } = applyResults(req.user, results, listFor);
    const progress = {};
    for (const id of touched) progress[id] = progressOf(visible.get(id), req.user.id);
    return { progress, streak: { ...streakSummary(req.user.id), reached: goalReached }, badges };
  }));

  router.delete('/lists/:id/progress', wrap((req) => {
    const list = loadList(req.params.id);
    assertCanSee(list, req.user);
    for (const table of ['progress', 'review_log']) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE list_id = ?)`)
        .run(req.user.id, list.id);
    }
    for (const table of ['rule_progress', 'grammar_log']) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND rule_id IN (SELECT id FROM rules WHERE list_id = ?)`)
        .run(req.user.id, list.id);
    }
    return { ok: true };
  }));

  // Verlauf der letzten Wochen: Anteil sicherer Wörter bzw. Regeln (Ø über die Lernenden) und Anzahl Abfragen
  // pro Woche. „Sicher“ zum Zeitpunkt T = die letzte Antwort vor T ergab Stabilität ≥ 14 Tage (bei Vokabeln in
  // einer der Richtungen). Bei Grammatik bestimmen die Runden der Regeln „sicher“, die einzelnen Aufgaben
  // zählen als Abfragen.
  function history(list, userIds, unitCount) {
    const end = Date.now();
    const points = Array.from({ length: HISTORY_WEEKS }, (_, i) => end - (HISTORY_WEEKS - 1 - i) * 7 * DAY);
    if (!userIds.length || !unitCount) {
      return points.map((t) => ({ at: new Date(t).toISOString(), safe_pct: 0, reviews: 0 }));
    }
    const users = userIds.map(() => '?').join(',');
    // counted: zählt als Abfrage, tracked: bestimmt den Stand „sicher“
    const rows = (list.kind === 'grammar'
      ? db.prepare(
          `SELECT user_id, rule_id AS unit_id, '' AS direction, stability, stability IS NULL AS counted,
             stability IS NOT NULL AS tracked, at
           FROM grammar_log WHERE rule_id IN (SELECT id FROM rules WHERE list_id = ?) AND user_id IN (${users}) ORDER BY at`,
        )
      : db.prepare(
          `SELECT user_id, word_id AS unit_id, direction, stability, grade != 'import' AS counted, 1 AS tracked, at
           FROM review_log WHERE word_id IN (SELECT id FROM words WHERE list_id = ?) AND user_id IN (${users}) ORDER BY at`,
        )
    ).all(list.id, ...userIds);
    const latest = new Map(); // user:einheit:richtung -> letzte Antwort
    let i = 0;
    return points.map((t) => {
      let reviews = 0;
      while (i < rows.length && Date.parse(rows[i].at) <= t) {
        const r = rows[i++];
        if (r.tracked) latest.set(`${r.user_id}:${r.unit_id}:${r.direction}`, r);
        if (r.counted && Date.parse(r.at) > t - 7 * DAY) reviews++;
      }
      const safeUnits = new Map(userIds.map((id) => [id, new Set()]));
      for (const r of latest.values()) {
        if (levelFor(r.stability) >= SAFE_LEVEL) safeUnits.get(r.user_id)?.add(r.unit_id);
      }
      const avg = [...safeUnits.values()].reduce((sum, set) => sum + set.size / unitCount, 0) / userIds.length;
      return { at: new Date(t).toISOString(), safe_pct: Math.round(avg * 1000) / 10, reviews };
    });
  }

  // Übersicht für die Lehrkraft: Lernstand aller Schüler:innen der zugewiesenen Gruppen.
  router.get('/lists/:id/stats', wrap((req) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    const grammar = list.kind === 'grammar';
    const n = (grammar ? q.ruleCount : q.wordCount).get(list.id).n;
    const nowIso = now();
    const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
    // Je Schüler:in: geübt, sicher, fällig, richtig/falsch – bei Grammatik je Regel, sonst je Wort
    const studentsSql = grammar
      ? `SELECT u.id, u.name,
           COUNT(p.rule_id) AS seen,
           COUNT(CASE WHEN p.box >= ${SAFE_BOX} THEN 1 END) AS safe,
           COUNT(CASE WHEN p.due <= ? THEN 1 END) AS due,
           COALESCE(SUM(p.right), 0) AS right, COALESCE(SUM(p.wrong), 0) AS wrong,
           MAX(p.last_seen) AS last_seen
         FROM user_groups ug
         JOIN users u ON u.id = ug.user_id AND u.is_teacher = 0
         LEFT JOIN rule_progress p ON p.user_id = u.id AND p.rule_id IN (SELECT id FROM rules WHERE list_id = ?)
         WHERE ug.group_id = ?
         GROUP BY u.id ORDER BY u.name COLLATE NOCASE`
      : `SELECT u.id, u.name,
           COUNT(DISTINCT p.word_id) AS seen,
           COUNT(DISTINCT CASE WHEN p.box >= ${SAFE_BOX} THEN p.word_id END) AS safe,
           COUNT(CASE WHEN p.due <= ? THEN 1 END) AS due,
           COALESCE(SUM(p.right), 0) AS right, COALESCE(SUM(p.wrong), 0) AS wrong,
           MAX(p.last_seen) AS last_seen
         FROM user_groups ug
         JOIN users u ON u.id = ug.user_id AND u.is_teacher = 0
         LEFT JOIN progress p ON p.user_id = u.id AND p.word_id IN (SELECT id FROM words WHERE list_id = ?)
         WHERE ug.group_id = ?
         GROUP BY u.id ORDER BY u.name COLLATE NOCASE`;
    const groups = q.listGroups.all(list.id).map((g) => {
      const students = db.prepare(studentsSql).all(nowIso, list.id, g.id);
      const count = students.length;
      const avg = (field) =>
        count && n ? Math.round((students.reduce((sum, st) => sum + st[field] / n, 0) / count) * 1000) / 10 : 0;
      const summary = {
        students: count,
        active_7d: students.filter((st) => st.last_seen && st.last_seen >= weekAgo).length,
        safe_pct: avg('safe'),
        seen_pct: avg('seen'),
        due: students.reduce((sum, st) => sum + st.due, 0),
      };
      return { ...g, summary, history: history(list, students.map((st) => st.id), n), students };
    });
    if (grammar) {
      // Schwierigste Regeln und häufigste Fehler: nur Anzahlen je Antwort, ohne Namen
      const hardest = db
        .prepare(
          `SELECT r.id, r.title, SUM(p.right) AS right, SUM(p.wrong) AS wrong
           FROM rule_progress p JOIN rules r ON r.id = p.rule_id
           JOIN users u ON u.id = p.user_id AND u.is_teacher = 0
           WHERE r.list_id = ? GROUP BY r.id HAVING SUM(p.wrong) > 0
           ORDER BY CAST(SUM(p.wrong) AS REAL) / (SUM(p.right) + SUM(p.wrong)) DESC, SUM(p.wrong) DESC
           LIMIT 10`,
        )
        .all(list.id);
      const errors = db
        .prepare(
          `SELECT g.item_id, r.id AS rule_id, r.title AS rule_title, i.source, MIN(g.answer) AS answer, COUNT(*) AS count
           FROM grammar_log g JOIN items i ON i.id = g.item_id JOIN rules r ON r.id = g.rule_id
           JOIN users u ON u.id = g.user_id AND u.is_teacher = 0
           WHERE r.list_id = ? AND g.answer IS NOT NULL
           GROUP BY g.item_id, unicode_lower(g.answer) ORDER BY count DESC, g.item_id LIMIT ${MAX_ERRORS}`,
        )
        .all(list.id);
      return { list: listJson(list), rule_count: n, safe_box: SAFE_BOX, groups, hardest, errors };
    }
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
    return { list: listJson(list), word_count: n, safe_box: SAFE_BOX, groups, hardest };
  }));

  // Einzelansicht: Lernstand einer Schülerin / eines Schülers pro Wort und Richtung (Grammatik: pro Regel,
  // dazu ihre falschen Antworten).
  router.get('/lists/:id/stats/students/:uid', wrap((req) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    const student = db
      .prepare(
        `SELECT DISTINCT u.id, u.name FROM users u
         JOIN user_groups ug ON ug.user_id = u.id
         JOIN list_groups lg ON lg.group_id = ug.group_id AND lg.list_id = ?
         WHERE u.id = ? AND u.is_teacher = 0`,
      )
      .get(list.id, Number(req.params.uid));
    if (!student) throw new HttpError(404, 'Diese Person ist keiner Gruppe der Liste zugeordnet.');
    if (list.kind === 'grammar') {
      const progress = new Map(q.myRuleProgress.all(student.id, list.id).map((p) => [p.rule_id, p]));
      const rules = q.rules.all(list.id).map((r) => ({ id: r.id, title: r.title, progress: progress.get(r.id) ?? null }));
      const errors = db
        .prepare(
          `SELECT g.item_id, r.title AS rule_title, i.source, g.answer, g.exercise, g.attempts, g.grade, g.at
           FROM grammar_log g JOIN rules r ON r.id = g.rule_id LEFT JOIN items i ON i.id = g.item_id
           WHERE g.user_id = ? AND r.list_id = ? AND g.answer IS NOT NULL ORDER BY g.at DESC LIMIT ${MAX_ERRORS}`,
        )
        .all(student.id, list.id);
      return { list: listJson(list), student, safe_box: SAFE_BOX, rules, errors, history: history(list, [student.id], rules.length) };
    }
    const words = q.words.all(list.id);
    const progress = db
      .prepare(
        `SELECT word_id, direction, box, right, wrong, last_seen, due, stability FROM progress
         WHERE user_id = ? AND word_id IN (SELECT id FROM words WHERE list_id = ?)`,
      )
      .all(student.id, list.id);
    const byWord = new Map(words.map((w) => [w.id, { ...w, ab: null, ba: null }]));
    for (const p of progress) byWord.get(p.word_id)[p.direction] = p;
    return {
      list: listJson(list),
      student,
      safe_box: SAFE_BOX,
      words: [...byWord.values()],
      history: history(list, [student.id], words.length),
    };
  }));

  // Häufiger Fehler → Hinweis für genau diese falsche Antwort anlegen („! Antwort = Hinweis“ unter der Aufgabe)
  router.post('/lists/:id/feedback', wrap((req) => {
    requireTeacher(req);
    const list = loadList(req.params.id);
    assertOwner(list, req.user);
    if (list.kind !== 'grammar') throw new HttpError(400, 'Nur für Grammatiklisten.');
    const item = db
      .prepare('SELECT i.id, i.source FROM items i JOIN rules r ON r.id = i.rule_id WHERE i.id = ? AND r.list_id = ?')
      .get(Number(req.body?.item_id), list.id);
    if (!item) throw new HttpError(404, 'Aufgabe nicht gefunden.');
    const answer = text(req.body?.answer, 200, 'Antwort').replace(/\s+/g, ' ');
    const hint = text(req.body?.text, 300, 'Hinweis').replace(/\s+/g, ' ');
    if (!answer || !hint) throw new HttpError(400, 'Bitte die Antwort und einen Hinweis angeben.');
    if (/[|=]/.test(answer)) {
      throw new HttpError(400, 'Die Antwort enthält „|“ oder „=“ und lässt sich so nicht als Hinweis anlegen – bitte im Editor eintragen.');
    }
    const [task, ...rest] = item.source.split('\n');
    const line = `! ${answer} = ${hint}`;
    const same = (l) => l.startsWith('!') && l.includes('=') && l.slice(1, l.indexOf('=')).trim().toLowerCase() === answer.toLowerCase();
    const lines = rest.some(same) ? rest.map((l) => (same(l) ? line : l)) : [...rest, line];
    const source = [task, ...lines].join('\n');
    const parsed = parseItem(source);
    if (parsed.error) throw new HttpError(400, parsed.error);
    transaction(db, () => {
      db.prepare('UPDATE items SET source = ? WHERE id = ?').run(source, item.id);
      db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now(), list.id);
    });
    return { source };
  }));

  router.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ungültiges JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Die Liste ist zu groß.' });
    next(err);
  });

  return router;
}
