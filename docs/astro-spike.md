# Astro Spike — Milestone 3

Living document for the Astro spike (issues [#151](https://github.com/calsaundrs/website/issues/151)–[#154](https://github.com/calsaundrs/website/issues/154)). Contains the setup decisions, conversion notes, measurements, and the eventual go / no-go recommendation.

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

_TBD — build time, output size, JS shipped, deploy story._

## Decision (#154)

_TBD — go / no-go._
