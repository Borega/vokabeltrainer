// Aussprache vorab erzeugen: alle Texte, die die Oberfläche vorlesen kann, für alle passenden Stimmen. Läuft nachts
// (siehe server.js); danach kommt auch das erste Abspielen eines Worts sofort aus dem Speicher.
import { isGermanLabel, learnSide, speechLang, speechText } from '../public/exercises.js';
import { parseItem, solutionText } from '../public/grammar.js';
import { matchVoices } from '../public/speech.js';
import { MAX_CHARS, ttsFor } from './tts.js';

// Alle Aufgaben { voice, text } nach denselben Regeln wie die Oberfläche (app.js: speakBtn/autoSpeak, grammar-learn.js).
// Die Oberfläche wählt zufällig unter den passenden Stimmen, also braucht jede Stimme ihre Datei.
export function spokenTexts(db, voiceNames) {
  const voices = voiceNames.map((name) => ({ name, lang: name.split('-')[0] }));
  const jobs = new Map();
  const add = (lang, text) => {
    if (!lang || !text || text.length > MAX_CHARS) return;
    for (const v of matchVoices(voices, lang)) jobs.set(`${v.name}\n${text}`, { voice: v.name, text });
  };
  const words = db.prepare('SELECT a, b FROM words WHERE list_id = ?');
  const items = db.prepare('SELECT i.source FROM items i JOIN rules r ON r.id = i.rule_id WHERE r.list_id = ?');
  for (const list of db.prepare('SELECT id, lang_a, lang_b, learn_side FROM lists').all()) {
    const learned = learnSide(list);
    for (const side of ['a', 'b']) {
      const label = list[`lang_${side}`];
      // Die deutsche Seite wird nicht vorgelesen, wenn Deutsch nicht gelernt wird (Englisch ↔ Deutsch)
      if (side !== learned && isGermanLabel(label)) continue;
      for (const w of words.all(list.id)) add(speechLang(label), speechText(w[side]));
    }
    // Grammatik: der ganze richtige Satz in der Sprache der Liste
    for (const { source } of items.all(list.id)) {
      const item = parseItem(source);
      if (!item.error) add(speechLang(list.lang_a), solutionText(item));
    }
  }
  return [...jobs.values()];
}

export async function prewarm(db, cfg, log = console) {
  const tts = ttsFor(cfg);
  if (!tts.enabled) return null;
  const jobs = spokenTexts(db, cfg.tts.voices);
  const stats = { total: jobs.length, created: 0, stopped: null };
  for (const { voice, text } of jobs) {
    try {
      const r = await tts.ensure(voice, text);
      if (r.created) stats.created++;
      if (r.full) { stats.stopped = 'Speicher voll (TTS_CACHE_MB)'; break; }
    } catch (err) {
      // Piper nicht erreichbar: nicht jeden Text einzeln versuchen, der nächste Lauf holt es nach
      stats.stopped = err.message;
      break;
    }
  }
  if (stats.created || stats.stopped) {
    log.log(`Aussprache vorab: ${stats.created} neu erzeugt von ${stats.total} Texten${stats.stopped ? `, abgebrochen: ${stats.stopped}` : ''}.`);
  }
  return stats;
}

// Einmal kurz nach dem Start, danach jede Nacht zur Stunde TTS_PREWARM_HOUR (Zeitzone der Schule); -1 schaltet ab.
export function schedulePrewarm(db, cfg) {
  const hour = cfg.tts.prewarmHour;
  if (!cfg.tts.url || !(hour >= 0 && hour <= 23)) return;
  const hourNow = () => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: cfg.timezone }).format(new Date()));
  let last = 0;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    last = Date.now();
    try { await prewarm(db, cfg); } catch (err) { console.error('Aussprache vorab:', err); } finally { running = false; }
  };
  setTimeout(run, 2 * 60 * 1000).unref(); // Piper lädt beim ersten Start evtl. noch Stimmen: dann holt die Nacht es nach
  setInterval(() => { if (hourNow() === hour && Date.now() - last > 20 * 3600 * 1000) run(); }, 10 * 60 * 1000).unref();
}
