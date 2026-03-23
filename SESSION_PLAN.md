# Session Implementation Plan

## Overview
Three tasks for Brum Outloud — clubs page, venue listing improvement, and Birmingham Pride guide.

---

## 1. Sports & Social Clubs — `/clubs.html`
**Status: IN PROGRESS**

New static page. Card grid of LGBTQ+ sports teams and social groups. Hardcoded content (changes rarely, better for SEO).

### Content sections:
- Hero heading
- **Sports & Fitness**: Birmingham Blaze FC, Birmingham Bulls RFC, Birmingham Swifts Running, Moseley Shoals Swimming, Midlands Out Badminton, Birmingham Unicorns CC, Gay City Bowlers, Birmingham Badgers Quadball
- **Arts & Culture**: Rainbow Voices Choir, Journey Film Club, Bards & Books LGBT Book Club, Birmingham LGBTQ+ Writers
- **Social & Gaming**: Birmingham Gaymers, Mids Bears, Boot Women Walking
- **Community & Support**: Golden Babs (50+), Yarana Group, Finding a Voice, UNMUTED, African Rainbow Family, Imaan, Out Central Youth, GBT Men's Health, Café Queer
- "Submit your club" CTA at bottom
- Link from community.html FAQ answer

### Design:
- Same neo-print style as rest of site (Syne headings, Space Grotesk body, toxic/pink/purple palette)
- Category sections with icon headers
- Cards with club name, description, meeting info, external link
- Schema markup: CollectionPage + BreadcrumbList

---

## 2. Venue Listing Page — improve `all-venues.html`
**Status: PENDING**

Currently 9 hardcoded venues with no API loading.

### Changes:
- Add skeleton loading cards (same pattern as events.html)
- Fetch from `/.netlify/functions/get-venues` on page load
- Render venue cards dynamically from API response
- Keep current 9 as static fallback that gets replaced when API loads
- Add filter pills by venue type if data supports it
- Add venue count display

---

## 3. Birmingham Pride Guide — `/birmingham-pride.html`
**Status: PENDING**

Hybrid static editorial + dynamic sections. SEO magnet page.

### Page sections:
1. **Hero** — key facts (dates: 23-25 May 2025, location, ticket CTA)
2. **"What is Birmingham Pride?"** — SEO editorial content, history (est. 1997, 28th year, 75k parade spectators)
3. **The Parade** — route (Centenary Square → Hurst St), timing, free to attend
4. **2025 Lineup** — Clean Bandit, Bananarama, Vengaboys, The Wanted, Alexandra Burke etc.
5. **Events schedule** — dynamic section pulling Pride-tagged events from API
6. **Venue guide** — Gay Village venues (Missing Bar, Nightingale, The Fox, Eden, Equator, Sidewalk, Village Inn)
7. **Tickets & Pricing** — festival £40.15/day, street party £13.75, under 12s free
8. **Practical info** — transport (New Street station), accessibility, families
9. **FAQ** with FAQPage schema markup

### SEO:
- Target keywords: "Birmingham Pride 2025", dates, lineup, parade route, afterparties, tickets
- Schema markup: Event, FAQPage, BreadcrumbList
- Open Graph + Twitter cards
- Internal links from homepage, events, community, venue pages
- Page stays live year-round — update year post-event

---

## Build Order
1. Clubs (smallest, self-contained) ← CURRENT
2. Venues (medium, API work)
3. Pride guide (largest, benefits from 1 + 2 being done)
4. Cross-link all pages + commit & push
