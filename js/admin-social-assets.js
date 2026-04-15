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
    lineupPage: 0,           // which page to show when selection > MAX_ITEMS
    highlightLabel: 'Tonight',
    highlightAccent: 'toxic', // toxic | pink | purple | pride
};

// Cap per page. Picked so 2-line titles never collide with the pride-bar
// footer at 1080×1920. If you bump this, re-check layout with 6 events
// that all have long titles + subs.
const LINEUP_MAX_ITEMS = 5;

// Templates that must render as 1080×1920 story
const STORY_ONLY_TEMPLATES = new Set(['lineup', 'highlight']);
// Templates that aggregate multiple events instead of using the active one
const AGGREGATE_TEMPLATES = new Set(['lineup']);
// Templates that don't need any event data at all
const EVENTLESS_TEMPLATES = new Set(['highlight']);

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
            const pages = lineupPages();
            if (state.lineupPage >= pages.length) state.lineupPage = Math.max(0, pages.length - 1);
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
function heroUrl(ev, { format } = {}) {
    const fmt = format || state.format;
    let t;
    if (fmt === 'story')         t = 'w_1080,h_1920,c_fill,g_auto';
    else if (fmt === 'portrait') t = 'w_1080,h_1350,c_fill,g_auto';
    else                         t = 'w_1080,h_1080,c_fill,g_auto'; // square
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

    const stage = buildStage(ev, { format: state.format, template: state.template });
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
        const pages = lineupPages();
        const n = state.selectedIds.size;
        label = `${n} event${n === 1 ? '' : 's'} in lineup` +
            (pages.length > 1 ? ` • page ${Math.min(state.lineupPage, pages.length - 1) + 1} of ${pages.length}` : '');
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
    const pages = lineupPages();
    if (pages.length <= 1) {
        pager.classList.add('hidden');
        return;
    }
    pager.classList.remove('hidden');
    const current = Math.min(state.lineupPage, pages.length - 1);
    pager.querySelector('[data-pager-label]').textContent = `Page ${current + 1} / ${pages.length}`;
    pager.querySelector('[data-pager-prev]').disabled = current === 0;
    pager.querySelector('[data-pager-next]').disabled = current >= pages.length - 1;
}

function buildStage(ev, opts = {}) {
    const format = opts.format || state.format;
    const template = opts.template || state.template;
    const stage = document.createElement('div');
    stage.className = `asset-stage ${format}`;
    if (format === 'story') stage.classList.add('safe-zone');

    switch (template) {
        case 'card':      stage.appendChild(buildCardTemplate(ev, { format })); break;
        case 'lineup':    stage.appendChild(buildLineupTemplate(opts.lineupPage)); break;
        case 'highlight': stage.appendChild(buildHighlightTemplate()); break;
        case 'sticker':
        default:          stage.appendChild(buildStickerTemplate(ev, { format }));
    }
    return stage;
}

// Measure text width in Syne 800 and pick a font-size that fits the
// header's 960px content area on a single line. Returns a px value.
const _measureCtx = (() => {
    try { return document.createElement('canvas').getContext('2d'); }
    catch { return null; }
})();
function fitHeadingSize(text, maxWidth = 960, maxSize = 160, minSize = 60) {
    if (!_measureCtx) return maxSize;
    const txt = String(text || '').toUpperCase();
    if (!txt) return maxSize;
    // Binary-search the largest font-size where measured width ≤ maxWidth.
    let lo = minSize, hi = maxSize, best = minSize;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        _measureCtx.font = `800 ${mid}px "Syne", sans-serif`;
        const w = _measureCtx.measureText(txt).width;
        if (w <= maxWidth) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }
    return best;
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

function buildLineupTemplate(pageOverride = null) {
    // Aggregate templates read current selection/state — they're always
    // invoked synchronously during preview or the user's export click, so
    // there's no async window for state to drift.
    const frag = document.createDocumentFragment();
    const pages = lineupPages();
    const pageIdx = pageOverride != null
        ? pageOverride
        : Math.min(state.lineupPage, Math.max(0, pages.length - 1));
    const shown = pages[pageIdx] || [];

    const tpl = document.createElement('div');
    tpl.className = 'tpl-lineup';
    tpl.innerHTML = `
        <div class="halftone"></div>
        ${pages.length > 1 ? `<div class="page-marker">${pageIdx + 1} / ${pages.length}</div>` : ''}
        <div class="header">
            <div class="kicker">BRUM OUT LOUD</div>
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
        <div class="badge acc-${escapeHtml(state.highlightAccent)}">
            <div class="label-text ${sizeClass}">${escapeHtml(label)}</div>
        </div>
        <div class="corner-sticker">Brum<br>Out Loud</div>
        <div class="brandmark">BRUMOUTLOUD.CO.UK</div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function buildStickerTemplate(ev, opts = {}) {
    const frag = document.createDocumentFragment();
    const { day, dateLine, time } = formatForAsset(ev);

    const tpl = document.createElement('div');
    tpl.className = 'tpl-sticker';
    tpl.style.position = 'absolute';
    tpl.style.inset = '0';
    tpl.innerHTML = `
        <div class="bg-img" style="background-image:url('${heroUrl(ev, opts)}')"></div>
        <div class="overlay"></div>
        <div class="top-sticker">${escapeHtml(primaryCategory(ev))}</div>
        <div class="date-pill">${escapeHtml(day)}</div>
        <div class="bottom-block">
            <div class="title">${escapeHtml(ev.name)}</div>
            <div class="meta">
                <div><i class="fas fa-calendar"></i>${escapeHtml(dateLine)}${time ? ' • ' + escapeHtml(time) : ''}</div>
                <div><i class="fas fa-location-dot"></i>${escapeHtml(ev.venue?.name || 'Birmingham')}</div>
            </div>
        </div>
        <div class="brand">BRUMOUTLOUD.CO.UK</div>
        <div class="footer-bar"></div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function buildCardTemplate(ev, opts = {}) {
    const frag = document.createDocumentFragment();
    const { day, dateLine, time } = formatForAsset(ev);

    const tpl = document.createElement('div');
    tpl.className = 'tpl-card';
    tpl.innerHTML = `
        <div class="halftone"></div>
        <div class="watermark">BRUM</div>
        <div class="card">
            <div class="kicker">${escapeHtml(day)} • ${escapeHtml(primaryCategory(ev))}</div>
            <div class="title">${escapeHtml(ev.name)}</div>
            <div class="event-img" style="background-image:url('${heroUrl(ev, opts)}')"></div>
            <div class="meta">
                <div><i class="fas fa-calendar"></i>${escapeHtml(dateLine)}${time ? ' • ' + escapeHtml(time) : ''}</div>
                <div><i class="fas fa-location-dot"></i>${escapeHtml(ev.venue?.name || 'Birmingham')}</div>
            </div>
            <div class="brand-bar">
                <span>Brum Out Loud</span>
                <span class="url">/events</span>
            </div>
        </div>
    `;
    frag.appendChild(tpl);
    return frag;
}

function primaryCategory(ev) {
    if (!ev) return 'Tonight';
    const cats = Array.isArray(ev.category) ? ev.category : (ev.category ? [ev.category] : []);
    return (cats[0] || 'Tonight').toString();
}

// -- PNG / ZIP export -------------------------------------------------------

async function renderEventToBlob(ev, format, template) {
    const off = document.createElement('div');
    off.style.position = 'fixed';
    off.style.left = '-20000px';
    off.style.top = '0';
    off.style.zIndex = '-1';
    document.body.appendChild(off);

    // No global state mutation — buildStage receives format/template explicitly.
    const stage = buildStage(ev, { format, template });
    stage.classList.add('hide-safe-zone');
    off.appendChild(stage);

    await waitForImages(stage);

    const canvas = await html2canvas(stage, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: false,
        scale: 1,
        width: stage.offsetWidth,
        height: stage.offsetHeight,
        logging: false,
    });

    off.remove();
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function waitForImages(root) {
    const bgEls = root.querySelectorAll('.bg-img, .event-img');
    const urls = [...bgEls].map(el => {
        const m = el.style.backgroundImage.match(/url\(["']?([^"')]+)/);
        return m ? m[1] : null;
    }).filter(Boolean);
    await Promise.all(urls.map(url => new Promise(resolve => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = im.onerror = () => resolve();
        im.src = url;
    })));
}

function slugify(s) {
    return String(s || 'event').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function fileNameFor(ev, format, template) {
    return `${slugify(ev.name)}-${format}-${template}.png`;
}

async function downloadSingle() {
    const btn = document.getElementById('download-single');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Rendering…';
    try {
        let blob, filename;
        if (state.template === 'lineup') {
            const pages = lineupPages();
            if (pages.length > 1) {
                // Multi-page lineup: ZIP with one PNG per page.
                const zip = new JSZip();
                for (let i = 0; i < pages.length; i++) {
                    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Page ${i + 1}/${pages.length}`;
                    const pageBlob = await renderAggregateToBlob(state.format, state.template, { lineupPage: i });
                    zip.file(`${String(i + 1).padStart(2, '0')}-lineup.png`, pageBlob);
                }
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Packaging…';
                blob = await zip.generateAsync({ type: 'blob' });
                filename = `brum-outloud-lineup-${slugify(state.lineupTitle)}.zip`;
            } else {
                blob = await renderAggregateToBlob(state.format, state.template);
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
    for (let i = 0; i < selected.length; i++) {
        const ev = selected[i];
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${i + 1}/${selected.length}`;
        try {
            const blob = await renderEventToBlob(ev, fmt, tpl);
            zip.file(fileNameFor(ev, fmt, tpl), blob);
        } catch (err) {
            console.error(`Failed to render ${ev.name}:`, err);
        }
    }
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Packaging…';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `brum-outloud-${fmt}-${tpl}.zip`);
    btn.disabled = false;
    updateDownloadButtons();
}

async function renderAggregateToBlob(format, template, extra = {}) {
    const off = document.createElement('div');
    off.style.position = 'fixed';
    off.style.left = '-20000px';
    off.style.top = '0';
    off.style.zIndex = '-1';
    document.body.appendChild(off);

    const stage = buildStage(null, { format, template, ...extra });
    stage.classList.add('hide-safe-zone');
    off.appendChild(stage);
    await waitForImages(stage);

    const canvas = await html2canvas(stage, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: false,
        scale: 1,
        width: stage.offsetWidth,
        height: stage.offsetHeight,
        logging: false,
    });
    off.remove();
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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

    if (state.template === 'lineup') {
        const pages = lineupPages();
        singleBtn.disabled = state.selectedIds.size === 0;
        singleBtn.innerHTML = pages.length > 1
            ? `<i class="fas fa-file-archive mr-2"></i> Download Lineup ZIP (${pages.length} pages)`
            : `<i class="fas fa-download mr-2"></i> Download Lineup (${state.selectedIds.size})`;
        batchBtn.disabled = true;
        batchBtn.innerHTML = '<i class="fas fa-file-archive mr-2"></i> Multi-page output auto-ZIPs';
    } else if (state.template === 'highlight') {
        singleBtn.disabled = !(state.highlightLabel || '').trim();
        singleBtn.innerHTML = '<i class="fas fa-download mr-2"></i> Download Cover PNG';
        batchBtn.disabled = true;
        batchBtn.innerHTML = '<i class="fas fa-file-archive mr-2"></i> ZIP not used for Cover';
    } else {
        singleBtn.disabled = !state.activeId;
        singleBtn.innerHTML = '<i class="fas fa-download mr-2"></i> Download PNG';
        const count = state.selectedIds.size;
        batchBtn.disabled = count === 0;
        batchBtn.innerHTML = count > 0
            ? `<i class="fas fa-file-archive mr-2"></i> Download ZIP (${count})`
            : '<i class="fas fa-file-archive mr-2"></i> Download All Selected (ZIP)';
    }
}

function syncTemplateOptions() {
    const lineup = document.getElementById('lineup-options');
    const highlight = document.getElementById('highlight-options');
    lineup.classList.toggle('hidden', state.template !== 'lineup');
    highlight.classList.toggle('hidden', state.template !== 'highlight');

    const storyOnly = STORY_ONLY_TEMPLATES.has(state.template);
    document.querySelectorAll('#format-controls button').forEach(b => {
        const isStory = b.dataset.format === 'story';
        b.disabled = storyOnly && !isStory;
        b.style.opacity = b.disabled ? '0.4' : '';
        b.style.cursor = b.disabled ? 'not-allowed' : '';
    });
}

// -- Wire-up ----------------------------------------------------------------

function wireControls() {
    document.getElementById('range-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-preset]');
        if (!btn) return;
        state.preset = btn.dataset.preset;
        state.selectedIds.clear();
        state.activeId = null;
        state.lineupPage = 0;
        // Sync Lineup header title to the chosen range (only if user hasn't
        // customized it — we match the button label for each known preset).
        const presetTitles = {
            'today': 'Tonight',
            'this-week': 'This Week',
            'this-weekend': 'This Wknd',
            'next-week': 'Next Week',
            'this-month': 'This Month',
            'next-30-days': 'Coming Up'
        };
        const matchedTitle = presetTitles[state.preset];
        if (matchedTitle && Object.values(presetTitles).includes(state.lineupTitle)) {
            state.lineupTitle = matchedTitle;
            const titleInput = document.getElementById('lineup-title');
            if (titleInput) titleInput.value = matchedTitle;
        }
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        fetchEvents();
        updateDownloadButtons();
    });

    document.getElementById('format-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-format]');
        if (!btn || btn.disabled) return;
        state.format = btn.dataset.format;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        renderPreview();
    });

    document.getElementById('template-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-template]');
        if (!btn) return;
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

    // Lineup pager (prev / next)
    document.getElementById('lineup-pager').addEventListener('click', e => {
        const prev = e.target.closest('[data-pager-prev]');
        const next = e.target.closest('[data-pager-next]');
        if (!prev && !next) return;
        const pages = lineupPages();
        if (pages.length <= 1) return;
        const cur = Math.min(state.lineupPage, pages.length - 1);
        if (prev && cur > 0) state.lineupPage = cur - 1;
        if (next && cur < pages.length - 1) state.lineupPage = cur + 1;
        renderPreview();
    });

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
}

wireControls();
fetchEvents();
