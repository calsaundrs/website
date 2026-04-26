#!/usr/bin/env node
// Merge dist-astro/ into the project root for Netlify publishing.
// Only copies *.html files (and nested HTML in subdirectories like
// event/{slug}.html when those routes exist). Skips Astro's
// publicDir bleed-through (.gitkeep, etc.).
//
// Runs as part of the Netlify build command after `astro build`.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'dist-astro');
const DST = path.resolve(__dirname, '..');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield full;
  }
}

if (!fs.existsSync(SRC)) {
  console.error('[merge-astro] dist-astro/ not found — did you run `npm run astro:build`?');
  process.exit(1);
}

let copied = 0;
for (const src of walk(SRC)) {
  const rel = path.relative(SRC, src);
  const dst = path.join(DST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied++;
  console.log(`  ${rel}`);
}
console.log(`[merge-astro] ${copied} HTML file(s) merged into project root`);
