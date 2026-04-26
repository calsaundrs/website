// Astro config — additive build alongside the existing static site.
// Pages live in src/pages/. Output goes to dist-astro/ so it never
// conflicts with the existing HTML at the project root, which the
// current Netlify build serves as-is.
//
// During the spike (Milestone 3) only one page lives here:
// admin-system-status. Once the migration goes ahead in M4, more
// pages will move in and the dual-build coexistence will retire.

import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: './dist-astro',
  srcDir: './src',
  // Astro requires a publicDir, but we want the existing root assets
  // (css/, js/, images, etc.) to keep being served by Netlify
  // unmodified. Point it at an isolated empty dir so Astro doesn't
  // copy anything from the project root into dist-astro/.
  publicDir: './src/public',
  build: {
    format: 'file',
  },
  // Keep the dev server off the existing test port (8888 is used by
  // Playwright's webServer via npx serve).
  server: { port: 4321 },
  vite: {
    // Astro inlines CSS by default; that's fine for a single-page spike.
    build: { cssCodeSplit: false },
  },
});
