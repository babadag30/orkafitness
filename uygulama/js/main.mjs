/* Orka EMS Fitness — yönlendirici ve uygulama kabuğu (işletme sahibi demosu) */

import * as Store from './store.mjs';
import * as A from './adapter.mjs';
import * as M from './member.mjs';
import * as Admin from './admin.mjs';
import { icon, toast, closeSheet, isSheetOpen } from './ui.mjs';

const root = document.getElementById('app');
let current = null;

const SCREENS = {
  login: M.login, home: M.home, book: M.book, slots: M.slots, confirm: M.confirm,
  appointments: M.appointments, appt: M.appt, profile: M.profile, notifications: M.notifications,
  admin: Admin.admin, adminMembers: Admin.adminMembers, adminSettings: Admin.adminSettings
};

const MEMBER_ONLY = ['home', 'book', 'slots', 'confirm', 'appointments', 'appt', 'profile', 'notifications'];
const ADMIN_ONLY = ['admin', 'adminMembers', 'adminSettings'];

const TABS = [
  ['home', 'home', 'Ana Sayfa', icon.home],
  ['book', 'book', 'Randevu Al', icon.plus],
  ['appts', 'appointments', 'Randevularım', icon.cal],
  ['profile', 'profile', 'Profil', icon.user]
];

function parseHash() {
  const raw = (location.hash || '#/login').replace(/^#\/?/, '');
  const i = raw.indexOf(':');
  return {
    name: (i === -1 ? raw : raw.slice(0, i)) || 'login',
    params: { id: i === -1 ? undefined : raw.slice(i + 1) }
  };
}

function tabsHtml(active) {
  if (!active) return '';
  const n = Store.unreadCount();
  return `<nav class="tabbar">${TABS.map(([key, route, label, ico]) => `
    <button class="tab ${key === active ? 'on' : ''}" data-go="${route}" aria-label="${label}">
      ${ico}<span>${label}</span>
      ${key === 'home' && n ? '<i class="dot"></i>' : ''}
    </button>`).join('')}</nav>`;
}

export function render() {
  const { name, params } = parseHash();
  const session = Store.get().session;

  // Rol koruması — demo düzeyinde. Gerçek yetkilendirme sunucu tarafında olacak.
  if (!session && name !== 'login') return go('login', true);
  if (session?.role === 'MEMBER' && ADMIN_ONLY.includes(name)) return go('home', true);
  if (session?.role === 'ADMIN' && MEMBER_ONLY.includes(name)) return go('admin', true);

  const factory = SCREENS[name] ?? (session?.role === 'ADMIN' ? Admin.admin : M.home);
  const screen = factory(params);
  current = { name, screen };

  root.classList.toggle('wide', !!screen.wide);
  root.innerHTML = screen.html + tabsHtml(screen.tabs);
  document.querySelector('.view')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  screen.after?.();
}

function go(target, replace = false) {
  const h = '#/' + target;
  if (location.hash === h) return render();
  if (replace) location.replace(h); else location.hash = h;
}

M.setRerender(render);
Admin.setRerender(render);

/* ------------------------------------------------------------------ */
/* Olay yönlendirme                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener('click', (e) => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) { e.preventDefault(); return go(goEl.dataset.go); }

  // Paneller kendi dinleyicilerini kurabilir; kurmayanlar ekran eylemlerine düşer.
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;

  const name = actEl.dataset.act;
  if (name === 'back') { e.preventDefault(); return history.length > 1 ? history.back() : go('home'); }

  const fns = current?.screen.actions;
  if (fns?.[name]) { e.preventDefault(); fns[name](actEl); }
});

window.addEventListener('hashchange', render);

/* ------------------------------------------------------------------ */
/* Yönetici takvimi: sürükle-bırak                                      */
/* ------------------------------------------------------------------ */

let dragId = null;

document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.appt[data-appt]');
  if (!card) return;
  dragId = card.dataset.appt;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Veri taşımıyoruz: randevu kimliği uygulama içi durumda tutulur.
  e.dataTransfer.setData('text/plain', '');
});

document.addEventListener('dragend', () => {
  dragId = null;
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.cell.drop,.cell.nodrop').forEach(el => el.classList.remove('drop', 'nodrop'));
});

document.addEventListener('dragover', (e) => {
  const cell = e.target.closest('.cell[data-slot]');
  if (!cell || !dragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (!cell.classList.contains('drop') && !cell.classList.contains('nodrop')) {
    // Hedef hücrenin geçerliliği motora sorulur — arayüz kendi kararını vermez.
    const a = Store.get().appointments.find(x => x.id === dragId);
    const ok = a && A.checkMove({ appointment: a, targetStartsAt: Number(cell.dataset.slot) }).allowed;
    cell.classList.add(ok ? 'drop' : 'nodrop');
  }
});

document.addEventListener('dragleave', (e) => {
  e.target.closest('.cell')?.classList.remove('drop', 'nodrop');
});

document.addEventListener('drop', (e) => {
  const cell = e.target.closest('.cell[data-slot]');
  if (!cell || !dragId) return;
  e.preventDefault();
  const id = dragId;
  dragId = null;
  Admin.attemptMove(id, Number(cell.dataset.slot));
});

/* ------------------------------------------------------------------ */
/* Sağ tık menüsü                                                       */
/* ------------------------------------------------------------------ */

let menuEl = null;
const closeMenu = () => { menuEl?.remove(); menuEl = null; };

document.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.appt[data-appt]');
  const cell = e.target.closest('.cell[data-slot]');
  if (!card && !cell) return;
  e.preventDefault();
  closeMenu();

  const items = [];
  if (card) {
    const id = card.dataset.appt;
    items.push(['Detay', () => Admin.apptSheet(id)]);
    items.push(['Kes', () => {
      Admin.clipboard.appointmentId = id;
      toast('Kesildi. Hedef saate sağ tıkla → Yapıştır.');
      render();
    }]);
  }
  if (cell) {
    const t = Number(cell.dataset.slot);
    if (Admin.clipboard.appointmentId) {
      items.push(['Yapıştır', () => Admin.attemptMove(Admin.clipboard.appointmentId, t)]);
    }
    items.push(['Manuel randevu ekle', () => Admin.slotSheet(t)]);
    items.push(['Seansı kapat / aç', () => Admin.slotSheet(t)]);
  }

  menuEl = document.createElement('div');
  menuEl.className = 'ctxmenu';
  menuEl.style.left = Math.min(e.clientX, innerWidth - 210) + 'px';
  menuEl.style.top = Math.min(e.clientY, innerHeight - items.length * 40 - 16) + 'px';
  items.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { closeMenu(); fn(); };
    menuEl.appendChild(b);
  });
  document.body.appendChild(menuEl);
});

document.addEventListener('click', closeMenu);
document.addEventListener('scroll', closeMenu, true);

/* ------------------------------------------------------------------ */
/* Klavye kısayolları                                                   */
/* ------------------------------------------------------------------ */

/** Metin düzenleme alanlarında pano kısayolları ele geçirilmez (v0.5 §22.4). */
function inTextField(el) {
  return !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (menuEl) return closeMenu();
    if (isSheetOpen()) return closeSheet();
    if (Admin.clipboard.appointmentId) {
      Admin.clipboard.appointmentId = null;
      toast('Kesme iptal edildi.');
      return render();
    }
    return;
  }

  if (Store.get().session?.role !== 'ADMIN') return;
  if (!(e.metaKey || e.ctrlKey)) return;
  if (inTextField(document.activeElement) || inTextField(e.target)) return;

  const k = e.key.toLowerCase();

  if (k === 'x') {
    const focused = document.querySelector('.appt:hover[data-appt]')
                 ?? document.querySelector('.appt[data-appt]:focus');
    if (!focused) return;
    e.preventDefault();
    Admin.clipboard.appointmentId = focused.dataset.appt;
    toast('Kesildi. Hedef saatin üzerinde Ctrl/Cmd+V.');
    render();
  }

  if (k === 'v') {
    if (!Admin.clipboard.appointmentId) return;
    const cell = document.querySelector('.cell:hover[data-slot]');
    if (!cell) return toast('Yapıştırmak için hedef saatin üzerine gel.', true);
    e.preventDefault();
    Admin.attemptMove(Admin.clipboard.appointmentId, Number(cell.dataset.slot));
  }
});

/* ------------------------------------------------------------------ */
/* Açılış                                                               */
/* ------------------------------------------------------------------ */

if (!location.hash) {
  const s = Store.get().session;
  location.replace(s ? (s.role === 'ADMIN' ? '#/admin' : '#/home') : '#/login');
}
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update();
    setInterval(() => reg.update(), 60 * 60 * 1000);
  }).catch(() => { /* çevrimdışı desteği yok */ });

  const vardi = !!navigator.serviceWorker.controller;
  let tazelendi = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!vardi || tazelendi) return;
    tazelendi = true;
    location.reload();
  });
}
