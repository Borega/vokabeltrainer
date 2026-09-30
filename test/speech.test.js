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
const { voicesFor } = await import('../public/speech.js');
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
