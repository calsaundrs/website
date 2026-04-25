const { test, expect } = require('@playwright/test');

const VENUE_SLUGS = [
  'glamorous',
  'eden-bar',
  'the-village-inn',
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

test.describe('Venue detail JSON-LD', () => {
  for (const slug of VENUE_SLUGS) {
    test(`venue/${slug} has valid LocalBusiness and BreadcrumbList schema`, async ({ page }) => {
      const response = await page.goto(`/venue/${slug}.html`, { waitUntil: 'domcontentloaded' });
      expect(response.status()).toBeLessThan(400);

      const blocks = await extractJsonLd(page);
      expect(blocks.length).toBeGreaterThan(0);

      for (const b of blocks) {
        expect(b.__parseError, `JSON-LD parse error: ${b.__parseError}`).toBeUndefined();
      }

      const business = findByType(blocks, 'LocalBusiness');
      expect(business, 'LocalBusiness schema missing').toBeDefined();
      expect(business.name).toBeTruthy();
      expect(business.url).toMatch(/^https?:\/\//);
      expect(business.address).toBeDefined();
      expect(business.address.streetAddress).toBeTruthy();
      expect(business.image).toMatch(/^https?:\/\//);

      const breadcrumb = findByType(blocks, 'BreadcrumbList');
      expect(breadcrumb, 'BreadcrumbList schema missing').toBeDefined();
      expect(Array.isArray(breadcrumb.itemListElement)).toBe(true);
      expect(breadcrumb.itemListElement.length).toBeGreaterThan(1);
      for (const item of breadcrumb.itemListElement) {
        expect(item['@type']).toBe('ListItem');
        expect(item.name).toBeTruthy();
        expect(item.item).toMatch(/^https?:\/\//);
      }
    });
  }
});

const EVENT_BASE_URL = process.env.TEST_EVENT_BASE_URL;

test.describe('Event detail JSON-LD', () => {
  test.skip(
    !EVENT_BASE_URL,
    'Event detail pages are generated via Netlify rewrites to get-event-details. ' +
      'Set TEST_EVENT_BASE_URL to a deployed URL (e.g. a Netlify preview) to run these tests.'
  );

  test('first listed event has valid Event schema', async ({ page }) => {
    await page.goto(`${EVENT_BASE_URL}/events`, { waitUntil: 'networkidle' });

    const firstHref = await page.$$eval('a[href^="/event/"]', (links) =>
      links.length ? links[0].getAttribute('href') : null
    );
    expect(firstHref, 'No event links found on /events').toBeTruthy();

    await page.goto(`${EVENT_BASE_URL}${firstHref}`, { waitUntil: 'domcontentloaded' });
    const blocks = await extractJsonLd(page);
    const event = findByType(blocks, 'Event');

    expect(event, 'Event schema missing').toBeDefined();
    expect(event.name).toBeTruthy();
    expect(event.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(event.location).toBeDefined();
    expect(event.location.name || event.location['@type']).toBeTruthy();
    expect(event.image).toBeTruthy();
  });
});
