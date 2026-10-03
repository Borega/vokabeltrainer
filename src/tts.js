// Aussprache mit eigenen Stimmen: holt das Audio vom Piper-Dienst (TTS_URL) und legt jede Datei einmal unter
// DATA_DIR/tts ab. Der Text verlässt die Schulinfrastruktur nicht; ein Wort wird nur beim ersten Abspielen erzeugt.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MAX_CHARS = 300;
// Länger als 1 = langsamer: zum Lernen der Aussprache etwas gemächlicher als normal (Teil des Cache-Schlüssels)
const LENGTH_SCALE = 1.1;
// Neu zu erzeugende Texte pro Person und Minute – Schutz vor Schleifen und böswilligem Füllen des Speichers
const MISSES_PER_MINUTE = 30;

export function ttsHandler(cfg) {
  const { url, voices, cacheMb } = cfg.tts ?? {};
  if (!url) return (req, res) => res.status(404).json({ error: 'Keine Sprachausgabe eingerichtet.' });

  const dir = resolve(cfg.dataDir, 'tts');
  mkdirSync(dir, { recursive: true });
  let bytes = 0;
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.tmp')) unlinkSync(join(dir, f));
    else bytes += statSync(join(dir, f)).size;
  }

  // Piper erzeugt immer nur ein Audio zur Zeit sinnvoll schnell: hintereinander abarbeiten,
  // gleiche Anfragen gleichzeitig nur einmal.
  let queue = Promise.resolve();
  const inflight = new Map();
  const synthesize = (key, voice, text) => {
    if (!inflight.has(key)) {
      const job = queue.then(async () => {
        const res = await fetch(`${url}/synthesize`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, voice, length_scale: LENGTH_SCALE }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`Piper antwortet mit ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      });
      queue = job.catch(() => {});
      const done = () => inflight.delete(key);
      job.then(done, done);
      inflight.set(key, job);
    }
    return inflight.get(key);
  };

  const misses = new Map(); // Person → { start, count }
  const allowed = (userId) => {
    const now = Date.now();
    const m = misses.get(userId);
    if (!m || now - m.start > 60000) { misses.set(userId, { start: now, count: 1 }); return true; }
    return ++m.count <= MISSES_PER_MINUTE;
  };

  return async (req, res) => {
    const voice = String(req.query.voice ?? '');
    const text = String(req.query.text ?? '').normalize('NFC').trim();
    if (!voices.includes(voice) || !text || text.length > MAX_CHARS) {
      return res.status(400).json({ error: 'Ungültige Anfrage.' });
    }
    const key = createHash('sha256').update(`${voice}\n${LENGTH_SCALE}\n${text}`).digest('hex');
    const file = join(dir, `${key}.wav`);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    if (existsSync(file)) return res.sendFile(file);

    if (!allowed(req.user.id)) return res.status(429).json({ error: 'Zu viele neue Wörter auf einmal.' });
    let wav;
    try {
      wav = await synthesize(key, voice, text);
    } catch (err) {
      console.error('Sprachausgabe:', err.message);
      res.removeHeader('Cache-Control');
      return res.status(502).json({ error: 'Sprachausgabe nicht erreichbar.' });
    }
    if (bytes + wav.length > cacheMb * 1e6) return res.type('audio/wav').send(wav);
    // Erst unter anderem Namen schreiben: Eine halbe Datei darf nie als fertig gelten.
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, wav);
    if (!existsSync(file)) bytes += wav.length;
    renameSync(tmp, file);
    res.sendFile(file);
  };
}
