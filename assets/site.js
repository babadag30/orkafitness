/* ORKA EMS Fitness — site davranışı.
   Bağımlılık yok, build yok. Yalnızca transform/opacity animasyonu → CLS yaratmaz.

   İLKE: JS içeriği GÖSTERMEZ, yalnızca zenginleştirir.
   Açığa çıkarma tamamen CSS'te (animation-timeline / @keyframes both). Bu dosya
   hiç çalışmasa da sayfanın tamamı okunur durumda kalır. */
(() => {
  'use strict';
  const doc = document.documentElement;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. Scroll ilerleme çizgisi + nav durumu ---------- */
  const bar = $('#progress'), nav = $('#nav');
  let ticking = false;
  const onScroll = () => {
    const y = scrollY;
    const max = document.body.scrollHeight - innerHeight;
    if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (nav) nav.style.background = y > 40 ? 'rgba(17,17,17,.92)' : 'rgba(17,17,17,.72)';
    if (heroBg && !reduced) heroBg.style.transform = `translate3d(0,${Math.min(y, innerHeight) * 0.18}px,0)`;
    ticking = false;
  };
  const heroBg = $('#heroBg');
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- 3. RK sembolü kendini çizer (kit 05) ---------- */
  const mark = $('#heroMark');
  if (mark) {
    $$('path', mark).forEach(p => {
      const len = Math.ceil(p.getTotalLength());
      p.style.setProperty('--len', len);
    });
    requestAnimationFrame(() => mark.classList.add('drawn'));
  }

  /* ---------- 6. Mobil menü ---------- */
  const burger = $('#burger'), mob = $('#mobmenu');
  if (burger && mob) {
    const setMenu = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      mob.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () =>
      setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    mob.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width:1041px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- 7. Canlı açık / kapalı rozeti ----------
     Saatler sitedeki tabloyla ve stüdyo politikasıyla aynı:
     Pzt–Cmt 08:00–23:30 · Paz 10:00–22:00. Tek yerde tanımlı. */
  const HOURS = { 0: [600, 1320], 1: [480, 1410], 2: [480, 1410], 3: [480, 1410],
                  4: [480, 1410], 5: [480, 1410], 6: [480, 1410] };
  const badge = $('#status'), badgeText = $('#statusText');
  if (badge && badgeText) {
    // Stüdyo saati (TRT, UTC+3) — ziyaretçinin cihaz saat diliminden bağımsız.
    const now = new Date(Date.now() + 180 * 60000);
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [open, close] = HOURS[now.getUTCDay()];
    const isOpen = mins >= open && mins < close;
    badge.classList.add(isOpen ? 'is-open' : 'is-closed');
    badgeText.textContent = isOpen ? 'Şu an açık' : 'Şu an kapalı';
  }
})();
