# Brum Outloud Design Review Report

## Overview
This document serves as a comprehensive UI/UX design review of the Brum Outloud web platform, focusing strictly on the public-facing areas. The review evaluates the implementation of the Brutalist manifesto outlined in `STYLE_GUIDE.html` and assesses overall visual consistency, component architecture, and accessibility.

## 1. Style Guide Adherence & CSS Variables

### 1.1 Color Palette Inconsistencies
The `STYLE_GUIDE.html` clearly defines the following core color palette:
- **Deep Void (Bg):** `#0D0115`
- **Light Text:** `#f3e8ff`
- **Toxic Lime:** `#CCFF00`
- **Electric Purple:** `#9B5DE5`
- **Hot Pink:** `#E83A99`

**Findings:**
While `index.html`, `events.html`, `event-template.html`, and `venue-template.html` align with these variables, several other public-facing pages (`promoter-submit-new.html`, `community.html`, `all-venues.html`, `contact.html`) have hardcoded inline `<style>` blocks that use older or incorrect hex codes:
- `--color-pink: #ff007f;` (Should be `#E83A99`)
- `--color-purple: #7a00ff;` (Should be `#9B5DE5`)
- `--color-toxic: #ccff00;` (Correct, but sometimes lowercase)

**Recommendation:**
Remove all inline `:root` variable definitions from individual HTML files. Define these variables strictly within `css/main.css` to ensure global consistency and ease of future updates.

### 1.2 Typography
The style guide mandates `Syne` for display fonts and `Space Grotesk` for body fonts.

**Findings:**
- The overarching typography rules are largely followed across the site. `Space Grotesk` is used effectively for body copy, and `Syne` is used for high-impact headings.
- **Antipattern Found:** The class `.font-anton` is heavily referenced across numerous templates (e.g., `admin-*` pages, `venues.html`, `test-*` pages, etc.). While `main.css` maps `.font-anton` to `font-family: 'Syne', ...`, relying on the `.font-anton` utility class name causes semantic confusion and clutters the codebase.

**Recommendation:**
Refactor the codebase to entirely remove references to `.font-anton`. Instead, use the `.font-display` utility class combined with specific text-shadow utilities or `.misprint` as defined in the style guide.

## 2. Component Review

### 2.1 Brutalist Cards
**Findings:**
The `index.html` implements the `.brutalist-card` pattern perfectly. However, there are leftover artifacts and naming inconsistencies in other areas:
- `venue-template.html` uses `.neo-card` for its main containers, which introduces a different border/shadow pattern (`box-shadow: 6px 6px 0 var(--color-purple);`) that strays slightly from the standard `.brutalist-card`.
- `main.css` contains classes like `.item-card` and `.feature-card` which implement blur backdrops (`backdrop-filter: blur(16px);`) and transparent borders. This directly conflicts with the Brutalist directive (solid borders, stark black backgrounds).

**Recommendation:**
Consolidate card styles. Remove `.item-card`, `.feature-card`, and `.neo-card`. Standardize on `.brutalist-card` (or specific variants of it) across all listing pages (Events, Venues) to maintain the harsh, high-contrast aesthetic.

### 2.2 Glassmorphism
**Findings:**
A search for "glass" confirmed that glassmorphic properties (e.g., `.glass-panel`) are still present in `clubs.html`, `birmingham-pride.html`, and `lgbtq-visual-integration-prototype.html`. Additionally, `main.css` retains several backdrop-blur rules for `.item-card`.

**Recommendation:**
Purge all remaining `.glass-panel` instances in public HTML files. Strip all `backdrop-filter` rules from `main.css`. Replace them with solid `#000` backgrounds and thick, high-contrast borders as per the manifesto.

### 2.3 Navigation & Footers
**Findings:**
- The Progress Pride gradient (`.progress-pride-bg`) is used effectively as a structural boundary in headers and footers.
- Mobile navigation relies on a full-screen black overlay overlaying the page. It functions correctly but lacks the brutalist flair (e.g., thick borders, misprint hover effects) seen on the desktop nav.

**Recommendation:**
Enhance the mobile menu by applying Brutalist hover interactions (e.g., scale adjustments, Toxic Lime underlines, or sticker-style buttons) to the mobile navigation links to match the desktop energy.

## 3. General "Housekeeping" & Anti-Patterns

### 3.1 "EST. [Year]" and "Built in Digbeth"
**Findings:**
- The codebase was audited for "Built in Digbeth", and thankfully, no instances were found.
- The codebase was audited for "EST.", and while some instances were found, they were generally within context (e.g., "Established in 1997" in the Style Guide) or unrelated test buttons (`TEST EST`). No footers contain incorrect copyright or "Built in" text. The footer correctly states `&copy; 2026 BRUM OUTLOUD.`.

**Recommendation:**
Continue to monitor templates during future development to ensure these specific phrases do not creep back in.

## 4. Accessibility & UX Suggestions

**Findings:**
- `main.css` includes excellent base accessibility rules (`.skip-link`, strong `:focus-visible` states, and `.sr-only` classes).
- Form inputs (`.punk-input`) have a clear focus state that changes the border color to `--color-toxic`.
- Contrast ratios for the primary palette (Light text `#f3e8ff` on Deep Void `#0D0115`) are very strong.

**Recommendation:**
- The Toxic Lime (`#CCFF00`) against pure white (`#FFF`) or light gray text can fail contrast ratio tests for smaller text sizes. Ensure Toxic Lime is primarily used as a background for black text (e.g., buttons) or as an accent border, rather than thin text on light backgrounds.

## Summary of Action Items

1. **CSS Variables:** Move all root color variables out of inline `<style>` tags in HTML files and strictly enforce them via `main.css`. Update the outdated hex codes in `promoter-submit-new.html`, `community.html`, and `all-venues.html`.
2. **Typography Cleanup:** Deprecate and replace the `.font-anton` class across all files. Standardize on `.font-display` and `.misprint`.
3. **Card Standardization:** Replace `.neo-card`, `.item-card`, and `.feature-card` with the established `.brutalist-card` component.
4. **Purge Glassmorphism:** Remove all remaining `.glass-panel` classes and `backdrop-filter` CSS rules to fully commit to the Brutalist aesthetic.
