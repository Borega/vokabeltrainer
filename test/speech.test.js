import assert from 'node:assert/strict';
import { test } from 'node:test';

// Sprachausgabe des Browsers nachbilden: typische iPad-Stimmen, dazu eine Online-Stimme
const voices = [
  { lang: 'fr-CA', name: 'Amélie', localService: true },
  { lang: 'es-MX', name: 'Paulina', localService: true },
  { lang: 'en-US', name: 'Samantha', localService: true },
  { lang: 'fr-FR', name: 'Google français', localService: false },
];
globalThis.speechSynthesis = { getVoices: () => voices };
const { canSpeak, setServerVoices, speak, stopSpeaking, voicesFor } = await import('../public/speech.js');
const names = (lang) => voicesFor(lang).map((v) => v.name);

test('Französisch und Spanisch nur mit europäischer Stimme', () => {
  assert.deepEqual(names('fr-FR'), [], 'keine kanadische Ersatzstimme, keine Online-Stimme');
  assert.deepEqual(names('es-ES'), [], 'keine lateinamerikanische Ersatzstimme');
  voices.push({ lang: 'fr_FR', name: 'Thomas', localService: true }, { lang: 'es-ES', name: 'Mónica', localService: true });
  assert.deepEqual(names('fr-FR'), ['Thomas']);
  assert.deepEqual(names('es-ES'), ['Mónica']);
});

test('andere Sprachen dürfen auf eine andere Region ausweichen', () => {
  assert.deepEqual(names('en-GB'), ['Samantha']);
});

test('Stimmen des Servers: Sprache aus dem Namen, Region wie bei den Stimmen des Geräts', () => {
  voices.length = 0;
  assert.equal(canSpeak('de-DE'), false);
  setServerVoices(['de_DE-thorsten-high', 'en_US-kristin-medium']);
  assert.equal(canSpeak('de-DE'), true);
  assert.equal(canSpeak('en-GB'), true, 'Englisch darf auf eine andere Region ausweichen');
  assert.equal(canSpeak('fr-FR'), false);
  setServerVoices(['fr_CA-siwis-medium']);
  assert.equal(canSpeak('fr-FR'), false, 'keine kanadische Stimme für Französisch');
  setServerVoices([]);
  assert.equal(canSpeak('de-DE'), false);
});

test('mit Server-Stimme wird die Audiodatei des Servers abgespielt, bei einem Fehler die Stimme des Geräts', () => {
  const played = [];
  const spoken = [];
  const handlers = {};
  globalThis.Audio = class {
    constructor(src) { played.push(src); this.src = src; }
    addEventListener(type, fn) { handlers[type] = fn; }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.speechSynthesis.cancel = () => {};
  globalThis.speechSynthesis.speak = (u) => spoken.push(u.text);
  voices.push({ lang: 'de-DE', name: 'Anna', localService: true });

  setServerVoices(['de_DE-thorsten-high']);
  assert.equal(speak('das Haus', 'de-DE'), true);
  assert.equal(played.length, 1);
  const url = new URL(played[0], 'http://x');
  assert.equal(url.pathname, '/api/tts');
  assert.equal(url.searchParams.get('voice'), 'de_DE-thorsten-high');
  assert.equal(url.searchParams.get('text'), 'das Haus');
  assert.deepEqual(spoken, []);

  handlers.error();
  assert.deepEqual(spoken, ['das Haus'], 'Server nicht erreichbar: Stimme des Geräts');

  speak('das Auto', 'de-DE');
  stopSpeaking();
  handlers.error();
  assert.deepEqual(spoken, ['das Haus'], 'nach dem Stoppen kein Nachsprechen');
  setServerVoices([]);
});
