const { test, expect } = require('@playwright/test');

const PAGES = [
  { path: '/birmingham-pride.html', extraTypes: ['Event', 'Organization'] },
  { path: '/community.html', extraTypes: [] },
  { path: '/gay-birmingham-guide.html', extraTypes: [] },
  { path: '/birmingham-drag-shows.html', extraTypes: ['ItemList'] },
  { path: '/birmingham-gay-bars.html', extraTypes: ['ItemList'] },
  { path: '/clubs.html', extraTypes: ['ItemList'] },
];

async function extractJsonLd(page) {
  return await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => {
      try {
        return JSON.parse(n.textContent);
      } catch (e) {
        return { __parseError: e.message, raw: n.textContent };
      }
    })
  );
}

function findByType(blocks, type) {
  return blocks.find((b) => b && b['@type'] === type);
}

test.describe('Editorial page JSON-LD', () => {
  for (const { path, extraTypes } of PAGES) {
    test(`${path} renders with valid BreadcrumbList and FAQPage`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBeLessThan(400);

      await expect(page.locator('h1, h2').first()).toBeVisible();

      const blocks = await extractJsonLd(page);
      expect(blocks.length, 'No JSON-LD blocks on page').toBeGreaterThan(0);

      for (const b of blocks) {
        expect(b.__parseError, `JSON-LD parse error: ${b.__parseError}`).toBeUndefined();
      }

      const breadcrumb = findByType(blocks, 'BreadcrumbList');
      expect(breadcrumb, 'BreadcrumbList missing').toBeDefined();
      expect(Array.isArray(breadcrumb.itemListElement)).toBe(true);
      expect(breadcrumb.itemListElement.length).toBeGreaterThan(1);
      for (const item of breadcrumb.itemListElement) {
        expect(item['@type']).toBe('ListItem');
        expect(item.name).toBeTruthy();
        expect(item.item).toMatch(/^https?:\/\//);
      }

      const faq = findByType(blocks, 'FAQPage');
      expect(faq, 'FAQPage missing').toBeDefined();
      expect(Array.isArray(faq.mainEntity)).toBe(true);
      expect(faq.mainEntity.length).toBeGreaterThan(0);
      for (const q of faq.mainEntity) {
        expect(q['@type']).toBe('Question');
        expect(q.name, 'Question missing name/text').toBeTruthy();
        expect(q.acceptedAnswer).toBeDefined();
        expect(q.acceptedAnswer['@type']).toBe('Answer');
        expect(q.acceptedAnswer.text, 'Answer missing text').toBeTruthy();
      }

      for (const type of extraTypes) {
        const block = findByType(blocks, type);
        expect(block, `${type} schema missing on ${path}`).toBeDefined();
      }
    });
  }

  test('birmingham-pride Event schema has required fields', async ({ page }) => {
    await page.goto('/birmingham-pride.html', { waitUntil: 'domcontentloaded' });
    const blocks = await extractJsonLd(page);
    const event = findByType(blocks, 'Event');

    expect(event).toBeDefined();
    expect(event.name).toBeTruthy();
    expect(event.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(event.location).toBeDefined();
    expect(event.location['@type']).toBe('Place');
    expect(event.location.address).toBeDefined();
  });
});
