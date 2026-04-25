// Shared admin sidebar + topbar.
// Pages declare placeholders [data-admin-sidebar] and [data-admin-topbar];
// this module fills them on DOMContentLoaded. Active nav is derived from
// the URL pathname; the breadcrumb is read from meta tags:
//   <meta name="admin-breadcrumb-section" content="Overview">
//   <meta name="admin-breadcrumb-page" content="Review Submissions">

import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const NAV_ITEMS = [
  { href: 'admin-approvals.html',     icon: 'fa-check-circle',     label: 'Approvals', accent: true },
  { href: 'admin-edit-events.html',   icon: 'fa-calendar-alt',     label: 'Events' },
  { href: 'admin-manage-venues.html', icon: 'fa-map-marker-alt',   label: 'Venues' },
  { href: 'admin-import-events.html', icon: 'fa-cloud-upload-alt', label: 'Import' },
  { href: 'admin-social-assets.html', icon: 'fa-images',           label: 'Social' },
];

const SYSTEM_ITEMS = [
  { href: 'admin-settings.html',      icon: 'fa-cog',       label: 'Settings' },
  { href: 'admin-system-status.html', icon: 'fa-heartbeat', label: 'Status' },
];

function activeFromPath() {
  const path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  const file = path.endsWith('.html') ? path : `${path}.html`;
  const all = [...NAV_ITEMS, ...SYSTEM_ITEMS].map((i) => i.href);
  return all.includes(file) ? file : null;
}

function renderNavLink(item, active) {
  const activeCls = 'text-white bg-white/10 border border-white/5 shadow-[inset_0_1px_rgba(255,255,255,0.1)]';
  const idleCls = 'text-gray-400 hover:text-white hover:bg-white/5';
  const iconActive = item.accent ? 'text-[var(--color-toxic)]' : 'text-white';
  const iconIdle = 'text-gray-500';
  const icon = active ? iconActive : iconIdle;
  return `
    <a href="${item.href}" class="flex items-center px-4 py-3 text-sm font-medium rounded-lg ${active ? activeCls : idleCls} transition-all">
      <i class="fas ${item.icon} w-5 mr-3 text-center ${icon}"></i> ${item.label}
    </a>
  `;
}

function renderSidebar(activeHref) {
  const main = NAV_ITEMS.map((i) => renderNavLink(i, i.href === activeHref)).join('');
  const system = SYSTEM_ITEMS.map((i) => renderNavLink(i, i.href === activeHref)).join('');
  return `
    <aside class="w-64 flex-shrink-0 bg-[#0A0A0A] border-r border-white/5 flex-col h-full hidden lg:flex relative z-30" data-admin-sidebar-mounted>
      <div class="p-6 border-b border-white/5">
        <a href="/admin-settings.html" class="flex items-center space-x-3 text-white hover:text-gray-300 transition-colors">
          <div class="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <i class="fas fa-bolt text-sm text-white"></i>
          </div>
          <span class="font-display font-bold tracking-wider uppercase text-sm">EVENTFLOW</span>
        </a>
      </div>
      <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        ${main}
        <div class="pt-6 mt-6 border-t border-white/5 space-y-2">
          <p class="px-4 text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-2">SYSTEM</p>
          ${system}
        </div>
      </nav>
      <div class="p-4 border-t border-white/5 space-y-2">
        <button id="logout-btn" class="flex justify-center items-center px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-lg text-gray-400 hover:text-white bg-white/5 hover:bg-red-500 hover:text-white transition-colors w-full border border-white/5 hover:border-red-500 shadow-sm">
          <i class="fas fa-sign-out-alt mr-2"></i> Sign Out
        </button>
        <a href="/" target="_blank" class="flex justify-center items-center px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-lg text-gray-400 hover:text-white bg-white/5 hover:bg-[var(--color-toxic)] hover:text-black transition-colors w-full border border-white/5 hover:border-[var(--color-toxic)] shadow-sm">
          <i class="fas fa-external-link-alt mr-2"></i> Live Site
        </a>
      </div>
    </aside>
  `;
}

function renderTopbar(section, page) {
  const breadcrumb = section && page
    ? `<span class="text-gray-500 mr-2">${section}</span> <span class="text-gray-600 mx-2">/</span> ${page}`
    : (page || '');
  return `
    <header class="h-16 flex-shrink-0 bg-[#050505] border-b border-white/5 flex items-center justify-between px-8 relative z-20" data-admin-topbar-mounted>
      <div class="flex items-center">
        <button id="admin-menu-toggle" class="lg:hidden text-gray-400 hover:text-white mr-6 transition-colors" aria-label="Toggle navigation">
          <i class="fas fa-bars text-xl"></i>
        </button>
        <h2 class="text-white font-semibold text-sm tracking-wide hidden sm:flex items-center">${breadcrumb}</h2>
      </div>
      <div class="flex items-center gap-4">
        <div class="h-8 w-8 rounded bg-[#111] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer">
          <i class="fas fa-bell"></i>
        </div>
        <div class="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-purple-500/20 ring-2 ring-black">A</div>
      </div>
    </header>
  `;
}

function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute('content') : null;
}

function mount() {
  const sidebarSlot = document.querySelector('[data-admin-sidebar]');
  const topbarSlot = document.querySelector('[data-admin-topbar]');
  if (!sidebarSlot && !topbarSlot) return;

  const active = activeFromPath();
  const section = readMeta('admin-breadcrumb-section');
  const page = readMeta('admin-breadcrumb-page') || document.title.split('|')[0].trim();

  if (sidebarSlot) sidebarSlot.outerHTML = renderSidebar(active);
  if (topbarSlot) topbarSlot.outerHTML = renderTopbar(section, page);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(getAuth());
        window.location.href = '/admin-login.html';
      } catch (err) {
        console.error('Error signing out:', err);
      }
    });
  }

  const menuBtn = document.getElementById('admin-menu-toggle');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const aside = document.querySelector('[data-admin-sidebar-mounted]');
      if (aside) aside.classList.toggle('hidden');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
