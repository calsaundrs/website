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

_TBD — admin-system-status port._

## Measurements (#153)

_TBD — build time, output size, JS shipped, deploy story._

## Decision (#154)

_TBD — go / no-go._
