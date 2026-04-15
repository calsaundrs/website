// Social Assets Generator
// Fetches upcoming events and renders on-brand Instagram posts/stories
// client-side via html2canvas. ZIP bundling via JSZip.

import { getIdToken } from './auth-guard.js';

const EVENTS_ENDPOINT = '/.netlify/functions/get-events-for-reels';

const state = {
    events: [],
    selectedIds: new Set(),
    activeId: null,
    preset: 'this-week',
    format: 'square',      // square | portrait | story
    template: 'sticker',   // sticker | card
};

// -- Event fetching ---------------------------------------------------------

async function fetchEvents() {
    const listEl = document.getElementById('event-list');
    const countEl = document.getElementById('event-count');
    listEl.innerHTML = `<div class="text-center py-10 opacity-50 text-sm">Loading events...</div>`;
    countEl.textContent = '—';

    try {
        const token = await getIdToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${EVENTS_ENDPOINT}?preset=${encodeURIComponent(state.preset)}`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.events = Array.isArray(data) ? data : (data.events || []);
    } catch (err) {
        console.error('Failed to load events:', err);
        listEl.innerHTML = `<div class="text-center py-10 text-sm text-red-400">Couldn't load events — ${err.message}</div>`;
        countEl.textContent = '—';
        return;
    }

    countEl.textContent = `${state.events.length} event${state.events.length === 1 ? '' : 's'}`;
    renderEventList();
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

        row.addEventListener('click', (e) => {
            // Toggle selection on shift/cmd/ctrl click, else make active + add to selection
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
                if (state.selectedIds.has(ev.id)) state.selectedIds.delete(ev.id);
                else state.selectedIds.add(ev.id);
            } else {
                state.activeId = ev.id;
                state.selectedIds.add(ev.id);
            }
            renderEventList();
            renderPreview();
            updateDownloadButtons();
        });

        listEl.appendChild(row);
    });
}

// -- Image URL helpers ------------------------------------------------------

function thumbUrl(ev) {
    return toImageUrl(ev, 'w_200,h_200,c_fill,g_auto');
}
function heroUrl(ev) {
    // Square/portrait use 1080×1080 crop; story uses 1080×1920
    const t = state.format === 'story'
        ? 'w_1080,h_1920,c_fill,g_auto'
        : 'w_1080,h_1350,c_fill,g_auto';
    return toImageUrl(ev, t);
}
function toImageUrl(ev, transform) {
    const raw = ev.image;
    if (!raw) return placeholder();
    if (typeof raw === 'object' && raw.url) return raw.url;
    if (typeof raw !== 'string') return placeholder();
    // If it's already a Cloudinary URL, slot transforms in
    const m = raw.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
    if (m) {
        // If existing transforms are present, prepend ours
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
    if (!ev.date) return { day: 'TBC', dateLine: '', time: '' };
    const d = new Date(ev.date);
    const day = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const dateLine = d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long'
    });
    const time = ev.time || d.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    return { day, dateLine, time };
}

// -- Preview rendering ------------------------------------------------------

function renderPreview() {
    const container = document.getElementById('preview-container');
    const meta = document.getElementById('preview-meta');
    const ev = state.events.find(e => e.id === state.activeId);
    if (!ev) {
        container.innerHTML = `<div class="opacity-50 text-sm p-16">Select an event to preview</div>`;
        meta.textContent = 'Select an event to preview';
        return;
    }

    const stage = buildStage(ev);
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
    meta.textContent = `${ev.name} — ${fmt} • ${state.template}`;
}

function buildStage(ev) {
    const stage = document.createElement('div');
    stage.className = `asset-stage ${state.format}`;
    if (state.format === 'story') stage.classList.add('safe-zone');

    if (state.template === 'sticker') stage.appendChild(buildStickerTemplate(ev));
    else stage.appendChild(buildCardTemplate(ev));

    return stage;
}

function buildStickerTemplate(ev) {
    const frag = document.createDocumentFragment();
    const { day, dateLine, time } = formatForAsset(ev);

    const tpl = document.createElement('div');
    tpl.className = 'tpl-sticker';
    tpl.style.position = 'absolute';
    tpl.style.inset = '0';
    tpl.innerHTML = `
        <div class="bg-img" style="background-image:url('${heroUrl(ev)}')"></div>
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

function buildCardTemplate(ev) {
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
            <div class="event-img" style="background-image:url('${heroUrl(ev)}')"></div>
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
    const cats = Array.isArray(ev.category) ? ev.category : (ev.category ? [ev.category] : []);
    return (cats[0] || 'Tonight').toString();
}

// -- PNG / ZIP export -------------------------------------------------------

async function renderEventToBlob(ev, format, template) {
    // Build an off-screen stage at full pixel dimensions
    const off = document.createElement('div');
    off.style.position = 'fixed';
    off.style.left = '-20000px';
    off.style.top = '0';
    off.style.zIndex = '-1';
    document.body.appendChild(off);

    // Temporarily override state so builders render for the target format
    const savedFmt = state.format, savedTpl = state.template;
    state.format = format; state.template = template;

    const stage = buildStage(ev);
    // Exported PNGs should NOT show safe-zone guides
    stage.classList.add('hide-safe-zone');
    off.appendChild(stage);

    // Give remote images a beat to load
    await waitForImages(stage);

    state.format = savedFmt; state.template = savedTpl;

    const canvas = await html2canvas(stage, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        scale: 1,
        width: stage.offsetWidth,
        height: stage.offsetHeight,
        logging: false,
    });

    off.remove();
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function waitForImages(root) {
    // html2canvas handles <img>, but our templates use background-image.
    // Preload the hero URL so it's in the browser cache before rasterizing.
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
    const ev = state.events.find(e => e.id === state.activeId);
    if (!ev) return;
    const btn = document.getElementById('download-single');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Rendering…';
    try {
        const blob = await renderEventToBlob(ev, state.format, state.template);
        triggerDownload(blob, fileNameFor(ev, state.format, state.template));
    } catch (err) {
        console.error(err);
        alert(`Render failed: ${err.message}`);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-download mr-2"></i> Download PNG';
        updateDownloadButtons();
    }
}

async function downloadBatch() {
    const selected = state.events.filter(e => state.selectedIds.has(e.id));
    if (selected.length === 0) return;
    const btn = document.getElementById('download-batch');
    btn.disabled = true;
    const zip = new JSZip();
    for (let i = 0; i < selected.length; i++) {
        const ev = selected[i];
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${i + 1}/${selected.length}`;
        try {
            const blob = await renderEventToBlob(ev, state.format, state.template);
            zip.file(fileNameFor(ev, state.format, state.template), blob);
        } catch (err) {
            console.error(`Failed to render ${ev.name}:`, err);
        }
    }
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Packaging…';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `brum-outloud-${state.format}-${state.template}.zip`);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-archive mr-2"></i> Download All Selected (ZIP)';
    updateDownloadButtons();
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateDownloadButtons() {
    document.getElementById('download-single').disabled = !state.activeId;
    document.getElementById('download-batch').disabled = state.selectedIds.size === 0;
    const batchBtn = document.getElementById('download-batch');
    const count = state.selectedIds.size;
    batchBtn.innerHTML = count > 0
        ? `<i class="fas fa-file-archive mr-2"></i> Download ZIP (${count})`
        : '<i class="fas fa-file-archive mr-2"></i> Download All Selected (ZIP)';
}

// -- Wire-up ----------------------------------------------------------------

function wireControls() {
    document.getElementById('range-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-preset]');
        if (!btn) return;
        state.preset = btn.dataset.preset;
        state.selectedIds.clear();
        state.activeId = null;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        fetchEvents();
        updateDownloadButtons();
    });

    document.getElementById('format-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-format]');
        if (!btn) return;
        state.format = btn.dataset.format;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        renderPreview();
    });

    document.getElementById('template-controls').addEventListener('click', e => {
        const btn = e.target.closest('button[data-template]');
        if (!btn) return;
        state.template = btn.dataset.template;
        [...e.currentTarget.children].forEach(b => b.classList.toggle('active', b === btn));
        renderPreview();
    });

    document.getElementById('download-single').addEventListener('click', downloadSingle);
    document.getElementById('download-batch').addEventListener('click', downloadBatch);
}

wireControls();
fetchEvents();
