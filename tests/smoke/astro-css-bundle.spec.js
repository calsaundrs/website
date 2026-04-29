// Guard against the regression fixed in PR #188: tools/merge-astro-output.js
// used to copy only *.html files from dist-astro/, silently leaving
// dist-astro/_astro/style.<hash>.css behind. Astro pages reference that
// bundle in <link rel="stylesheet">, so on production the URL 404'd and
// Netlify served the SPA-fallback 404 HTML page (200 + HTML body) — which
// the browser tried to parse as CSS, leaving page-specific scoped styles
// (.filter-pill, .search-input, .nsfw-toggle, etc.) completely missing.
//
// This test asserts, for every Astro public page using PublicLayout, that:
//   1. The page links to at least one /_astro/*.css bundle.
//   2. The bundle URL responds 200 with a CSS content-type.
//   3. The body is not the 404-HTML fallback masquerading as CSS.

const { test, expect } = require('@playwright/test');

const PAGES = [
  '/events.html',
  '/clubs.html',
  '/all-venues.html',
  '/community.html',
  '/birmingham-pride.html',
  '/birmingham-drag-shows.html',
  '/birmingham-gay-bars.html',
  '/gay-birmingham-guide.html',
];

test.describe('Astro CSS bundle deployment', () => {
  for (const path of PAGES) {
    test(`${path} references a /_astro/ CSS bundle that loads as CSS`, async ({
      page,
      request,
    }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBeLessThan(400);

      // Astro emits scoped-style bundles as <link rel="stylesheet" href="/_astro/...">
      const bundleHrefs = await page.$$eval(
        'link[rel="stylesheet"][href^="/_astro/"]',
        (links) => links.map((l) => l.getAttribute('href'))
      );
      expect(
        bundleHrefs.length,
        `${path} should reference at least one /_astro/ CSS bundle (Astro emits one whenever a page or component declares scoped <style>)`
      ).toBeGreaterThan(0);

      for (const href of bundleHrefs) {
        const cssRes = await request.get(href);
        expect(
          cssRes.status(),
          `bundle ${href} returned ${cssRes.status()} — the publish step likely failed to copy dist-astro/_astro/ alongside HTML files`
        ).toBe(200);

        const contentType = cssRes.headers()['content-type'] || '';
        expect(
          contentType,
          `bundle ${href} content-type is "${contentType}", expected text/css`
        ).toMatch(/css/i);

        const body = await cssRes.text();

        // The 404-fallback bug we're guarding against returned a full HTML
        // document with status 200 (Netlify SPA fallback). Catch that
        // explicitly so the failure message is unambiguous.
        const looksLikeHtml = /^\s*<!DOCTYPE html|^\s*<html/i.test(body);
        expect(
          looksLikeHtml,
          `bundle ${href} body looks like an HTML document, not CSS — ` +
            'the publish step is serving a 404 fallback for missing _astro/ files. ' +
            'Check tools/merge-astro-output.js copies _astro/ alongside HTML.'
        ).toBe(false);

        // Sanity: a real CSS bundle for a layout + page styles is at least
        // a few KB. The 404 HTML body was ~14KB, so we can't use that as the
        // upper bound — but we can check it's clearly non-empty.
        expect(
          body.length,
          `bundle ${href} body is suspiciously short (${body.length} bytes)`
        ).toBeGreaterThan(500);
      }
    });
  }
});
