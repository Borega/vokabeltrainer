// Aussprache mit eigenen Stimmen: holt das Audio vom Piper-Dienst (TTS_URL) und legt jede Datei einmal unter
// DATA_DIR/tts ab. Der Text verlässt die Schulinfrastruktur nicht. Ein Wort wird beim ersten Abspielen erzeugt
// oder vorab durch die nächtliche Vorbereitung (tts-prewarm.js).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const MAX_CHARS = 300;
// Länger als 1 = langsamer: zum Lernen der Aussprache etwas gemächlicher als normal (Teil des Cache-Schlüssels)
const LENGTH_SCALE = 1.1;
// Neu zu erzeugende Texte pro Person und Minute – Schutz vor Schleifen und böswilligem Füllen des Speichers
const MISSES_PER_MINUTE = 30;

const clean = (text) => String(text ?? '').normalize('NFC').trim();

function createTts(cfg) {
  const { url, voices, cacheMb } = cfg.tts ?? {};
  if (!url) {
    return { enabled: false, handler: (req, res) => res.status(404).json({ error: 'Keine Sprachausgabe eingerichtet.' }) };
  }

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

  // Liefert { file } (liegt im Speicher), { wav } (Speicher voll, nur diesmal) oder { limited } (beforeMiss sagte nein).
  // created: die Datei wurde gerade erst erzeugt. beforeMiss wird nur aufgerufen, wenn Piper gebraucht wird.
  async function ensure(voice, rawText, beforeMiss) {
    const text = clean(rawText);
    const key = createHash('sha256').update(`${voice}\n${LENGTH_SCALE}\n${text}`).digest('hex');
    const file = join(dir, `${key}.wav`);
    if (existsSync(file)) return { file, created: false };
    if (beforeMiss && !beforeMiss()) return { limited: true };
    const wav = await synthesize(key, voice, text);
    if (bytes + wav.length > cacheMb * 1e6) return { wav, full: true };
    // Erst unter anderem Namen schreiben: Eine halbe Datei darf nie als fertig gelten.
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, wav);
    const created = !existsSync(file);
    if (created) bytes += wav.length;
    renameSync(tmp, file);
    return { file, created };
  }

  const misses = new Map(); // Person → { start, count }
  const allowed = (userId) => {
    const now = Date.now();
    const m = misses.get(userId);
    if (!m || now - m.start > 60000) { misses.set(userId, { start: now, count: 1 }); return true; }
    return ++m.count <= MISSES_PER_MINUTE;
  };

  async function handler(req, res) {
    const voice = String(req.query.voice ?? '');
    const text = clean(req.query.text);
    if (!voices.includes(voice) || !text || text.length > MAX_CHARS) {
      return res.status(400).json({ error: 'Ungültige Anfrage.' });
    }
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    let result;
    try {
      result = await ensure(voice, text, () => allowed(req.user.id));
    } catch (err) {
      console.error('Sprachausgabe:', err.message);
      res.removeHeader('Cache-Control');
      return res.status(502).json({ error: 'Sprachausgabe nicht erreichbar.' });
    }
    if (result.limited) {
      res.removeHeader('Cache-Control');
      return res.status(429).json({ error: 'Zu viele neue Wörter auf einmal.' });
    }
    if (result.wav) return res.type('audio/wav').send(result.wav);
    res.sendFile(result.file);
  }

  return { enabled: true, handler, ensure };
}

// Eine Instanz je Konfiguration: Route und nächtliche Vorbereitung teilen sich Warteschlange und Speicherstand.
const instances = new WeakMap();
export function ttsFor(cfg) {
  if (!instances.has(cfg)) instances.set(cfg, createTts(cfg));
  return instances.get(cfg);
}
