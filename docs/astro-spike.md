# Astro Spike — Milestone 3

Living document for the Astro spike (issues [#151](https://github.com/calsaundrs/website/issues/151)–[#154](https://github.com/calsaundrs/website/issues/154)). Contains the setup decisions, conversion notes, measurements, and the eventual go / no-go recommendation.

## Status: M3 closed, M4 in progress

The decision was conditional-go and then deferred for Pride 2026. After Pride image-hardening landed, we resumed M4. This doc is the historical record of the spike; ongoing M4 work tracks in [milestone 4](https://github.com/calsaundrs/website/milestone/5).

## Setup (#151)

### Coexistence model

The existing site is 72 hand-written HTML files at the project root, served as-is by Netlify. The Astro build is **additive** during the spike:

| Layer | Where it lives | What touches it |
|---|---|---|
| Existing HTML | project root (`admin-*.html`, `events.html`, etc.) | Netlify serves directly |
| Existing build scripts | project root (`build-*.js`, `generate-*.js`) | `npm run build` |
| Astro pages | `src/pages/` | `npm run astro:build` |
| Astro output | `dist-astro/` (gitignored) | Netlify serves selectively (TBD) |
| Astro public dir | `src/public/` | Astro copies into `dist-astro/` (intentionally empty during spike) |

`astro.config.mjs` points `publicDir` at `./src/public` to prevent Astro from copying everything from the project root. CSS, JS, fonts, and images stay where they are.

### npm scripts

- `npm run astro:dev` — Astro dev server on `:4321` (Playwright uses `:8888`, no conflict)
- `npm run astro:build` — produces `dist-astro/`
- `npm run astro:preview` — preview the built site

### What's there now

- `astro.config.mjs` — coexistence config
- `src/pages/astro-hello.astro` — proof-of-life hello world (not linked from anywhere)
- `src/public/.gitkeep` — placeholder so Astro has a publicDir
- `npm run astro:build` succeeds in ~1.5s cold

### What stays unchanged

- `npm run build:css` — Tailwind 3.4 still builds the same way
- `npm run build` — the existing SSG pipeline is untouched
- `npm test`, `npm run test:unit` — the test suites don't know about Astro
- Netlify build command in `netlify.toml` — unchanged for now

## Conversion (#152)

Ported `admin-system-status` to a `.astro` page (output at `/admin-system-status-spike` to avoid clobbering the existing route during the spike).

### Files added

- `src/components/AdminLayout.astro` — server-rendered chrome (sidebar + topbar with active-nav at build time, plus a tiny inline script that wires `#logout-btn` and `#admin-menu-toggle`)
- `src/pages/admin-system-status-spike.astro` — the page itself, slotting page-specific styles, scripts, and content into `AdminLayout`

### What was easy

- **Component model fits the chrome problem cleanly.** Sidebar + topbar take props (`activeNav`, `breadcrumbSection`, `breadcrumbPage`, `title`) and render server-side. No more `[data-admin-sidebar]` placeholder + client JS injection.
- **TypeScript props are free.** Auto-completed `activeNav` to a union type of admin URLs, caught a typo in 30 seconds.
- **`<slot name="head">` for page-specific styles** is exactly the right primitive for letting each page extend the layout's `<head>` without overriding it.
- **CSS scoping.** Astro auto-scopes a page's `<style>` block via a `data-astro-cid-*` attribute. The page-specific `.status-card` etc. classes don't leak into other Astro pages — useful when many pages eventually share a layout but want their own visual quirks.
- **Output is clean static HTML.** No Astro runtime is shipped because there's no island. `auth-guard.js` runs exactly the same way it does on the existing root HTML.

### What was awkward

- **`publicDir` cannot be disabled** — Astro requires *some* public dir, and it copies whatever's there into `dist-astro/`. Workaround: point `publicDir` at a deliberately empty `src/public/`.
- **Breadcrumb layout in the topbar** needed a `<Fragment>` wrapper to conditionally emit the section + separator together. Mild Astro syntax overhead vs. just writing JS.
- **Inline scripts that talk to globally-loaded scripts** (`window.pushNotificationService`) needed `is:inline` to opt out of Astro's bundling, otherwise Astro tried to resolve the global as a module import. Easy fix once you know about it.
- **CSS inside `<slot name="head">`** doesn't get the same scoping treatment as the page's own top-level `<style>`. Worth knowing: page-specific CSS that lives in the head slot is global. (Acceptable here since the classes are unique anyway.)
- **Long inline `<script>` tags in `.astro` files** are acceptable but feel transitional. The right end-state is breaking that JS into a `src/scripts/admin-system-status.ts` module. Skipped for the spike to keep the diff focused on the layout question.

### Output comparison

| | Original `admin-system-status.html` | Astro `admin-system-status-spike.html` |
|---|---|---|
| Size | 28,190 bytes | 25,841 bytes (−8.3%) |
| Inline `<style>` | hand-written | minified by Vite |
| Sidebar/topbar markup | injected client-side by `admin-chrome.js` | server-rendered |
| Active-nav state | computed at runtime from `window.location` | computed at build time |
| FOUC potential before chrome paints | yes (admin-chrome.js runs on DOMContentLoaded) | no |

### Open questions captured for the decision doc

1. The chrome layout is currently a thin re-implementation. Would Tailwind v4 (M4) make this cleaner via design-token CSS files imported into the layout?
2. The 350-line page script lives inside the `.astro` file as a single `<script is:inline>`. Acceptable for spike; for full migration we'd want to break it into a module that Astro can typecheck.
3. We haven't tried a public-facing page yet. The events listing pulls from `/.netlify/functions/get-events` at runtime — would Astro's build-time SSR fetch be a better fit there, eliminating the loading skeleton on first paint?

## Measurements (#153)

### Build time

| Run | Wall time | In-Astro | Notes |
|---|---|---|---|
| Cold (`rm -rf dist-astro .astro` first) | 1.55s | 482ms | one-time vite + content sync |
| Warm | 1.01s | 412ms | typical CI/local re-build |

For comparison, the existing pipeline:
- `npm run build:css` — 1.5s
- `npm run generate-sitemap` — 2.3s (Firestore fetch — network-bound)

Astro's overhead is in the same ballpark as one of the existing build steps. Adding it to the chain wouldn't materially change overall build time.

### Output size

|  | Original `admin-system-status.html` | Astro `admin-system-status-spike.html` |
|---|---|---|
| HTML | 28,190 bytes | 25,841 bytes (−8.3%) |
| Inline CSS | hand-written, full | minified by Vite (`#111827b3` instead of `rgba(17, 24, 39, 0.7)`) |
| Inline JS | full 350-line script | full 350-line script (bundled in-place; not extracted) |

### JS shipped beyond what the original page already loads

- 56 bytes of inline `<script type="module">` for the logout + menu-toggle wiring (replaces the equivalent in `js/admin-chrome.js` for this page)
- **No** Astro client runtime — there are no islands on this page, so Astro emits zero framework JS

### Dev iteration

- `npm run astro:dev` runs the Astro dev server on `:4321` (no clash with Playwright's `:8888`). Hot reload works on the `.astro` file edits.
- The existing `npx serve . -l 8888` setup keeps working unchanged for the root HTML pages.

### Deploy story

Not deployed live during the spike. Two options for the migration:
1. **Add `npm run astro:build` to the Netlify build chain** and copy `dist-astro/*` into project root pre-deploy. Risk: path collisions if an Astro page and a root HTML have the same name.
2. **Change `publish` in `netlify.toml`** from `.` to a merged output dir that combines root HTML and `dist-astro`. Cleaner long-term — collisions become explicit.

Option 2 is the right end-state. Option 1 is fine while the migration is partial.

## Decision (#154)

### Recommendation: **conditional go**

Astro is the right tool for this codebase, and the spike removed the major risks. Migrate incrementally in M4 — admin pages first (lowest blast radius, highest tooling-pain payoff), public pages second.

The "conditional" part: commit to **extracting page scripts as typed modules** rather than leaving them inline forever. The 350 lines inside `admin-system-status-spike.astro`'s `<script is:inline>` block are tolerable for one page; across 72 pages they would be a maintenance liability.

### What worked

- Component model fits the chrome problem cleanly. Sidebar + topbar take props, render server-side, no client-side DOM injection.
- TypeScript props caught a typo at write time. Free upgrade vs. the current HTML+JS approach.
- CSS scoping confines page-specific styles automatically.
- Output is plain static HTML. No framework runtime ships unless you opt in via islands.
- Build is fast and fits alongside the existing pipeline.

### What didn't (workarounds applied)

- `publicDir` can't be disabled — workaround: empty `src/public/`.
- Inline scripts that read globals (`window.pushNotificationService`) need `is:inline` to opt out of bundling.
- CSS in `<slot name="head">` isn't auto-scoped — that's the head, not a component's `<style>`. Acceptable.

### Cost projection for full migration (M4)

| Workstream | Estimate | Notes |
|---|---|---|
| Admin pages (11) port | 1.5 weeks | Reuse `AdminLayout`. First page ~1 day; later ones ~half a day with helpers in place. |
| Page scripts → typed modules | bundled with each port | Don't carry 350-line `<script is:inline>` blocks into M4. |
| Public pages (events, venues, editorial, detail) | 2 weeks | Events listing is the gnarly one — runtime fetch → build-time SSR is the right move and needs care to keep filter UX working. |
| SSG scripts retirement | 3 days | `build-events-ssg.js`, `build-venues-ssg.js`, `generate-event-pages.js`, `generate-series-pages.js`, `generate-venue-pages.js`, the listing builders, the comprehensive sitemap generator. Most replace 1:1 with Astro's `getStaticPaths()`. |
| Netlify build chain change | 1 day | Move `publish` to a merged dir. |
| Tailwind v4 migration | 2 days | Separate, parallelisable; deferred to its own issue. |
| Buffer / regression fixing | 1 week | Test suite catches a lot but expect surprises. |

**Total: ~6 weeks of focused work.** The earlier doc estimated 2–4 weeks for an "Astro migration" — that was optimistic. Realistic with the data we now have.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Breaking the promoter submission flow during a migration touch | The M1+M2 test suite (98 tests) exercises every critical promoter and admin path. Migrate one page at a time with the suite gate. |
| URL shape changes regressing SEO | Keep all existing URLs identical. The spike already does this — `admin-system-status-spike.html` is at the same shape as the existing route. |
| JSON-LD regressions on event/venue/editorial pages | The M1 JSON-LD specs lock the schema contract. Any structural change fails the build. |
| Astro framework churn / lock-in | Output is plain HTML. If we ever want out, exporting Astro's `dist/` and serving statically is trivial. The lock-in is the layout component model, which is portable to anything else (Next, Eleventy, custom). |
| Promoter form quirks (e.g. #138-style HTML5 traps) re-introduced during a port | The M2 form-hardening tests catch the specific shapes; the audit (#143) is the inspection pattern to repeat. |
| Sidebar nav drift between Astro pages and remaining root HTML during the migration | Keep `js/admin-chrome.js` and `AdminLayout.astro` rendering the same nav until M4 retires the JS-driven version. Both currently have the same 7 nav items. |

### Open questions to answer in M4

1. Public-facing pages with runtime data — events listing, venue listing — do they benefit from build-time SSR (faster first paint, no skeleton) or stay client-fetched (always-fresh data)? Spike didn't try this.
2. Does Tailwind v4 + Astro's component CSS feel right together, or is it overkill? Decide alongside the v4 migration.
3. Where should the page scripts live? Options: `src/scripts/<page>.ts` (Astro's preferred), or component-local `<script>` tags. Pick a convention before porting the first batch.

### If recommendation flipped to no-go

If we'd seen any of the following, the recommendation would be no-go:
- Output bigger than the original (didn't happen — −8.3% smaller)
- Astro shipping framework runtime even on no-island pages (didn't happen — 0 bytes)
- Build time bad enough to push CI past 10 minutes (didn't happen — 1s)
- Auth/Firebase integration broken (didn't happen — same `auth-guard.js` works unchanged)

### Action

- Close M3.
- ~~Seed M4 with concrete issues following the cost projection.~~ **Deferred.** See note below.
- M4 should land incrementally with the test suite gating each PR — when we eventually pick it up.

## PM call: M4 deferred (2026-04-26)

Re-read of the situation right after writing the recommendation above:

- The site has real users and real seasonal traffic. **Birmingham Pride is 2026-05-22 to 2026-05-24** — 26 days from today. The May window is the peak relevance moment for this site.
- M1 + M2 already closed the developer-experience pain points that motivated this whole project: 109 automated tests, a shared admin chrome (one edit instead of eleven), a hardened submission form, +120 follow-up tests in the form-hardening pass. None of that needed a framework migration.
- M4 is ~6 weeks of focused work that ships **zero user-visible value**. Doing it now means showing up to Pride 2026 mid-rewrite.
- The Astro spike landed clean and the data is preserved here. The recommendation stays "conditional go" — just not now.

**Resequenced plan:** insert a time-boxed "Pride 2026 readiness" milestone before M4. Three concrete issues, due 2026-05-21:
1. Audit + refresh `birmingham-pride.html` for the 2026 dates, lineup, FAQ, mobile rendering.
2. Performance audit on `/events` and `/birmingham-pride` (Lighthouse — fix the top three regressions).
3. Surface Pride-tagged events on `/events` (filter or featured row) so visitors land on what they came for.

After Pride, revisit M4 — at which point we'll either still want it (and have a calmer window to do it), or we'll have learned that the sidebar fix in M2 was actually enough. Either outcome is fine.

The spike work isn't wasted: `astro.config.mjs`, `AdminLayout.astro`, the spike page, and this whole doc stay in the repo as a frozen pointer. If M4 lands later, it picks up from here.
