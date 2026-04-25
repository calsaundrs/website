const { test, expect } = require('@playwright/test');

const REQUIRED_PAGES = [
  '/',
  '/events',
  '/all-venues',
  '/birmingham-pride',
  '/clubs',
  '/community',
  '/contact',
];

const URL_BLOCK_RE = /<url>([\s\S]*?)<\/url>/g;
const LOC_RE = /<loc>(.+?)<\/loc>/;
const CHANGEFREQ_RE = /<changefreq>(.+?)<\/changefreq>/;
const LASTMOD_RE = /<lastmod>(.+?)<\/lastmod>/;

test.describe('Sitemap', () => {
  let body;
  let blocks;
  let urls;

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/xml/i);

    body = await response.text();
    blocks = body.match(URL_BLOCK_RE) || [];
    urls = blocks.map((b) => {
      const m = b.match(LOC_RE);
      return m ? m[1] : null;
    });
  });

  test('has at least 50 URLs', () => {
    expect(blocks.length).toBeGreaterThan(50);
  });

  test('starts with a valid XML declaration and urlset namespace', () => {
    expect(body.trim().startsWith('<?xml')).toBe(true);
    expect(body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  test('every <url> block has a <loc> with a valid http(s) URL', () => {
    for (const block of blocks) {
      const m = block.match(LOC_RE);
      expect(m, `Block missing <loc>: ${block.slice(0, 80)}`).not.toBeNull();
      expect(m[1]).toMatch(/^https?:\/\//);
    }
  });

  test('every <url> block has at least <changefreq> or <lastmod>', () => {
    for (const block of blocks) {
      const hasChangefreq = CHANGEFREQ_RE.test(block);
      const hasLastmod = LASTMOD_RE.test(block);
      const loc = (block.match(LOC_RE) || [])[1] || '<unknown>';
      expect(
        hasChangefreq || hasLastmod,
        `Sitemap entry for ${loc} has neither <changefreq> nor <lastmod>`
      ).toBe(true);
    }
  });

  test('contains all required core pages', () => {
    const paths = urls.map((u) => new URL(u).pathname.replace(/\/$/, '') || '/');
    for (const required of REQUIRED_PAGES) {
      const normalized = required === '/' ? '/' : required.replace(/\/$/, '');
      expect(paths, `Sitemap is missing ${required}`).toContain(normalized);
    }
  });

  test('contains a reasonable number of event and venue URLs', () => {
    const eventCount = urls.filter((u) => u.includes('/event/')).length;
    const venueCount = urls.filter((u) => u.includes('/venue/')).length;
    expect(eventCount + venueCount).toBeGreaterThan(5);
  });
});
