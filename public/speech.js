// Aussprache. Bevorzugt die eigenen Stimmen des Servers (Piper, siehe README): Der Text bleibt in der Schule und
// klingt besser als die Stimmen der Geräte. Ohne Server-Stimme oder ohne Verbindung spricht die Sprachausgabe
// des Browsers (Web Speech API) – dort nur Stimmen, die auf dem Gerät selbst laufen (localService): Online-Stimmen
// würden den Text an den Anbieter (z. B. Google) schicken – das soll an Schulen nicht passieren.
// Wechselnde Stimmen helfen beim Lernen der Aussprache (Barcroft & Sommers 2005).

const synth = globalThis.speechSynthesis;

const norm = (lang) => lang.replace('_', '-').toLowerCase();

// Nur Stimmen genau dieser Region – keine kanadische Stimme für Französisch, keine lateinamerikanische für
// Spanisch. Ohne passende Stimme gibt es dann keinen Ton.
const STRICT = new Set(['fr-fr', 'es-es']);

// Stimmen (Liste von { lang }) für eine Sprache: genau die Region, sonst dieselbe Sprache
function matching(voices, lang) {
  const exact = voices.filter((v) => norm(v.lang) === norm(lang));
  if (exact.length || STRICT.has(norm(lang))) return exact;
  const base = norm(lang).split('-')[0];
  return voices.filter((v) => norm(v.lang).split('-')[0] === base);
}

// Stimmen des Servers (Namen wie de_DE-thorsten-high aus /config.json); die Sprache steht vor dem ersten „-“
let serverVoices = [];
export function setServerVoices(names = []) {
  serverVoices = names.map((name) => ({ name, lang: name.split('-')[0] }));
}

export function voicesFor(lang) {
  if (!synth || !lang) return [];
  return matching(synth.getVoices().filter((v) => v.localService), lang);
}

export function canSpeak(lang) {
  return !!lang && (matching(serverVoices, lang).length > 0 || voicesFor(lang).length > 0);
}

// Manche Browser laden die Stimmen erst nach und nach.
export function voicesReady(timeout = 1500) {
  if (!synth) return Promise.resolve();
  if (synth.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); resolve(); };
    synth.addEventListener?.('voiceschanged', done);
    setTimeout(done, timeout);
  });
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function speakInBrowser(text, lang) {
  const voices = voicesFor(lang);
  if (!voices.length || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pick(voices);
  u.lang = u.voice.lang;
  u.rate = 0.9;
  synth.speak(u);
  return true;
}

let audio = null;

export function speak(text, lang) {
  if (!text || !lang) return false;
  const remote = matching(serverVoices, lang);
  if (!remote.length) return speakInBrowser(text, lang);
  stopSpeaking();
  // Die Adresse direkt als Quelle: So zählt der Klick noch als Nutzeraktion (iPad), und der Browser behält die Datei.
  audio = new Audio(`/api/tts?${new URLSearchParams({ voice: pick(remote).name, text })}`);
  const current = audio;
  // Server nicht erreichbar (z. B. ohne Internet): mit der Stimme des Geräts weiter
  current.addEventListener('error', () => { if (audio === current) speakInBrowser(text, lang); });
  current.play().catch(() => {});
  return true;
}

export function stopSpeaking() {
  synth?.cancel();
  if (audio) { audio.pause(); audio = null; }
}
