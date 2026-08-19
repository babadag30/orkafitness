/* ORKA EMS Fitness — site davranışı.
   Bağımlılık yok, build yok. Yalnızca transform/opacity → CLS yaratmaz.

   İLKE: JS içeriği GÖSTERMEZ, yalnızca zenginleştirir. Açığa çıkarma tamamen
   CSS'te ve hiçbir giriş animasyonunda fill-mode yok; bu dosya hiç çalışmasa
   da sayfanın tamamı okunur durumda kalır. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* İnce işaretçi + hover yeteneği = masaüstü. Dokunmatikte tüm bu katman kapalı. */
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Kaydırma: ilerleme, nav, hero derinliği ---------- */
  const bar = $('#progress'), nav = $('#nav'), heroBg = $('#heroBg'), hero = $('.hero');
  let sy = 0, ticking = false;

  const onScroll = () => {
    ticking = false;
    sy = scrollY;
    const max = document.body.scrollHeight - innerHeight;
    if (bar) bar.style.width = (max > 0 ? (sy / max) * 100 : 0) + '%';
    if (nav) nav.style.background = sy > 40 ? 'rgba(17,17,17,.92)' : 'rgba(17,17,17,.72)';
    if (hero && !reduced) {
      // Atmosfer en yavaş katman; marka işareti ters yönde. Sinematik derinlik.
      const d = Math.min(sy, innerHeight);
      hero.style.setProperty('--bgY', (d * 0.16) + 'px');
      hero.style.setProperty('--mkY', (d * -0.06) + 'px');
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } },
    { passive: true });
  onScroll();

  /* ---------- 2. İmza etkileşimi: mekânsal ışık alanı + hero katmanları ----------
     Tek bir rAF döngüsü, hedefe doğru yumuşatma (lerp). Dururken fark edilmez,
     hareket ederken hissedilir. Özel imleç / parçacık / parlama yok. */
  const field = $('#field');
  if (fine && !reduced) {
    let tx = innerWidth / 2, ty = innerHeight * 0.42;   // hedef
    let cx = tx, cy = ty;                               // yumuşatılmış
    let raf = 0, moved = false;

    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!moved) { moved = true; field && field.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    function loop() {
      cx += (tx - cx) * 0.075;
      cy += (ty - cy) * 0.075;

      if (field) {
        field.style.setProperty('--mx', (cx / innerWidth * 100).toFixed(2) + '%');
        field.style.setProperty('--my', (cy / innerHeight * 100).toFixed(2) + '%');
      }
      if (hero) {
        // Katmanlar farklı yönde ve genlikte: derinlik hissi, 3B gösterisi değil.
        const nx = (cx / innerWidth - 0.5);      // -0.5 … 0.5
        const ny = (cy / innerHeight - 0.5);
        hero.style.setProperty('--mkX', (nx * -20).toFixed(1) + 'px');
        hero.style.setProperty('--slX', (nx * 12).toFixed(1) + 'px');
        hero.style.setProperty('--cpX', (nx * 3).toFixed(1) + 'px');
        hero.style.setProperty('--bgX', (nx * 8).toFixed(1) + 'px');
      }

      // Hedefe yeterince yaklaşınca döngüyü bırak — boşa çerçeve harcanmaz.
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
  }

  /* ---------- 3. Hizmet kartlarında ölçülü eğim (maks ~1.5°) ---------- */
  if (fine && !reduced) {
    for (const card of document.querySelectorAll('.svc')) {
      card.addEventListener('pointermove', (e) => {
        const b = card.getBoundingClientRect();
        const px = (e.clientX - b.left) / b.width - 0.5;
        const py = (e.clientY - b.top) / b.height - 0.5;
        card.style.transform =
          `rotateY(${(px * 2.4).toFixed(2)}deg) rotateX(${(-py * 1.8).toFixed(2)}deg) translateZ(0)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    }
  }

  /* ---------- 4. Mobil menü ---------- */
  const burger = $('#burger'), mob = $('#mobmenu');
  if (burger && mob) {
    const setMenu = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      mob.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    mob.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width:1041px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- 5. Canlı açık / kapalı rozeti ----------
     Saatler sitedeki tabloyla ve stüdyo politikasıyla aynı:
     Pzt–Cmt 08:00–23:30 · Paz 10:00–22:00. Stüdyo saatinde (UTC+3) hesaplanır. */
  const HOURS = { 0: [600, 1320], 1: [480, 1410], 2: [480, 1410], 3: [480, 1410],
                  4: [480, 1410], 5: [480, 1410], 6: [480, 1410] };
  const badge = $('#status'), badgeText = $('#statusText');
  if (badge && badgeText) {
    const now = new Date(Date.now() + 180 * 60000);
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [open, close] = HOURS[now.getUTCDay()];
    const isOpen = mins >= open && mins < close;
    badge.classList.add(isOpen ? 'is-open' : 'is-closed');
    badgeText.textContent = isOpen ? 'Şu an açık' : 'Şu an kapalı';
  }

  /* ---------- 6. EMS suit koreografisi: merkez -> sol -> sağ ----------
     Ironside'dan alınan yalnızca "kaydırmaya bağlı obje koreografisi" fikri;
     hareketin eğrisi, mesafesi ve ritmi ORKA'ya özgü ve bilinçli olarak kısıtlı.

     GÜVENLİK: bu blok hiç çalışmazsa suit CSS varsayılanıyla ortada durur ve
     tüm metin normal akışta okunur. Hareket hiçbir içeriğin görünürlüğünü
     taşımıyor. Mobilde ve reduced-motion'da tamamen devre dışı. */
  const stage = $('#emsStage'), suit = $('#suit');
  if (stage && suit && fine && !reduced && matchMedia('(min-width:861px)').matches) {
    const ease = (t) => t * t * (3 - 2 * t);          // smoothstep
    let sTick = false;

    const place = () => {
      sTick = false;
      const r = stage.getBoundingClientRect();
      const span = r.height - innerHeight;
      if (span <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / span));

      // Faz 1 (0–.30): ortada, hafif yaklaşır
      // Faz 2 (.30–.62): ölçülü biçimde sola
      // Faz 3 (.62–1): sağa geçer
      let x = 0;
      if (p >= 0.30 && p < 0.62)      x = -ease((p - 0.30) / 0.32) * 15;
      else if (p >= 0.62)             x = -15 + ease((p - 0.62) / 0.38) * 30;

      const y = -ease(Math.min(1, p * 1.6)) * 2.5;     // çok hafif yükselme
      const s = 1 - ease(Math.min(1, p)) * 0.06;       // hafif uzaklaşma

      suit.style.setProperty('--sx', x.toFixed(2) + 'vw');
      suit.style.setProperty('--sy', y.toFixed(2) + 'vh');
      suit.style.setProperty('--ss', s.toFixed(3));
    };

    addEventListener('scroll', () => { if (!sTick) { sTick = true; requestAnimationFrame(place); } },
      { passive: true });
    addEventListener('resize', place, { passive: true });
    place();
  }
})();
