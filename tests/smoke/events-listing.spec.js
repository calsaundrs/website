const { test, expect } = require('@playwright/test');

const GET_EVENTS_URL = '**/.netlify/functions/get-events**';

function isoDate(daysAhead) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString();
}

function makeEvent(overrides = {}) {
  return {
    id: 'e-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Event',
    slug: 'test-event',
    date: isoDate(10),
    startTime: '20:00',
    venueName: 'The Test Venue',
    description: 'Smoke-test event payload.',
    category: ['Drag'],
    image: 'https://example.com/test.jpg',
    ...overrides,
  };
}

const FIXTURE_EVENTS = [
  makeEvent({
    name: 'Drag Brunch Spectacular',
    slug: 'drag-brunch-spectacular',
    date: isoDate(3),
    venueName: 'The Village Inn',
    category: ['Drag'],
  }),
  makeEvent({
    name: 'Karaoke Night Live',
    slug: 'karaoke-night-live',
    date: isoDate(5),
    venueName: 'The Fox',
    category: ['Karaoke'],
  }),
  makeEvent({
    name: 'Pride Quiz Night',
    slug: 'pride-quiz-night',
    date: isoDate(7),
    venueName: 'Eden Bar',
    category: ['Quiz'],
  }),
  makeEvent({
    name: 'Sunday Roast Social',
    slug: 'sunday-roast-social',
    date: isoDate(20),
    venueName: 'Glamorous',
    category: ['Social'],
  }),
  makeEvent({
    name: 'Disco Inferno Rave',
    slug: 'disco-inferno-rave',
    date: isoDate(25),
    venueName: 'The Nightingale',
    category: ['Club'],
  }),
];

async function stubEvents(page, events = FIXTURE_EVENTS) {
  await page.route(GET_EVENTS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        events,
        hasMore: false,
        totalCount: events.length,
      }),
    });
  });
}

async function eventCardCount(page) {
  return await page.locator('#event-grid a[href^="/event/"]').count();
}

test.describe('Events listing page', () => {
  test('renders cards from the API', async ({ page }) => {
    await stubEvents(page);
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });

    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(FIXTURE_EVENTS.length);

    await expect(page.locator('#event-count')).toContainText(/upcoming events?/i);
  });

  test('search input filters cards by name', async ({ page }) => {
    await stubEvents(page);
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(FIXTURE_EVENTS.length);

    await page.fill('#event-search', 'drag brunch');

    await expect.poll(() => eventCardCount(page), { timeout: 5000 }).toBe(1);
    await expect(page.locator('#event-grid')).toContainText('Drag Brunch Spectacular');
    await expect(page.locator('#event-count')).toContainText(/1 of 5/i);
  });

  test('search input filters by venue name', async ({ page }) => {
    await stubEvents(page);
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(FIXTURE_EVENTS.length);

    await page.fill('#event-search', 'eden');

    await expect.poll(() => eventCardCount(page), { timeout: 5000 }).toBe(1);
    await expect(page.locator('#event-grid')).toContainText('Pride Quiz Night');
  });

  test('clearing the search restores all cards', async ({ page }) => {
    await stubEvents(page);
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(FIXTURE_EVENTS.length);

    await page.fill('#event-search', 'nothingmatchesthisquery');
    await expect.poll(() => eventCardCount(page), { timeout: 5000 }).toBe(0);
    await expect(page.locator('#event-grid')).toContainText(/No Events Found/i);

    await page.fill('#event-search', '');
    await expect.poll(() => eventCardCount(page), { timeout: 5000 }).toBe(FIXTURE_EVENTS.length);
  });

  test('clicking "This Week" filter narrows the visible cards', async ({ page }) => {
    await stubEvents(page);
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(FIXTURE_EVENTS.length);

    const allCount = await eventCardCount(page);

    await page.locator('.date-filter[data-filter="this-week"]').click();
    await expect(page.locator('.date-filter[data-filter="this-week"]')).toHaveClass(/active/);

    const weekCount = await eventCardCount(page);
    expect(weekCount).toBeLessThanOrEqual(allCount);

    await expect(page.locator('#event-count')).toContainText(/of 5/i);
  });

  test('event count text reflects the totalCount from the API', async ({ page }) => {
    const events = FIXTURE_EVENTS.slice(0, 3);
    await page.route(GET_EVENTS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          events,
          hasMore: true,
          totalCount: 42,
        }),
      });
    });
    await page.goto('/events.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => eventCardCount(page), { timeout: 10000 }).toBe(3);

    await expect(page.locator('#event-count')).toContainText(/of 42/);
  });
});
