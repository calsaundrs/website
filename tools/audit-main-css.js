#!/usr/bin/env node
// One-shot audit: which class selectors in css/main.css aren't referenced
// anywhere in the project's HTML/JS source? Conservative — won't catch
// classes built by string concatenation, but flags the obvious dead code.
// Delete this script after the prune.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');

// Strip comments to avoid false positives.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

const classes = new Set();
const re = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
let m;
while ((m = re.exec(stripped))) classes.add(m[1]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(html|js|jsx|ts|tsx|hbs)$/.test(entry.name)) yield full;
  }
}

const files = [...walk(ROOT)].filter((f) =>
  !f.includes(path.join(ROOT, 'css/main.css')) &&
  !f.includes(path.join(ROOT, 'tests/.auth')) &&
  !f.includes(path.join(ROOT, 'tools/audit-main-css.js'))
);
const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const usage = new Map();
for (const cls of classes) {
  const escaped = cls.replace(/[-]/g, '\\-');
  const wordBoundary = new RegExp(`(?:^|[^a-zA-Z0-9_-])${escaped}(?:$|[^a-zA-Z0-9_-])`);
  const occurrences = (corpus.match(new RegExp(`(?:^|[^a-zA-Z0-9_-])${escaped}(?:$|[^a-zA-Z0-9_-])`, 'g')) || []).length;
  usage.set(cls, occurrences);
}

const unused = [...usage.entries()].filter(([, n]) => n === 0).map(([c]) => c).sort();
const onceUsed = [...usage.entries()].filter(([, n]) => n === 1).map(([c]) => c).sort();

console.log(`Total classes in main.css: ${classes.size}`);
console.log(`Files scanned: ${files.length}\n`);
console.log(`UNUSED (${unused.length}):`);
for (const c of unused) console.log(`  .${c}`);
console.log(`\nONCE (likely the CSS rule itself only — manual check, ${onceUsed.length}):`);
for (const c of onceUsed) console.log(`  .${c}`);
