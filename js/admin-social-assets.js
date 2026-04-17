// Social Assets Generator
// Fetches upcoming events and renders on-brand Instagram posts/stories
// client-side via html2canvas. ZIP bundling via JSZip.

import { getIdToken } from './auth-guard.js';

// Use the main public events endpoint (same one the site uses). Date-range
// filtering happens client-side against the normalized events list.
const EVENTS_ENDPOINT = '/.netlify/functions/get-events';

const state = {
    events: [],
    selectedIds: new Set(),
    activeId: null,
    preset: 'this-week',
    format: 'square',        // square | portrait | story
    template: 'sticker',     // sticker | card | lineup | highlight
    lineupTitle: 'This Week',
    lineupSlideIdx: 0,       // index into lineupSlides() for preview pager
    lineupHook: true,        // include a hook (cover) slide at the start
    lineupCta: true,         // include a CTA slide at the end
    cardTitle: 'This Week',  // title used on card-template Hook cover
    cardHook: false,         // include a hook cover in card-template batch ZIPs
    cardCta: false,          // include a CTA slide in card-template batch ZIPs
    highlightLabel: 'Tonight',
    highlightAccent: 'toxic', // toxic | pink | purple | pride
};

// Cap per page. Picked so 2-line titles never collide with the pride-bar
// footer at 1080×1920. If you bump this, re-check layout with 6 events
// that all have long titles + subs.
const LINEUP_MAX_ITEMS = 5;

// Enums — frozen so a typo in a dataset attribute or an opts arg is
// caught near the source rather than silently rendering the default
// template/format. Referenced by the validating assertions below.
const FORMATS    = Object.freeze({ SQUARE: 'square', PORTRAIT: 'portrait', STORY: 'story' });
const TEMPLATES  = Object.freeze({ STICKER: 'sticker', CARD: 'card', LINEUP: 'lineup', HIGHLIGHT: 'highlight' });
const SLIDE_KIND = Object.freeze({ HOOK: 'hook', PAGE: 'page', CTA: 'cta' });
const FORMAT_VALUES    = new Set(Object.values(FORMATS));
const TEMPLATE_VALUES  = new Set(Object.values(TEMPLATES));
const SLIDE_KIND_VALUES = new Set(Object.values(SLIDE_KIND));

// Templates that must render as 1080×1920 story
const STORY_ONLY_TEMPLATES = new Set([TEMPLATES.HIGHLIGHT]);
// Templates with a restricted set of allowed formats (square doesn't make
// sense for a vertical event list).
const TEMPLATE_ALLOWED_FORMATS = {
    [TEMPLATES.LINEUP]: new Set([FORMATS.PORTRAIT, FORMATS.STORY])
};
// Templates that aggregate multiple events instead of using the active one
const AGGREGATE_TEMPLATES = new Set([TEMPLATES.LINEUP]);
// Templates that don't need any event data at all
const EVENTLESS_TEMPLATES = new Set([TEMPLATES.HIGHLIGHT]);

// Suggested batch-title for each preset. Used to auto-update the lineup
// and card carousel titles when the range changes, unless the user has
// typed something custom.
const PRESET_TITLES = Object.freeze({
    'today':        'Tonight',
    'this-week':    'This Week',
    'this-weekend': 'This Weekend',
    'next-week':    'Next Week',
    'this-month':   'This Month',
    'next-30-days': 'Coming Up',
});

// Replace state[key] + its matching input.value with the new preset
// title, but only when the current value matches the PREVIOUS preset
// title — i.e. the user hasn't customised it since the last range
// change. Prevents silent stomps on custom titles.
function syncBatchTitle(stateKey, inputId, previousPresetTitle, newPresetTitle) {
    if (!previousPresetTitle) return;
    if (state[stateKey] !== previousPresetTitle) return;
    state[stateKey] = newPresetTitle;
    const input = document.getElementById(inputId);
    if (input) input.value = newPresetTitle;
}

// -- Event fetching ---------------------------------------------------------

async function fetchEvents() {
    const listEl = document.getElementById('event-list');
    const countEl = document.getElementById('event-count');
    listEl.innerHTML = `<div class="text-center py-10 opacity-50 text-sm">Loading events...</div>`;
    countEl.textContent = '—';

    try {
        const token = await getIdToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // Fetch a generous pool; client-side filter by preset window.
        const res = await fetch(`${EVENTS_ENDPOINT}?limit=200&includeAdult=true`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data.events || []);
        const normalized = raw.map(normalizeEvent).filter(Boolean);
        state.events = filterByPreset(normalized, state.preset);
    } catch (err) {
        console.error('Failed to load events:', err);
        listEl.innerHTML = `<div class="text-center py-10 text-sm text-red-400">Couldn't load events — ${err.message}</div>`;
        countEl.textContent = '—';
        // Make sure the download buttons are disabled — a failed fetch
        // leaves state.events empty and selectedIds cleared, but
        // updateDownloadButtons() still needs to run to flip the UI.
        state.events = [];
        state.selectedIds.clear();
        state.activeId = null;
        updateDownloadButtons();
        return;
    }

    countEl.textContent = `${state.events.length} event${state.events.length === 1 ? '' : 's'}`;
    renderEventList();
}

// Normalize a raw event from /get-events into the shape the templates expect.
function normalizeEvent(raw) {
    if (!raw || !raw.id) return null;
    const dateStr = raw.date || raw.Date;
    const d = dateStr ? new Date(dateStr) : null;
    // Only treat the source as having a real time-of-day if the string
    // includes a time portion (e.g. "T19:30") AND that time isn't midnight.
    // Date-only strings like "2025-04-17" become UTC midnight → 01:00 BST,
    // which we want to suppress entirely.
    const hasExplicitTime = typeof dateStr === 'string'
        && /T\d{2}:\d{2}/.test(dateStr)
        && !/T00:00(:00)?(\.\d+)?Z?$/.test(dateStr);
    const time = (d && !isNaN(d.getTime()) && hasExplicitTime)
        ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
    const venueName = (raw.venue && raw.venue.name)
        ? (Array.isArray(raw.venue.name) ? raw.venue.name[0] : raw.venue.name)
        : (raw.venueName || raw['Venue Name'] || '');
    const category = Array.isArray(raw.category)
        ? raw.category
        : (raw.category ? [raw.category] : (raw.categories || []));
    return {
        id: raw.id,
        name: raw.name || raw['Event Name'] || 'Untitled',
        date: dateStr,
        time,
        venue: { name: venueName },
        venueName,
        image: raw.image,
        category
    };
}

function filterByPreset(events, preset) {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    let from = new Date(start);
    let to = null;

    switch (preset) {
        case 'today': {
            to = new Date(start); to.setDate(to.getDate() + 1);
            break;
        }
        case 'this-week': {
            // Mon–Sun week containing today
            const dow = (start.getDay() + 6) % 7; // 0 = Mon
            from = new Date(start); from.setDate(from.getDate() - dow);
            to = new Date(from); to.setDate(to.getDate() + 7);
            break;
        }
        case 'this-weekend': {
            // Fri-start through Sun-end of this week
            const day = start.getDay(); // 0 Sun .. 6 Sat
            from = new Date(start);
            if (day === 0) {
                // Sunday: "this weekend" started Friday
                from.setDate(from.getDate() - 2);
            } else if (day >= 5) {
                from.setDate(from.getDate() - (day - 5));
            } else {
                from.setDate(from.getDate() + (5 - day));
            }
            to = new Date(from); to.setDate(to.getDate() + 3); // Fri, Sat, Sun
            break;
        }
        case 'next-week': {
            const dow = (start.getDay() + 6) % 7;
            from = new Date(start); from.setDate(from.getDate() - dow + 7);
            to = new Date(from); to.setDate(to.getDate() + 7);
            break;
        }
        case 'next-30-days': {
            to = new Date(start); to.setDate(to.getDate() + 30);
            break;
        }
        case 'this-month': {
            from = new Date(start.getFullYear(), start.getMonth(), 1);
            to = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            break;
        }
        default: {
            to = new Date(start); to.setDate(to.getDate() + 30);
        }
    }

    return events.filter(ev => {
        if (!ev.date) return false;
        const d = new Date(ev.date);
        if (isNaN(d.getTime())) return false;
        return d >= from && d < to;
    });
}

function renderEventList() {
    const listEl = document.getElementById('event-list');
    if (state.events.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 opacity-50 text-sm">No events in this range.</div>`;
        return;
    }

    listEl.innerHTML = '';
    state.events.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'event-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-pressed', state.selectedIds.has(ev.id) ? 'true' : 'false');
        if (state.selectedIds.has(ev.id)) row.classList.add('selected');
        if (state.activeId === ev.id) row.style.outline = '2px solid var(--color-pink)';

        const img = document.createElement('img');
        img.src = thumbUrl(ev);
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.crossOrigin = 'anonymous';
        row.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'flex-1 min-w-0';
        meta.innerHTML = `
            <div class="text-sm font-bold truncate" style="font-family:'Syne',sans-serif;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(ev.name)}</div>
            <div class="text-xs opacity-70 truncate">${escapeHtml(ev.venue?.name || '')}</div>
            <div class="text-[11px] opacity-50 mt-1">${formatEventDate(ev)}</div>
        `;
        row.appendChild(meta);

        const handleSelect = () => {
            // Plain click toggles selection. If selecting, also make active.
            // If unselecting the active event, promote another selected
            // event (or null) to active so the preview doesn't go stale.
            if (state.selectedIds.has(ev.id)) {
                state.selectedIds.delete(ev.id);
                if (state.activeId === ev.id) {
                    const next = state.events.find(e => state.selectedIds.has(e.id));
                    state.activeId = next ? next.id : null;
                }
            } else {
                state.selectedIds.add(ev.id);
                state.activeId = ev.id;
            }
            // Keep lineup pager in range after selection changes.
            const slides = lineupSlides();
            if (state.lineupSlideIdx >= slides.length) state.lineupSlideIdx = Math.max(0, slides.length - 1);
            renderEventList();
            renderPreview();
            updateDownloadButtons();
        };

        row.addEventListener('click', () => handleSelect());
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect();
            }
        });

        listEl.appendChild(row);
    });
}

// -- Image URL helpers ------------------------------------------------------

function thumbUrl(ev) {
    return toImageUrl(ev, 'w_200,h_200,c_fill,g_auto');
}
function heroUrl(ev, { format, saturate } = {}) {
    const fmt = format || state.format;
    let t;
    if (fmt === 'story')         t = 'w_1080,h_1920,c_fill,g_auto';
    else if (fmt === 'portrait') t = 'w_1080,h_1350,c_fill,g_auto';
    else                         t = 'w_1080,h_1080,c_fill,g_auto'; // square
    // Bake saturation into the Cloudinary transform when requested —
    // html2canvas drops CSS `filter` silently, so baking at fetch time
    // is the only way to keep the export matching the preview.
    if (saturate) t += ',e_saturation:10';
    return toImageUrl(ev, t);
}
function toImageUrl(ev, transform) {
    const raw = ev.image;
    if (!raw) return placeholder();
    if (typeof raw === 'object' && raw.url) return raw.url;
    if (typeof raw !== 'string') return placeholder();
    const m = raw.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
    if (m) {
        return `${m[1]}${transform}/${m[2].replace(/^[^/]+,[^/]+\//, '')}`;
    }
    return raw;
}
function placeholder() {
    return 'https://placehold.co/1080x1080/0d0115/f3e8ff?text=Brum+Outloud';
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function formatEventDate(ev) {
    if (!ev.date) return '';
    try {
        const d = new Date(ev.date);
        return d.toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short'
        }) + (ev.time ? ` • ${ev.time}` : '');
    } catch { return ''; }
}

function formatForAsset(ev) {
    if (!ev || !ev.date) return { day: 'TBC', dateLine: '', time: '' };
    const d = new Date(ev.date);
    const day = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateLine = d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long'
    });
    // Trust normalizeEvent — if it set ev.time to '' that means the source
    // date had no real time-of-day (and we'd get a phantom 01:00 BST from
    // a UTC-midnight reparse).
    return { day, dateLine, time: ev.time || '' };
}

// -- Preview rendering ------------------------------------------------------

function renderPreview() {
    const container = document.getElementById('preview-container');
    const meta = document.getElementById('preview-meta');
    const needsEvent = !EVENTLESS_TEMPLATES.has(state.template) && !AGGREGATE_TEMPLATES.has(state.template);
    const ev = state.events.find(e => e.id === state.activeId);

    if (needsEvent && !ev) {
        container.innerHTML = `<div class="opacity-50 text-sm p-16">Select an event to preview</div>`;
        meta.textContent = 'Select an event to preview';
        return;
    }

    let stageOpts = { format: state.format, template: state.template };
    if (state.template === 'lineup') {
        const slides = lineupSlides();
        const idx = Math.min(state.lineupSlideIdx, slides.length - 1);
        const slide = slides[idx] || { kind: 'page', page: [], idx: 0, total: 1 };
        stageOpts.lineupSlideKind = slide.kind;
        if (slide.kind === 'page') {
            stageOpts.lineupPageItems = slide.page;
            stageOpts.lineupPageIdx = slide.idx;
            stageOpts.lineupTotalPages = slide.total;
        }
    }
    const stage = buildStage(ev, stageOpts);
    container.innerHTML = '';
    container.appendChild(stage);

    // Scale the preview to fit available width (~520px target)
    const targetW = 520;
    const scale = targetW / stage.offsetWidth;
    stage.style.transform = `scale(${scale})`;
    container.style.width = `${stage.offsetWidth * scale}px`;
    container.style.height = `${stage.offsetHeight * scale}px`;

    const fmt = state.format === 'square' ? '1080×1080'
              : state.format === 'portrait' ? '1080×1350'
              : '1080×1920';
    let label;
    if (state.template === 'lineup') {
        const slides = lineupSlides();
        const idx = Math.min(state.lineupSlideIdx, slides.length - 1);
        const slide = slides[idx];
        const n = state.selectedIds.size;
        const slideName = slide?.kind === 'hook' ? 'Hook'
                        : slide?.kind === 'cta'  ? 'CTA'
                        : `Page ${(slide?.idx ?? 0) + 1}`;
        label = `${n} event${n === 1 ? '' : 's'} • ${slideName} (${idx + 1} / ${slides.length})`;
    } else if (state.template === 'highlight') {
        label = `"${state.highlightLabel}" highlight cover`;
    } else {
        label = ev ? ev.name : '';
    }
    meta.textContent = `${label} — ${fmt} • ${state.template}`;

    updateLineupPager();
}

function updateLineupPager() {
    const pager = document.getElementById('lineup-pager');
    if (!pager) return;
    if (state.template !== 'lineup') {
        pager.classList.add('hidden');
        return;
    }
    const slides = lineupSlides();
    if (slides.length <= 1) {
        pager.classList.add('hidden');
        return;
    }
    pager.classList.remove('hidden');
    const current = Math.min(state.lineupSlideIdx, slides.length - 1);
    const slide = slides[current];
    const name = slide.kind === 'hook' ? 'Hook'
              : slide.kind === 'cta'  ? 'CTA'
              : `Page ${slide.idx + 1}`;
    pager.querySelector('[data-pager-label]').textContent = `${name} (${current + 1} / ${slides.length})`;
    pager.querySelector('[data-pager-prev]').disabled = current === 0;
    pager.querySelector('[data-pager-next]').disabled = current >= slides.length - 1;
}

function buildStage(ev, opts = {}) {
    const format = opts.format || state.format;
    const template = opts.template || state.template;
    if (!FORMAT_VALUES.has(format))     throw new Error(`buildStage: unknown format "${format}"`);
    if (!TEMPLATE_VALUES.has(template)) throw new Error(`buildStage: unknown template "${template}"`);
    const stage = document.createElement('div');
    stage.className = `asset-stage ${format}`;
    if (format === FORMATS.STORY) stage.classList.add('safe-zone');

    if (template === TEMPLATES.LINEUP) {
        // Lineup dispatches by slide kind (hook / page / cta) so the
        // same buildStage drives preview, single export, and ZIP pages.
        const kind = opts.lineupSlideKind || SLIDE_KIND.PAGE;
        if (!SLIDE_KIND_VALUES.has(kind)) throw new Error(`buildStage: unknown slide kind "${kind}"`);
        if (kind === SLIDE_KIND.HOOK)     stage.appendChild(buildLineupHookTemplate({ format, titleOverride: opts.titleOverride, countOverride: opts.countOverride }));
        else if (kind === SLIDE_KIND.CTA) stage.appendChild(buildLineupCtaTemplate());
        else                              stage.appendChild(buildLineupTemplate({
            pageItems: opts.lineupPageItems,
            pageIdx: opts.lineupPageIdx,
            totalPages: opts.lineupTotalPages
        }));
        return stage;
    }

    switch (template) {
        case TEMPLATES.CARD:      stage.appendChild(buildCardTemplate(ev, { format })); break;
        case TEMPLATES.HIGHLIGHT: stage.appendChild(buildHighlightTemplate()); break;
        case TEMPLATES.STICKER:   stage.appendChild(buildStickerTemplate(ev, { format })); break;
        // No default — unknown templates already threw above; the lineup
        // case is handled in the pre-switch block.
    }
    return stage;
}

// DOM-based text measurer. Canvas 2D contexts don't automatically inherit
// loaded web fonts — setting `ctx.font = '800 108px "Syne"…'` silently
// falls back to sans-serif, which is much narrower than Syne, so the
// binary searches were picking sizes that overflow in the real DOM.
// A hidden span inherits the document's real font-face cache.
const SYNE_FONT = '800 16px "Syne", sans-serif';
const _measureEl = (() => {
    try {
        const el = document.createElement('span');
        // white-space: nowrap so multi-word strings measure as one line;
        // visibility: hidden keeps it out of the visible viewport but
        // still lets the browser lay it out (offsetWidth works).
        el.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;top:-9999px;left:-9999px;pointer-events:none;';
        document.body.appendChild(el);
        return el;
    } catch { return null; }
})();
function measureWidth(text, size) {
    if (!_measureEl) return null;
    _measureEl.style.font = `800 ${size}px "Syne", sans-serif`;
    _measureEl.textContent = text;
    return _measureEl.offsetWidth;
}

function fitHeadingSize(text, maxWidth = 960, maxSize = 160, minSize = 60) {
    if (!_measureEl) return maxSize;
    const txt = String(text || '').toUpperCase();
    if (!txt) return maxSize;
    // Binary-search the largest font-size where measured width ≤ maxWidth.
    let lo = minSize, hi = maxSize, best = minSize;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const w = measureWidth(txt, mid);
        if (w <= maxWidth) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }
    return best;
}

// Returns the full ordered list of slides for the current lineup:
// optional hook → 1+ event pages → optional CTA. If no events selected,
// hook/CTA still render (useful as standalone covers).
function lineupSlides() {
    const slides = [];
    if (state.lineupHook) slides.push({ kind: SLIDE_KIND.HOOK });
    const pages = lineupPages();
    pages.forEach((page, idx) => slides.push({ kind: SLIDE_KIND.PAGE, page, idx, total: pages.length }));
    if (pages.length === 0) {
        // Empty placeholder so the preview shows something useful
        slides.push({ kind: SLIDE_KIND.PAGE, page: [], idx: 0, total: 1 });
    }
    if (state.lineupCta) slides.push({ kind: SLIDE_KIND.CTA });
    return slides;
}

function lineupPages() {
    // Order selected events by date, then chunk into pages of LINEUP_MAX_ITEMS.
    const selected = state.events
        .filter(e => state.selectedIds.has(e.id))
        .slice()
        .sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : Infinity;
            const db = b.date ? new Date(b.date).getTime() : Infinity;
            return da - db;
        });
    const pages = [];
    for (let i = 0; i < selected.length; i += LINEUP_MAX_ITEMS) {
        pages.push(selected.slice(i, i + LINEUP_MAX_ITEMS));
    }
    return pages;
}

function buildLineupTemplate(opts = {}) {
    // Aggregate template — reads current state but always invoked
    // synchronously during preview / export click, so no async drift.
    const frag = document.createDocumentFragment();
    const pages = lineupPages();
    const pageIdx = opts.pageIdx != null ? opts.pageIdx : 0;
    const shown = opts.pageItems || pages[pageIdx] || [];
    const totalPages = opts.totalPages != null ? opts.totalPages : pages.length;

    const tpl = document.createElement('div');
    tpl.className = 'tpl-lineup';
    tpl.innerHTML = `
        <div class="halftone"></div>
        ${totalPages > 1 ? `<div class="page-marker">${pageIdx + 1} / ${totalPages}</div>` : ''}
        <div class="header">
            <div class="kicker">BRUM OUTLOUD</div>
            <div class="heading" style="font-size:${fitHeadingSize(state.lineupTitle || 'This Week')}px">${escapeHtml(state.lineupTitle || 'This Week')}</div>
        </div>
        <div class="list">
            ${shown.map(ev => {
                const d = ev.date ? new Date(ev.date) : null;
                const day = d ? d.toLocaleDateString('en-GB', { day: '2-digit' }) : '—';
                const mon = d ? d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '';
                const time = ev.time || ''; // empty when source had no real time
                return `
                    <div class="item">
                        <div class="daybox">
                            <div class="d">${escapeHtml(day)}</div>
                            <div class="m">${escapeHtml(mon)}</div>
                        </div>
                        <div class="body">
                            <div class="title">${escapeHtml(ev.name)}</div>
                            <div class="sub">${escapeHtml(ev.venue?.name || '')}${time ? ' • ' + escapeHtml(time) : ''}</div>
                        </div>
                    </div>
                `;
            }).join('')}
            ${shown.length === 0 ? `<div class="overflow-pill" style="color:var(--color-light);opacity:0.6;">Select events on the left →</div>` : ''}
        </div>
        <div class="footer">
            <div class="footer-inner">
                <span class="cta">See more →</span>
                <span class="url">brumoutloud.co.uk</span>
            </div>
        </div>
        <div class="pride-bar"></div>
    `;
    frag.appendChild(tpl);
    return frag;
}

// Pretty label for the date range (used as hook subtitle)
function lineupRangeLabel() {
    const map = {
        'today': 'Tonight',
        'this-week': 'This Week',
        'this-weekend': 'This Weekend',
        'next-week': 'Next Week',
        'this-month': 'This Month',
        'next-30-days': 'The Next 30 Days'
    };
    return map[state.preset] || 'Coming Up';
}

function buildLineupHookTemplate({ format, titleOverride, countOverride } = {}) {
    const frag = document.createDocumentFragment();
    const title = titleOverride || state.lineupTitle || lineupRangeLabel();
    // 48px floor so long compound titles ("Wknd Highlights") can shrink;
    // the CSS word-break net catches anything still too wide.
    const fontSize = fitHeadingSize(title, 940, format === 'story' ? 220 : 200, 48);
    // Count from the actual pages that will render — not selectedIds —
    // so the cover copy can never drift from what's in the carousel.
    const count = typeof countOverride === 'number'
        ? countOverride
        : lineupPages().reduce((n, p) => n + p.length, 0);
    // Sub line says exactly what's inside the carousel — no jargon.
    const sub = count > 0
        ? `${count} queer event${count === 1 ? '' : 's'} to know about ↓`
        : 'Queer events across Birmingham ↓';

    const tpl = document.createElement('div');
    tpl.className = 'tpl-lineup-hook';
    tpl.innerHTML = `
        <div class="halftone"></div>
        <div class="kicker">BRUM OUTLOUD</div>
        <div class="heading" style="font-size:${fontSize}px">${escapeHtml(title)}</div>
        <div class="sub">${escapeHtml(sub)}</div>
        <div class="swipe">SWIPE →</div>
        <div class="pride-bar"></div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function buildLineupCtaTemplate() {
    const frag = document.createDocumentFragment();
    const tpl = document.createElement('div');
    tpl.className = 'tpl-lineup-cta';
    // CTA does two jobs: (1) point people at the site for the full
    // listings, (2) prompt the IG actions that boost reach. Each chip
    // has an icon so the action is unmistakable.
    tpl.innerHTML = `
        <div class="halftone"></div>
        <div class="kicker">FOR THE FULL LISTINGS</div>
        <div class="heading">Visit<br>the site</div>
        <div class="url">brumoutloud.co.uk</div>
        <div class="sub">Hundreds of events. Updated daily.</div>
        <div class="actions">
            <span class="chip"><i class="fas fa-bookmark"></i> Save for later</span>
            <span class="chip"><i class="fas fa-paper-plane"></i> Send to a mate</span>
        </div>
        <div class="organiser">
            <div class="organiser-kicker">Run a venue or event?</div>
            <div class="organiser-line">List it free &rarr; brumoutloud.co.uk/submit</div>
        </div>
        <div class="pride-bar"></div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function buildHighlightTemplate() {
    const frag = document.createDocumentFragment();
    const label = (state.highlightLabel || 'Tonight').trim();
    const sizeClass = label.length > 10 ? 'very-long'
                    : label.length > 7  ? 'long'
                    : '';

    const tpl = document.createElement('div');
    tpl.className = 'tpl-highlight';
    tpl.innerHTML = `
        <div class="halftone"></div>
        <div class="ring"></div>
        <div class="badge-offset"></div>
        <div class="badge-outline"></div>
        <div class="badge acc-${escapeHtml(state.highlightAccent)}">
            <div class="label-text ${sizeClass}">${escapeHtml(label)}</div>
        </div>
        <div class="corner-sticker">Brum<br>Out Loud</div>
        <div class="brandmark">BRUMOUTLOUD.CO.UK</div>
    `;
    frag.appendChild(tpl);
    return frag;
}

// Calendar + venue meta row — shared between sticker and card templates.
function eventMetaRow(ev) {
    const { dateLine, time } = formatForAsset(ev);
    return `
        <div class="meta">
            <div><i class="fas fa-calendar"></i>${escapeHtml(dateLine)}${time ? ' • ' + escapeHtml(time) : ''}</div>
            <div><i class="fas fa-location-dot"></i>${escapeHtml(ev.venue?.name || 'Birmingham')}</div>
        </div>
    `;
}

function buildStickerTemplate(ev, opts = {}) {
    const frag = document.createDocumentFragment();
    const { day } = formatForAsset(ev);

    const tpl = document.createElement('div');
    tpl.className = 'tpl-sticker';
    tpl.style.position = 'absolute';
    tpl.style.inset = '0';
    tpl.innerHTML = `
        <div class="bg-img" style="background-image:url('${heroUrl(ev, { ...opts, saturate: true })}')"></div>
        <div class="overlay"></div>
        <div class="top-sticker">${escapeHtml(primaryCategory(ev))}</div>
        <div class="date-pill">${escapeHtml(day)}</div>
        <div class="bottom-block">
            <div class="title">${escapeHtml(ev.name)}</div>
            ${eventMetaRow(ev)}
        </div>
        <div class="brand">BRUMOUTLOUD.CO.UK</div>
        <div class="footer-bar"></div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function buildCardTemplate(ev, opts = {}) {
    const frag = document.createDocumentFragment();
    const { day } = formatForAsset(ev);
    const format = opts.format || state.format;
    // Card inner content width = stage 1080 - card offset 60 left/right
    // - card padding 60 left/right = 840. Cap font-size at the format's
    // original default (108 for square/portrait, 140 for story).
    const maxSize = format === 'story' ? 140 : 108;
    const titleSize = fitCardTitleSize(ev.name, 840, maxSize, 56);

    const tpl = document.createElement('div');
    tpl.className = 'tpl-card';
    tpl.innerHTML = `
        <div class="halftone"></div>
        <div class="watermark">BRUM</div>
        <div class="card-shadow"></div>
        <div class="card">
            <div class="kicker">${escapeHtml(day)} • ${escapeHtml(primaryCategory(ev))}</div>
            <div class="title" style="font-size:${titleSize}px"><span class="title-inner">${escapeHtml(ev.name)}</span></div>
            <div class="event-img-wrap">
                <div class="event-img-shadow"></div>
                <div class="event-img" style="background-image:url('${heroUrl(ev, opts)}')"></div>
            </div>
            ${eventMetaRow(ev)}
            <div class="brand-bar">
                <span>Brum Out Loud</span>
                <span class="url">/events</span>
            </div>
        </div>
    `;
    frag.appendChild(tpl);
    return frag;
}

// Pick the largest font-size where (a) the longest word still fits
// maxWidth on its own line AND (b) greedy-wrapping all words into lines
// produces ≤ maxLines. Without the line-count constraint, long titles
// like "SUM TING WONG AT EDEN SUNDAY CLUB" wrap to 5 lines at 108px
// and push the flyer + meta off the bottom of the card.
function fitCardTitleSize(text, maxWidth = 840, maxSize = 108, minSize = 48, maxLines = 3) {
    if (!_measureEl) return maxSize;
    const words = String(text || '').toUpperCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return maxSize;
    const longest = words.reduce((a, b) => (a.length >= b.length ? a : b));

    const linesAt = size => {
        // Measure a joined-with-NBSP string and rely on the greedy wrap
        // algorithm below. We need per-word widths.
        const spaceW = measureWidth('\u00A0', size);
        let lines = 1, lineW = 0;
        for (const word of words) {
            const wW = measureWidth(word, size);
            const gap = lineW === 0 ? 0 : spaceW;
            if (lineW + gap + wW <= maxWidth) lineW += gap + wW;
            else { lines++; lineW = wW; }
        }
        return lines;
    };

    let lo = minSize, hi = maxSize, best = minSize;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const longestW = measureWidth(longest, mid);
        const fits = longestW <= maxWidth && linesAt(mid) <= maxLines;
        if (fits) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }
    return best;
}

function primaryCategory(ev) {
    if (!ev) return 'Tonight';
    const cats = Array.isArray(ev.category) ? ev.category : (ev.category ? [ev.category] : []);
    return (cats[0] || 'Tonight').toString();
}

// -- PNG / ZIP export -------------------------------------------------------

// Canonical output size per format. Pulled from the stage's format class
// so we always match the visible CSS dimensions and never trust
// offsetWidth/offsetHeight (off-screen layout can underreport).
function canvasDimsFor(stage) {
    if (stage.classList.contains('story'))    return { w: 1080, h: 1920 };
    if (stage.classList.contains('portrait')) return { w: 1080, h: 1350 };
    return { w: 1080, h: 1080 }; // square
}

// Shared render path for both per-event and aggregate (lineup / highlight /
// hook / cta) stages. Builds the stage off-screen, preloads images, runs
// html2canvas with pinned dimensions, cleans up, and returns a PNG blob.
// Rejects rather than returning null on toBlob failure so callers can
// record the failed item instead of crashing the whole batch.
async function stageToBlob(ev, { format, template, ...extra } = {}) {
    const off = document.createElement('div');
    off.style.position = 'fixed';
    off.style.left = '-20000px';
    off.style.top = '0';
    off.style.zIndex = '-1';
    document.body.appendChild(off);

    try {
        const stage = buildStage(ev, { format, template, ...extra });
        stage.classList.add('hide-safe-zone');
        // Inline the brand bg so html2canvas has a solid colour to fall
        // back on if CSS-var resolution misfires off-screen.
        stage.style.backgroundColor = '#0D0115';
        off.appendChild(stage);

        await waitForImages(stage);

        // Pin canvas dimensions to the canonical CSS size rather than
        // offsetWidth/offsetHeight — off-screen layout can underreport by
        // a few px and produce a letterbox border around the rendered card.
        const dims = canvasDimsFor(stage);
        const canvas = await html2canvas(stage, {
            backgroundColor: '#0D0115',
            useCORS: true,
            allowTaint: false,
            scale: 1,
            width: dims.w,
            height: dims.h,
            windowWidth: dims.w,
            windowHeight: dims.h,
            logging: false,
        });

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png');
        });
        return blob;
    } finally {
        off.remove();
    }
}

async function renderEventToBlob(ev, format, template) {
    return stageToBlob(ev, { format, template });
}

// Module-level cache of url -> dataUrl so the same hero image doesn't get
// re-fetched + re-encoded on every preview / single / batch render. Keyed
// on the already-transformed Cloudinary URL so different format variants
// stay separate.
const _imageDataUrlCache = new Map();

async function urlToDataUrl(url) {
    if (_imageDataUrlCache.has(url)) return _imageDataUrlCache.get(url);
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // An opaque response (SW served with no-cors) gives a 0-byte blob that
    // would render as a blank hero in the exported PNG — reject here and
    // let the caller fall back to the Image-warming path.
    if (res.type === 'opaque' || res.type === 'opaqueredirect') {
        throw new Error('Opaque response');
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error('Empty blob');
    const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
    _imageDataUrlCache.set(url, dataUrl);
    return dataUrl;
}

// Rewrite each background-image url() to a data URL so html2canvas never
// touches a remote URL at capture time. If the fetch fails (CDN down,
// opaque SW response, offline) fall back to warming the browser HTTP
// cache and let html2canvas' own loader try.
async function waitForImages(root) {
    const bgEls = root.querySelectorAll('.bg-img, .event-img');
    await Promise.all([...bgEls].map(async el => {
        const m = el.style.backgroundImage.match(/url\(["']?([^"')]+)/);
        const url = m && m[1];
        if (!url || url.startsWith('data:')) return;
        try {
            const dataUrl = await urlToDataUrl(url);
            el.style.backgroundImage = `url("${dataUrl}")`;
        } catch (err) {
            console.warn('Image preload failed, falling back:', url, err.message);
            await new Promise(resolve => {
                const im = new Image();
                im.crossOrigin = 'anonymous';
                im.onload = im.onerror = () => resolve();
                im.src = url;
            });
        }
    }));
}

function slugify(s) {
    return String(s || 'event').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function fileNameFor(ev, format, template) {
    // Match the batch-ZIP naming convention: slug-template-format.png.
    // Single-event downloads aren't numbered (no carousel ordering needed).
    return `${slugify(ev.name)}-${template}-${format}.png`;
}

// Translate a lineupSlides() entry into the buildStage opts shape
function slideOptsFor(slide) {
    if (!slide) return { lineupSlideKind: SLIDE_KIND.PAGE };
    if (slide.kind === SLIDE_KIND.HOOK) return { lineupSlideKind: SLIDE_KIND.HOOK };
    if (slide.kind === SLIDE_KIND.CTA)  return { lineupSlideKind: SLIDE_KIND.CTA };
    return {
        lineupSlideKind: SLIDE_KIND.PAGE,
        lineupPageItems: slide.page,
        lineupPageIdx: slide.idx,
        lineupTotalPages: slide.total
    };
}

async function downloadSingle() {
    const btn = document.getElementById('download-single');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Rendering…';
    try {
        let blob, filename;
        if (state.template === 'lineup') {
            const slides = lineupSlides();
            if (slides.length > 1) {
                // Multi-slide carousel: ZIP with one PNG per slide,
                // ordered hook → pages → cta.
                const zip = new JSZip();
                const titleSlug = slugify(state.lineupTitle || 'lineup');
                for (let i = 0; i < slides.length; i++) {
                    const s = slides[i];
                    const tag = s.kind === 'hook' ? 'hook'
                              : s.kind === 'cta'  ? 'cta'
                              : `page-${String(s.idx + 1).padStart(2, '0')}`;
                    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Slide ${i + 1}/${slides.length}`;
                    const slideBlob = await renderAggregateToBlob(state.format, state.template, slideOptsFor(s));
                    // Same naming scheme as the card batch: nn-slug-template-format.png
                    // so Finder / IG carousel uploads sort correctly in one glance.
                    const prefix = String(i + 1).padStart(2, '0');
                    zip.file(`${prefix}-${titleSlug}-${tag}-lineup-${state.format}.png`, slideBlob);
                }
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Packaging…';
                blob = await zip.generateAsync({ type: 'blob' });
                filename = `brum-outloud-lineup-${slugify(state.lineupTitle)}.zip`;
            } else {
                blob = await renderAggregateToBlob(state.format, state.template, slideOptsFor(slides[0]));
                filename = `brum-outloud-lineup-${slugify(state.lineupTitle)}.png`;
            }
        } else if (state.template === 'highlight') {
            blob = await renderAggregateToBlob(state.format, state.template);
            filename = `brum-outloud-highlight-${slugify(state.highlightLabel)}-${state.highlightAccent}.png`;
        } else {
            const ev = state.events.find(e => e.id === state.activeId);
            if (!ev) return;
            blob = await renderEventToBlob(ev, state.format, state.template);
            filename = fileNameFor(ev, state.format, state.template);
        }
        triggerDownload(blob, filename);
    } catch (err) {
        console.error(err);
        alert(`Render failed: ${err.message}`);
    } finally {
        btn.disabled = false;
        updateDownloadButtons();
    }
}

async function downloadBatch() {
    if (AGGREGATE_TEMPLATES.has(state.template) || EVENTLESS_TEMPLATES.has(state.template)) return;
    const selected = state.events.filter(e => state.selectedIds.has(e.id));
    if (selected.length === 0) return;
    const btn = document.getElementById('download-batch');
    btn.disabled = true;
    const zip = new JSZip();
    // Snapshot format/template at click time — avoids mid-batch drift if user
    // clicks another control while we iterate.
    const fmt = state.format;
    const tpl = state.template;

    // Task order: optional hook (00-) → one per event (01..NN-) → optional
    // CTA (99-). The numeric prefix makes ZIP alphabetical sort match
    // carousel display order so "unzip → drag into IG" works in one pass.
    const includeHook = tpl === TEMPLATES.CARD && state.cardHook;
    const includeCta  = tpl === TEMPLATES.CARD && state.cardCta;
    const tasks = [];
    if (includeHook) tasks.push({ kind: SLIDE_KIND.HOOK, prefix: '00' });
    selected.forEach((ev, i) => tasks.push({
        kind: 'event',
        ev,
        prefix: String(i + 1).padStart(2, '0'),
    }));
    if (includeCta) tasks.push({ kind: SLIDE_KIND.CTA, prefix: '99' });

    const failures = [];
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${i + 1}/${tasks.length}`;
        try {
            let blob, name;
            if (task.kind === 'event') {
                blob = await renderEventToBlob(task.ev, fmt, tpl);
                name = `${task.prefix}-${slugify(task.ev.name)}-${tpl}-${fmt}.png`;
            } else {
                // Reuse the lineup hook/cta slide designs — format-aware
                // and brand-tight. Override title + count so the cover
                // reflects the batch rather than lineup state.
                blob = await renderAggregateToBlob(fmt, 'lineup', {
                    lineupSlideKind: task.kind,
                    titleOverride: state.cardTitle,
                    countOverride: selected.length
                });
                name = `${task.prefix}-${task.kind}-${tpl}-${fmt}.png`;
            }
            zip.file(name, blob);
        } catch (err) {
            const label = task.kind === 'event' ? task.ev.name : task.kind;
            console.error(`Failed to render ${label}:`, err);
            failures.push({ label, error: err.message || String(err) });
        }
    }
    // Include a manifest of any renders that failed so the user isn't
    // surprised by a silently-short ZIP.
    if (failures.length > 0) {
        const report = failures.map(f => `- ${f.label}: ${f.error}`).join('\n');
        zip.file('FAILED.txt', `${failures.length} slide(s) failed to render:\n\n${report}\n`);
    }
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Packaging…';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipTitle = tpl === 'card' ? slugify(state.cardTitle || 'batch') : tpl;
    triggerDownload(zipBlob, `brum-outloud-${zipTitle}-${fmt}-${tpl}.zip`);
    if (failures.length > 0) {
        alert(`${failures.length} slide(s) failed — see FAILED.txt in the ZIP.`);
    }
    btn.disabled = false;
    updateDownloadButtons();
}

async function renderAggregateToBlob(format, template, extra = {}) {
    return stageToBlob(null, { format, template, ...extra });
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateDownloadButtons() {
    const singleBtn = document.getElementById('download-single');
    const batchBtn = document.getElementById('download-batch');

    // Batch button is only meaningful for the single-event templates
    // with multiple events selected. Lineup and Highlight produce their
    // own outputs from the single button, so hide batch in those modes.
    batchBtn.classList.add('hidden');
    batchBtn.disabled = true;

    if (state.template === 'lineup') {
        const slides = lineupSlides();
        // Even with zero events we let the user export hook+cta as covers.
        singleBtn.disabled = slides.length === 0;
        singleBtn.innerHTML = slides.length > 1
            ? `<i class="fas fa-file-archive mr-2"></i> Download Carousel ZIP (${slides.length} slides)`
            : `<i class="fas fa-download mr-2"></i> Download Slide`;
    } else if (state.template === 'highlight') {
        singleBtn.disabled = !(state.highlightLabel || '').trim();
        singleBtn.innerHTML = '<i class="fas fa-download mr-2"></i> Download Cover PNG';
    } else {
        singleBtn.disabled = !state.activeId;
        singleBtn.innerHTML = '<i class="fas fa-download mr-2"></i> Download PNG';
        const count = state.selectedIds.size;
        // Only surface the ZIP button when there's something worth zipping
        // (≥2 events). A "ZIP (1)" of a single PNG is confusing, and the
        // empty-state label "Download ZIP (1)" looked like a bug.
        if (count >= 2) {
            batchBtn.classList.remove('hidden');
            batchBtn.disabled = false;
            batchBtn.innerHTML = `<i class="fas fa-file-archive mr-2"></i> Download ZIP (${count})`;
        }
    }
}

function syncTemplateOptions() {
    const lineup = document.getElementById('lineup-options');
    const highlight = document.getElementById('highlight-options');
    const card = document.getElementById('card-options');
    lineup.classList.toggle('hidden', state.template !== 'lineup');
    highlight.classList.toggle('hidden', state.template !== 'highlight');
    if (card) card.classList.toggle('hidden', state.template !== 'card');

    const storyOnly = STORY_ONLY_TEMPLATES.has(state.template);
    const allowed = TEMPLATE_ALLOWED_FORMATS[state.template];
    // Hide (don't just dim) disallowed formats. Dimmed buttons looked
    // clickable enough that testers thought clicks were silently dropped
    // instead of forbidden — an opacity-0.4 button is indistinguishable
    // from a hover state for anyone not in DevTools.
    let visibleCount = 0;
    document.querySelectorAll('#format-controls button').forEach(b => {
        const fmt = b.dataset.format;
        let hidden = false;
        if (storyOnly) hidden = fmt !== 'story';
        else if (allowed) hidden = !allowed.has(fmt);
        b.disabled = hidden;
        b.classList.toggle('hidden', hidden);
        if (!hidden) visibleCount++;
    });
    // Hide the entire format selector when there's only one valid choice
    // — no value in showing a one-button "selector".
    const controls = document.getElementById('format-controls');
    const wrapper = controls.closest('[data-format-wrapper]') || controls;
    wrapper.classList.toggle('hidden', visibleCount <= 1);
}

// -- Wire-up ----------------------------------------------------------------

function wireControls() {
    document.getElementById('range-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-preset]');
        if (!btn) return;
        const previousPreset = state.preset;
        state.preset = btn.dataset.preset;
        state.selectedIds.clear();
        state.activeId = null;
        state.lineupSlideIdx = 0;
        // Sync batch titles to the new preset only if the user hasn't
        // customised them — detected by comparing against the *previous*
        // preset's label, not any known preset value (so a user who types
        // "Tonight" keeps it even when they switch between ranges).
        const previousMatch = PRESET_TITLES[previousPreset] || '';
        const matchedTitle  = PRESET_TITLES[state.preset];
        if (matchedTitle) {
            syncBatchTitle('lineupTitle', 'lineup-title', previousMatch, matchedTitle);
            syncBatchTitle('cardTitle',   'card-title',   previousMatch, matchedTitle);
        }
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        fetchEvents();
        updateDownloadButtons();
    });

    document.getElementById('format-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-format]');
        if (!btn || btn.disabled) return;
        if (!FORMAT_VALUES.has(btn.dataset.format)) {
            console.warn(`Ignoring unknown format "${btn.dataset.format}"`);
            return;
        }
        state.format = btn.dataset.format;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        renderPreview();
    });

    document.getElementById('template-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-template]');
        if (!btn) return;
        if (!TEMPLATE_VALUES.has(btn.dataset.template)) {
            console.warn(`Ignoring unknown template "${btn.dataset.template}"`);
            return;
        }
        state.template = btn.dataset.template;
        [...e.currentTarget.querySelectorAll('button[data-template]')].forEach(
            b => b.classList.toggle('active', b === btn)
        );
        if (btn.dataset.forceFormat) {
            state.format = btn.dataset.forceFormat;
            document.querySelectorAll('#format-controls button').forEach(
                b => b.classList.toggle('active', b.dataset.format === state.format)
            );
        }
        syncTemplateOptions();
        renderPreview();
        updateDownloadButtons();
    });

    document.getElementById('lineup-title').addEventListener('input', e => {
        state.lineupTitle = e.target.value;
        if (state.template === 'lineup') renderPreview();
    });

    // Lineup pager (prev / next) — cycles through hook + pages + cta
    document.getElementById('lineup-pager').addEventListener('click', e => {
        const prev = e.target.closest('[data-pager-prev]');
        const next = e.target.closest('[data-pager-next]');
        if (!prev && !next) return;
        const slides = lineupSlides();
        if (slides.length <= 1) return;
        const cur = Math.min(state.lineupSlideIdx, slides.length - 1);
        if (prev && cur > 0) state.lineupSlideIdx = cur - 1;
        if (next && cur < slides.length - 1) state.lineupSlideIdx = cur + 1;
        renderPreview();
    });

    // Hook / CTA toggles
    document.getElementById('lineup-hook').addEventListener('change', e => {
        state.lineupHook = e.target.checked;
        state.lineupSlideIdx = 0;
        if (state.template === 'lineup') {
            renderPreview();
            updateDownloadButtons();
        }
    });
    document.getElementById('lineup-cta').addEventListener('change', e => {
        state.lineupCta = e.target.checked;
        state.lineupSlideIdx = 0;
        if (state.template === 'lineup') {
            renderPreview();
            updateDownloadButtons();
        }
    });

    // Brutalist Card Hook / CTA / title toggles. Only affect the batch
    // ZIP — single-event downloads stay unchanged.
    const cardTitleEl = document.getElementById('card-title');
    if (cardTitleEl) {
        cardTitleEl.addEventListener('input', e => {
            state.cardTitle = e.target.value;
        });
    }
    const cardHookEl = document.getElementById('card-hook');
    if (cardHookEl) {
        cardHookEl.addEventListener('change', e => { state.cardHook = e.target.checked; });
    }
    const cardCtaEl = document.getElementById('card-cta');
    if (cardCtaEl) {
        cardCtaEl.addEventListener('change', e => { state.cardCta = e.target.checked; });
    }

    document.getElementById('highlight-label').addEventListener('input', e => {
        state.highlightLabel = e.target.value;
        if (state.template === 'highlight') {
            renderPreview();
            updateDownloadButtons();
        }
    });

    document.getElementById('highlight-accent').addEventListener('click', e => {
        const btn = e.target.closest('button[data-accent]');
        if (!btn) return;
        state.highlightAccent = btn.dataset.accent;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        if (state.template === 'highlight') renderPreview();
    });

    document.getElementById('download-single').addEventListener('click', downloadSingle);
    document.getElementById('download-batch').addEventListener('click', downloadBatch);

    document.getElementById('select-all-btn').addEventListener('click', () => {
        if (state.events.length === 0) return;
        state.events.forEach(ev => state.selectedIds.add(ev.id));
        if (!state.activeId) state.activeId = state.events[0].id;
        state.lineupSlideIdx = 0;
        renderEventList();
        renderPreview();
        updateDownloadButtons();
    });

    document.getElementById('clear-selection-btn').addEventListener('click', () => {
        state.selectedIds.clear();
        state.activeId = null;
        state.lineupSlideIdx = 0;
        renderEventList();
        renderPreview();
        updateDownloadButtons();
    });
}

wireControls();
fetchEvents();

// Re-render any existing preview once web fonts settle. Before Syne is
// loaded, measureWidth() returns fallback-sans widths which makes the
// first pass of fitCardTitleSize / fitHeadingSize pick sizes that are
// too large. Once fonts are ready, retrigger the preview so inline
// font-size attributes are recomputed against the real font metrics.
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
        try { renderPreview(); } catch {}
    });
}

// -- External automation surface --------------------------------------------
// Exposed so headless agents (Claude Code, Cowork, etc.) can capture any
// slide without triggering a browser download. Returns a PNG Blob.
//
// Usage:
//   const blob = await window.renderSlide(eventId, 'card', 'portrait');
//
// Aggregate templates (lineup, highlight) ignore eventId — pass null.
// For fully-headless lineup capture, pass opts to avoid depending on UI
// selection state:
//   { eventIds: [...], title, lineupHook, lineupCta, slideIdx }
window.renderSlide = async function renderSlide(eventId, template, format, opts = {}) {
    const tpl = template || state.template;
    const fmt = format || state.format;

    if (tpl === 'lineup') {
        // Callers that supply eventIds explicitly get a headless lineup
        // that doesn't require the UI to be in a particular selection.
        // Preserve live state and restore it after rendering.
        const headless = Array.isArray(opts.eventIds);
        const snapshot = headless ? {
            selectedIds: new Set(state.selectedIds),
            lineupHook: state.lineupHook,
            lineupCta: state.lineupCta,
            lineupTitle: state.lineupTitle,
        } : null;
        try {
            if (headless) {
                state.selectedIds = new Set(opts.eventIds);
                if (opts.lineupHook != null) state.lineupHook = !!opts.lineupHook;
                if (opts.lineupCta  != null) state.lineupCta  = !!opts.lineupCta;
                if (opts.title != null)      state.lineupTitle = String(opts.title);
            }
            const slides = lineupSlides();
            if (slides.length === 0) {
                throw new Error('renderSlide: no lineup slides — select events or pass eventIds');
            }
            const idx = Math.min(Math.max(opts.slideIdx ?? 0, 0), slides.length - 1);
            return await renderAggregateToBlob(fmt, tpl, slideOptsFor(slides[idx]));
        } finally {
            if (snapshot) Object.assign(state, snapshot);
        }
    }

    if (AGGREGATE_TEMPLATES.has(tpl)) {
        return await renderAggregateToBlob(fmt, tpl, opts);
    }

    if (EVENTLESS_TEMPLATES.has(tpl)) {
        return await renderAggregateToBlob(fmt, tpl);
    }

    // Per-event templates. Fall back to the active event when eventId is
    // null so quick DevTools captures don't require an ID lookup.
    const id = eventId || state.activeId;
    const ev = state.events.find(e => e.id === id);
    if (!ev) throw new Error(`renderSlide: event "${eventId}" not found`);
    return await renderEventToBlob(ev, fmt, tpl);
};
