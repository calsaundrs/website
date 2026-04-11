# SEO Changelog

- 2026-04-11 — Venue pages now render real Google Places data (photos, reviews, amenities, accessibility, editorial summary) at SSG build time, with photos served via a server-side `/api/places-photo` proxy so the API key never leaves the backend.
- 2026-04-11 — Static venue pages refactored onto the Phase 1 ("Toxic Glass") design system. The SSG build now reads `templates/venue-page.hbs` and stitches in the canonical `global/header.html` and `global/footer.html` at build time, so venue pages share the same nav, footer, and visual language as the rest of the site (replacing the legacy purple-glass / Anton-headline shell).
