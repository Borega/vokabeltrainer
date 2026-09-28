// Aussprache über die Sprachausgabe des Browsers (Web Speech API).
// Es werden nur Stimmen verwendet, die auf dem Gerät selbst laufen (localService): Online-Stimmen
// würden den Text an den Anbieter (z. B. Google) schicken – das soll an Schulen nicht passieren.
// Wechselnde Stimmen helfen beim Lernen der Aussprache (Barcroft & Sommers 2005).

const synth = globalThis.speechSynthesis;

const norm = (lang) => lang.replace('_', '-').toLowerCase();

export function voicesFor(lang) {
  if (!synth || !lang) return [];
  const local = synth.getVoices().filter((v) => v.localService);
  const exact = local.filter((v) => norm(v.lang) === norm(lang));
  if (exact.length) return exact;
  const base = norm(lang).split('-')[0];
  return local.filter((v) => norm(v.lang).split('-')[0] === base);
}

export function canSpeak(lang) {
  return voicesFor(lang).length > 0;
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

export function speak(text, lang) {
  const voices = voicesFor(lang);
  if (!voices.length || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices[Math.floor(Math.random() * voices.length)];
  u.lang = u.voice.lang;
  u.rate = 0.9;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  synth?.cancel();
}
