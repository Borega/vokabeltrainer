import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterLists, gradeLabel, languagesOf, sortLists } from '../public/listfilter.js';

const lists = [
  { title: 'Unit 10', lang_a: 'Englisch', lang_b: 'Deutsch', grade: 7, owner_name: 'Frau A', updated_at: '2026-09-01' },
  { title: 'Unité 2', lang_a: 'Französisch', lang_b: 'Deutsch', grade: 6, owner_name: 'Herr B', updated_at: '2026-09-20' },
  { title: 'Unit 2', lang_a: 'englisch ', lang_b: 'Deutsch', grade: 5, owner_name: 'Frau C', updated_at: '2026-09-10' },
  { title: 'Unidad 1', lang_a: 'Spanisch', lang_b: 'Deutsch', grade: null, owner_name: 'Frau D', updated_at: '2026-09-15' },
];
const titles = (ls) => ls.map((l) => l.title);

test('Sprachen für die Auswahl: häufigste zuerst, ohne Deutsch, Schreibweise egal', () => {
  assert.deepEqual(languagesOf(lists), [
    { value: 'englisch', label: 'Englisch' },
    { value: 'französisch', label: 'Französisch' },
    { value: 'spanisch', label: 'Spanisch' },
  ]);
  // Gemerkter Wert passt, auch wenn sich die Schreibweise der ersten Liste ändert
  assert.equal(filterLists(lists, { lang: 'englisch' }).length, 2);
});

test('Jede Liste zählt pro Sprache nur einmal', () => {
  const ls = [
    { lang_a: 'Englisch', lang_b: 'englisch' },
    { lang_a: 'Latein', lang_b: 'Deutsch' },
    { lang_a: 'Latein', lang_b: 'Deutsch' },
  ];
  assert.deepEqual(languagesOf(ls).map((l) => l.label), ['Latein', 'Englisch']);
});

test('Filtern nach Sprache, Jahrgang und Suchtext', () => {
  assert.deepEqual(titles(filterLists(lists, { lang: 'Englisch' })), ['Unit 10', 'Unit 2']);
  assert.deepEqual(titles(filterLists(lists, { grade: '6' })), ['Unité 2']);
  assert.deepEqual(titles(filterLists(lists, { grade: 'none' })), ['Unidad 1']);
  assert.deepEqual(titles(filterLists(lists, { lang: 'Englisch', grade: '5' })), ['Unit 2']);
  assert.deepEqual(titles(filterLists(lists, { q: 'frau d' })), ['Unidad 1']);
  assert.equal(filterLists(lists, {}).length, 4);
});

test('Sortieren: zuletzt geändert, Jahrgang (ohne Angabe zuletzt), Titel mit Zahlen', () => {
  assert.deepEqual(titles(sortLists(lists, 'recent')), ['Unité 2', 'Unidad 1', 'Unit 2', 'Unit 10']);
  assert.deepEqual(titles(sortLists(lists, 'grade')), ['Unit 2', 'Unité 2', 'Unit 10', 'Unidad 1']);
  assert.deepEqual(titles(sortLists(lists, 'title')), ['Unidad 1', 'Unit 2', 'Unit 10', 'Unité 2']);
  assert.equal(lists[0].title, 'Unit 10', 'Original bleibt unverändert');
});

test('Bezeichnung des Jahrgangs', () => {
  assert.equal(gradeLabel(7), 'Jahrgang 7');
  assert.equal(gradeLabel(null), 'ohne Jahrgang');
});

test('Filter nach Art: Vokabeln oder Grammatik (ältere Einträge ohne kind sind Vokabeln)', () => {
  const mixed = [
    { title: 'A', lang_a: 'Englisch', lang_b: 'Deutsch', grade: 7 },
    { title: 'B', kind: 'vocab', lang_a: 'Englisch', lang_b: 'Deutsch', grade: 7 },
    { title: 'C', kind: 'grammar', lang_a: 'Englisch', lang_b: '', grade: 7 },
    { title: 'D', kind: 'grammar', lang_a: 'Französisch', lang_b: '', grade: 8 },
  ];
  assert.deepEqual(titles(filterLists(mixed, { kind: 'grammar' })), ['C', 'D']);
  assert.deepEqual(titles(filterLists(mixed, { kind: 'vocab' })), ['A', 'B']);
  assert.equal(filterLists(mixed, { kind: '' }).length, 4);
  assert.deepEqual(titles(filterLists(mixed, { kind: 'grammar', lang: 'englisch' })), ['C']);
  assert.deepEqual(languagesOf(mixed.filter((l) => l.kind === 'grammar')).map((l) => l.label), ['Englisch', 'Französisch'], 'leere zweite Sprache stört nicht');
});
