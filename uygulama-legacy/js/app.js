/* Orka EMS Fitness — yönlendirici ve uygulama kabuğu */

const App = (() => {
  const root = () => document.getElementById('app');
  let current = null;      // { name, params, screen }
  let toastTimer = null;

  const draft = {};        // devam eden randevu taslağı

  const PUBLIC = ['welcome', 'login', 'verify'];

  const TABS = [
    { key: 'home',    route: 'home',         label: 'ANA SAYFA',    icon: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
    { key: 'book',    route: 'service',      label: 'RANDEVU AL',   icon: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v8M8 12h8' },
    { key: 'appts',   route: 'appointments', label: 'RANDEVULARIM', icon: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4' },
    { key: 'profile', route: 'profile',      label: 'PROFİL',       icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0' }
  ];

  function parseHash() {
    const raw = (location.hash || '#/welcome').replace(/^#\/?/, '');
    // Yalnızca İLK iki nokta ayırıcıdır — parametrenin kendisi iki nokta
    // içerebilir (örn. adminSession:2026-08-05_20:30).
    const i = raw.indexOf(':');
    const name = i === -1 ? raw : raw.slice(0, i);
    const param = i === -1 ? undefined : raw.slice(i + 1);
    return { name: name || 'welcome', params: { id: param } };
  }

  function go(target, opts = {}) {
    const hash = '#/' + target;
    if (location.hash === hash) return render();   // hashchange tetiklenmez, elle çiz
    if (opts.replace) location.replace(hash);
    else location.hash = hash;
  }

  /** Taslağı yerinde günceller. Doğrudan `App.draft = {}` ataması modül içindeki
      referansı koparacağı için her zaman bu kullanılmalı. */
  function setDraft(obj) {
    Object.keys(draft).forEach(k => delete draft[k]);
    Object.assign(draft, obj || {});
  }

  function back() {
    if (history.length > 1) history.back();
    else go('home', { replace: true });
  }

  function render() {
    const { name, params } = parseHash();
    const signedIn = Store.get().session.signedIn;

    if (!signedIn && !PUBLIC.includes(name)) return go('welcome', { replace: true });

    const factory = Screens[name] || Screens.home;
    const screen = factory(params);
    current = { name, params, screen };

    const el = root();
    // Yönetici paneli geniş ekranda telefon çerçevesinden çıkar
    el.classList.toggle('full', !!screen.full);
    el.innerHTML = screen.html + tabsHtml(screen.tabs) + `<div class="toast" id="toast"></div>` + installHtml();
    el.querySelector('.view').classList.add('fade');
    el.querySelector('.view').scrollTop = 0;

    if (screen.after) screen.after();
    document.title = 'Orka EMS Fitness';
  }

  function tabsHtml(active) {
    if (!active) return '';
    const unread = Store.unreadCount();
    const bekleyen = Store.pendingRequests().length;
    const dot = (key) => (key === 'home' && unread) || (key === 'profile' && bekleyen);
    return `<nav class="tabbar">${TABS.map(t => `
      <button class="tab ${t.key === active ? 'active' : ''}" data-go="${t.route}" aria-label="${t.label}">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg>
        <span>${t.label}</span>
        ${dot(t.key) ? '<i class="dot"></i>' : ''}
      </button>`).join('')}</nav>`;
  }

  function paintTabs() {
    if (current && current.screen.tabs) {
      const nav = document.querySelector('.tabbar');
      if (nav) nav.outerHTML = tabsHtml(current.screen.tabs);
    }
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /** Taslağı gerçek randevuya çevirir. PRD §3 adım 5 ve 7. */
  function confirmBooking(status) {
    const d = draft;
    const me = Store.me();
    const rec = {
      date: d.date, time: d.time, service: d.service,
      mode: d.mode || 'SOLO', member: me.no, status
    };
    if (rec.mode === 'PARTNER') {
      const p = Store.partner();
      if (p) rec.partnerOf = p.no;
    }
    const id = Store.addBooking(rec);

    if (status === 'PENDING') {
      Store.notify('TALEBİN İLETİLDİ', `${d.time} seansı için talebin yönetici onayına gönderildi.`);
      go('pending:' + id, { replace: true });
    } else {
      Store.notify('RANDEVUN OLUŞTURULDU', `${d.time} ${d.service === 'EMS' ? 'EMS' : 'Fitness'} seansın onaylandı.`);
      go('confirm:' + id, { replace: true });
    }
    draft.time = null;
  }

  /* ---------- kurulum çubuğu ---------- */
  let deferredPrompt = null;
  function installHtml() {
    const dismissed = sessionStorage.getItem('orka.install.dismissed');
    if (!deferredPrompt || dismissed) return '';
    return `<div class="install show" id="install">
      <p>Uygulamayı ana ekranına ekle — tam ekran açılır ve çevrimdışı çalışır.</p>
      <button data-act="install">EKLE</button>
      <button class="x" data-act="dismissInstall" aria-label="Kapat">✕</button>
    </div>`;
  }

  /* ---------- olay yönlendirme ---------- */
  document.addEventListener('click', (e) => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) { e.preventDefault(); return go(goEl.dataset.go); }

    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const name = actEl.dataset.act;

    if (name === 'back') { e.preventDefault(); return back(); }
    if (name === 'adminBack') { e.preventDefault(); return back(); }
    if (name === 'adminExit') { e.preventDefault(); return go('profile'); }
    if (name === 'install') {
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
      const el = document.getElementById('install'); if (el) el.remove();
      return;
    }
    if (name === 'dismissInstall') {
      sessionStorage.setItem('orka.install.dismissed', '1');
      const el = document.getElementById('install'); if (el) el.remove();
      return;
    }
    const fns = current && current.screen.actions;
    if (fns && typeof fns[name] === 'function') { e.preventDefault(); fns[name](actEl); }
  });

  window.addEventListener('hashchange', render);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    render();
  });

  function boot() {
    if (!location.hash) {
      location.replace(Store.get().session.signedIn ? '#/home' : '#/welcome');
    }
    render();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // Tarayıcı servis çalışanı güncellemesini kendiliğinden aramayabiliyor;
      // aramazsa kullanıcı yeni sürüm yayınlansa bile eski kodda takılı kalır.
      // Bu yüzden her açılışta ve saatte bir açıkça kontrol ediyoruz.
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.update();
        setInterval(() => reg.update(), 60 * 60 * 1000);
      }).catch(() => { /* çevrimdışı desteği yok */ });

      // Yeni sürüm devralınca sayfayı bir kez tazele. İlk kurulumda
      // controller zaten yoktu — o durumda yeniden yükleme gereksiz.
      const vardi = !!navigator.serviceWorker.controller;
      let tazelendi = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!vardi || tazelendi) return;
        tazelendi = true;
        location.reload();
      });
    }
  }

  return { go, back, render, paintTabs, toast, confirmBooking, draft, setDraft, boot };
})();

document.addEventListener('DOMContentLoaded', App.boot);
