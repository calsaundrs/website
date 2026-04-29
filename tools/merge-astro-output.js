#!/usr/bin/env node
// Merge dist-astro/ into the project root for Netlify publishing.
//
// Copies:
//   - *.html files (and nested HTML in subdirectories like
//     event/{slug}.html when those routes exist)
//   - the _astro/ directory wholesale (Astro's bundled scoped CSS +
//     hashed JS chunks for component styles). HTML pages reference
//     these via /_astro/style.<hash>.css — without copying them,
//     the live site 404s on the CSS bundle and pages render
//     unstyled.
//
// Skips Astro's publicDir bleed-through (.gitkeep, etc.) and any
// other generated files outside *.html / _astro/.
//
// Runs as part of the Netlify build command after `astro build`.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'dist-astro');
const DST = path.resolve(__dirname, '..');

function* walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip _astro — copied wholesale below.
      if (entry.name === '_astro') continue;
      yield* walkHtml(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield full;
    }
  }
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      n += copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      n++;
    }
  }
  return n;
}

if (!fs.existsSync(SRC)) {
  console.error('[merge-astro] dist-astro/ not found — did you run `npm run astro:build`?');
  process.exit(1);
}

let htmlCount = 0;
for (const src of walkHtml(SRC)) {
  const rel = path.relative(SRC, src);
  const dst = path.join(DST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  htmlCount++;
  console.log(`  ${rel}`);
}

let astroCount = 0;
const astroSrc = path.join(SRC, '_astro');
if (fs.existsSync(astroSrc)) {
  const astroDst = path.join(DST, '_astro');
  astroCount = copyDirRecursive(astroSrc, astroDst);
  console.log(`  _astro/ (${astroCount} file(s))`);
}

console.log(
  `[merge-astro] ${htmlCount} HTML file(s) + ${astroCount} _astro asset(s) merged into project root`
);
