import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Die Oberfläche läuft ohne Build-Schritt. Fehler in der Verdrahtung der Module (Tippfehler im Namen, vergessener
// Export, Syntaxfehler) zeigen sich sonst erst im Browser – hier fallen sie schon in der CI auf.
const publicDir = new URL('../public/', import.meta.url);
const modules = readdirSync(publicDir).filter((f) => f.endsWith('.js') && f !== 'sw.js' && f !== 'theme.js');

const source = (file) => readFileSync(new URL(file, publicDir), 'utf8');

test('alle Module der Oberfläche sind gültiges JavaScript', () => {
  for (const file of [...modules, 'sw.js', 'theme.js']) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(file, publicDir))], { stdio: 'pipe' });
  }
});

// Namen eines Moduls, die es exportiert
function exportsOf(file) {
  const text = source(file);
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(',')) names.add(n.trim().split(/\s+as\s+/).pop());
  return names;
}

test('jeder importierte Name wird vom Modul auch exportiert', () => {
  let imports = 0;
  for (const file of modules) {
    const text = source(file);
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+\.js)'/g)) {
      const target = m[2];
      const available = exportsOf(target);
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0];
        if (!name) continue;
        imports++;
        assert.ok(available.has(name), `${file} importiert „${name}“, aber ${target} exportiert das nicht`);
      }
    }
  }
  assert.ok(imports > 50, `geprüfte Imports: ${imports}`);
});

// Wie oft kommt der Name als eigenes Wort vor (nicht als Teil von „foobar“ oder als Eigenschaft „x.foo“)?
function countUses(text, name) {
  const escaped = name.replace(/[$]/g, String.raw`\$`);
  return (text.match(new RegExp(String.raw`(?<![\w$.])${escaped}(?![\w$])`, 'g')) ?? []).length;
}

test('Wortgrenzen beim Zählen der Verwendungen', () => {
  assert.equal(countUses('import { foo } from "x"; foobar(); barfoo(); x.foo(); $foo;', 'foo'), 1, 'nur der Import');
  assert.equal(countUses('import { foo } from "x"; foo(); foo.bar;', 'foo'), 3);
  assert.equal(countUses('const a = 1;', 'foo'), 0);
});

test('importierte Namen werden im Modul auch benutzt (keine toten Imports)', () => {
  for (const file of modules) {
    const text = source(file);
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/[\w-]+\.js'/g)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/).pop();
        if (!name) continue;
        assert.ok(countUses(text, name) > 1, `${file} importiert „${name}“, benutzt es aber nicht`);
      }
    }
  }
});
