/* Orka EMS Fitness — paylaşılan arayüz yardımcıları
   Yalnızca sunum. Hiçbir iş kuralı burada değil. */

import { DEMO_POLICY, minToHHMM, MINUTE } from '../../domain/index.mjs';

const OFF = DEMO_POLICY.locale.timezoneOffsetMinutes;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Stüdyo saatine kaydırılmış tarih parçaları. */
const parts = (t) => {
  const d = new Date(t + OFF * MINUTE);
  return { d: d.getUTCDate(), m: d.getUTCMonth(), y: d.getUTCFullYear(), dow: d.getUTCDay(),
           h: d.getUTCHours(), min: d.getUTCMinutes() };
};

export const fmt = {
  time: (t) => { const p = parts(t); return minToHHMM(p.h * 60 + p.min); },
  dow:  (t) => GUN[parts(t).dow],
  dowShort: (t) => GUN_KISA[parts(t).dow],
  dayNum: (t) => parts(t).d,
  date: (t) => { const p = parts(t); return `${p.d} ${AY[p.m]}`; },
  full: (t) => { const p = parts(t); return `${p.d} ${AY[p.m]} ${GUN[p.dow]}`; },
  money: (n) => new Intl.NumberFormat('tr-TR').format(n) + ' ₺',
  rel(t) {
    const gun = Math.round((startOfDay(t) - startOfDay(Date.now())) / 86_400_000);
    if (gun === 0) return 'Bugün';
    if (gun === 1) return 'Yarın';
    if (gun === -1) return 'Dün';
    return fmt.full(t);
  }
};

export const startOfDay = (t) => {
  const shifted = t + OFF * MINUTE;
  return Math.floor(shifted / 86_400_000) * 86_400_000 - OFF * MINUTE;
};

export const sameDay = (a, b) => startOfDay(a) === startOfDay(b);

/* ---------- ikonlar ---------- */
const P = (d, extra = '') =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}><path d="${d}"/></svg>`;

export const icon = {
  home:    P('M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'),
  plus:    P('M12 5v14M5 12h14'),
  cal:     P('M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4'),
  user:    P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0'),
  back:    P('M15 5l-7 7 7 7'),
  bolt:    P('M13 2 4 14h7l-1 8 9-12h-7z'),
  dumbbell: P('M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11'),
  users:   P('M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.85M16.5 4.15a4 4 0 0 1 0 7.7'),
  clock:   P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'),
  bell:    P('M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0'),
  logout:  P('M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4M16 16l4-4-4-4M20 12H9'),
  check:   P('M20 6 9 17l-5-5'),
  x:       P('M18 6 6 18M6 6l12 12'),
  wallet:  P('M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 8v9a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 8h15M21 11h-4a2 2 0 0 0 0 4h4z'),
  settings: P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z')
};

/* ---------- bileşen parçacıkları ---------- */

export const topbar = (title, opts = {}) => `
  <div class="topbar">
    ${opts.back !== false ? `<button class="iconbtn ghost" data-act="back" aria-label="Geri">${icon.back}</button>` : ''}
    <h1>${esc(title)}</h1>
    ${opts.right ?? ''}
  </div>`;

export const pill = (txt, cls = '') => `<span class="pill ${cls}"><i></i>${esc(txt)}</span>`;

export const empty = (title, sub = '') => `
  <div class="empty">
    <h3>${esc(title)}</h3>
    ${sub ? `<p class="small">${esc(sub)}</p>` : ''}
  </div>`;

/* ---------- geçici bildirim ---------- */
let toastTimer = null;
export function toast(msg, bad = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------- alttan açılan panel ---------- */
let sheetEl = null;

/**
 * Yönetim paneli.
 * Masaüstünde sağdan açılan sabit yükseklikli çekmece, mobilde alt sayfa.
 * İkisi de aynı DOM'u kullanır; biçimi CSS seçer.
 *
 * Kapatma düğmesi burada enjekte edilir — böylece her çağrı yerinde ayrı ayrı
 * yazılmasına gerek kalmaz ve hiçbir panelde kaybolmaz.
 */
export function sheet(html, onMount) {
  closeSheet();
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet';
  sheetEl.innerHTML = `
    <div class="sheetbox" role="dialog" aria-modal="true">
      <button class="sheetclose" data-sheet-close aria-label="Kapat">${icon.x}</button>
      <div class="sheetbody">${html}</div>
    </div>`;
  sheetEl.addEventListener('click', (e) => {
    if (e.target === sheetEl || e.target.closest('[data-sheet-close]')) closeSheet();
  });
  document.body.appendChild(sheetEl);
  onMount?.(sheetEl.querySelector('.sheetbody'));
}

export function closeSheet() {
  sheetEl?.remove();
  sheetEl = null;
}

export const isSheetOpen = () => !!sheetEl;
