/* Orka EMS Fitness — ekranlar
   Her ekran Figma dosyasındaki karşılığıyla aynı adı taşır. */

const AY = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const AY_KISA = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const GUN = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const GUN_KISA = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

const fmt = {
  long: (i) => { const d = new Date(i + 'T00:00:00'); return `${d.getDate()} ${AY[d.getMonth()]} ${GUN[d.getDay()]}`; },
  med:  (i) => { const d = new Date(i + 'T00:00:00'); return `${d.getDate()} ${AY[d.getMonth()]}`; },
  short:(i) => { const d = new Date(i + 'T00:00:00'); return `${d.getDate()} ${AY_KISA[d.getMonth()]}`; },
  dow:  (i) => GUN_KISA[new Date(i + 'T00:00:00').getDay()],
  isToday: (i) => i === Store.iso(new Date())
};

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const backBtn = `<button class="back" data-act="back" aria-label="Geri">
  <svg width="22" height="30" viewBox="0 0 22 30" fill="none"><path d="M15 6 L8 15 L15 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>`;

const STATUS_TR = { GREEN: 'UYGUN', ORANGE: 'ONAY GEREKİR', RED: 'KAPALI' };
const STATUS_CLS = { GREEN: 'green', ORANGE: 'orange', RED: 'red' };

const Screens = {

  /* ---------------- 09 — Karşılama ---------------- */
  welcome: () => ({
    tabs: false,
    html: `<div class="view centered">
      <img class="logo" src="assets/logo.png" alt="Orka EMS Fitness" width="150" height="150">
      <h1 class="title" style="margin-top:12px">ORKA EMS FITNESS</h1>
      <p class="sub">EMS ve Fitness · 25 dakikalık seanslar</p>
      <div class="spacer"></div>
      <button class="btn btn--primary" data-go="login">GİRİŞ YAP</button>
      <p class="sub small">Üyeliğin yoksa stüdyoyla iletişime geç.</p>
    </div>`
  }),

  /* ---------------- 09B — Giriş ---------------- */
  login: () => ({
    tabs: false,
    html: `<div class="view">
      ${backBtn}
      <img class="logo" src="assets/logo.png" alt="" width="72" height="72">
      <h1 class="title">GİRİŞ YAP</h1>
      <p class="sub">Telefon numaranla giriş yap.</p>
      <div class="field">
        <label for="phone">TELEFON NUMARAN</label>
        <input class="input" id="phone" type="tel" inputmode="tel" placeholder="+90 5XX XXX XX XX" value="+90 551 274 45 22" autocomplete="tel">
      </div>
      <div class="card">
        <h3>DOĞRULAMA</h3>
        <p>Numarana 6 haneli bir doğrulama kodu göndereceğiz.</p>
      </div>
      <p class="sub small muted">Demo: numara kayıtlı olduğu sürece herhangi bir değer çalışır.</p>
      <div class="spacer"></div>
      <button class="btn btn--primary" data-act="sendCode">KOD GÖNDER</button>
    </div>`,
    actions: {
      sendCode() {
        const v = document.getElementById('phone').value.trim();
        if (v.replace(/\D/g, '').length < 10) return App.toast('Geçerli bir telefon numarası gir.');
        App.draft.phone = v;
        App.go('verify');
      }
    }
  }),

  /* ---------------- 09C — Doğrulama Kodu ---------------- */
  verify: () => ({
    tabs: false,
    html: `<div class="view">
      ${backBtn}
      <img class="logo" src="assets/logo.png" alt="" width="72" height="72">
      <h1 class="title">DOĞRULAMA KODU</h1>
      <p class="sub">${esc(App.draft.phone || '')} numarasına gönderdik.</p>
      <div class="codeboxes">
        ${[0,1,2,3,4,5].map(i => `<input class="codebox" data-code="${i}" inputmode="numeric" maxlength="1" aria-label="${i+1}. hane">`).join('')}
      </div>
      <div class="card">
        <h3>KOD GELMEDİ Mİ?</h3>
        <p>Demo sürümünde kod <b>000000</b>. Alanlara dokununca otomatik dolar.</p>
      </div>
      <div class="spacer"></div>
      <button class="btn btn--primary" data-act="verify">DOĞRULA</button>
    </div>`,
    after() {
      const boxes = [...document.querySelectorAll('.codebox')];
      boxes[0] && boxes[0].focus();
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
          b.value = b.value.replace(/\D/g, '').slice(0, 1);
          if (b.value && boxes[i + 1]) boxes[i + 1].focus();
        });
        b.addEventListener('focus', () => {
          // demo kolaylığı: ilk odakta kodu doldur
          if (boxes.every(x => !x.value)) boxes.forEach(x => x.value = '0');
        });
        b.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus();
        });
      });
    },
    actions: {
      verify() {
        const code = [...document.querySelectorAll('.codebox')].map(b => b.value).join('');
        if (code.length < 6) return App.toast('6 haneli kodu gir.');
        Store.signIn(App.draft.phone || '');
        App.go('home', { replace: true });
      }
    }
  }),

  /* ---------------- 05 — Ana Sayfa ---------------- */
  home: () => {
    const next = Store.upcoming()[0];
    const me = Store.me();
    return {
      tabs: 'home',
      html: `<div class="view has-tabs">
        <img class="logo" src="assets/logo.png" alt="" width="80" height="80">
        <h1 class="title">Hoş geldin, ${esc(me.name.split(' ')[0])}</h1>
        <p class="sub">${next ? 'Bir sonraki seansın' : 'Yaklaşan seansın yok'}</p>
        ${next ? `
          <button class="card tap ${next.status === 'PENDING' ? 'orange' : 'blue'}" data-go="detail:${next.id}">
            <div class="row">
              <h3 class="grow">${next.service === 'EMS' ? 'EMS' : 'FITNESS'} · ${fmt.med(next.date).toUpperCase()}</h3>
              ${next.status === 'PENDING' ? '<span class="pill orange"><i></i>ONAY BEKLİYOR</span>' : '<span class="pill blue"><i></i>ONAYLANDI</span>'}
            </div>
            <p>${next.time} – ${Rules.endTime(next.time)} · ${Rules.SESSION_MIN} dakika${next.mode === 'PARTNER' ? ' · Partnerinle' : ''}</p>
          </button>` : `
          <div class="card"><h3>HENÜZ RANDEVUN YOK</h3><p>Uygun saatler yeşil görünür. İlk seansını seçmek için randevu al.</p></div>`}
        <button class="btn btn--primary" data-go="service">RANDEVU AL</button>
        <button class="card tap" data-go="notifications">
          <div class="row">
            <h3 class="grow">BİLDİRİMLER</h3>
            ${Store.unreadCount() ? `<span class="pill red"><i></i>${Store.unreadCount()} YENİ</span>` : '<span class="pill"><i></i>GÜNCEL</span>'}
          </div>
          <p>Onay sonuçları ve seans hatırlatmaları.</p>
        </button>
        <div class="spacer"></div>
        <div class="card">
          <p class="eyebrow">STÜDYO</p>
          <p>Emek Mah. Yahya Kemal Cad. No: 63/A, Burdur</p>
          <p class="muted small">Pzt–Cmt 08:00–23:30 · Paz 10:00–22:00</p>
        </div>
      </div>`
    };
  },

  /* ---------------- 01 — Hizmet Seçimi ---------------- */
  service: () => {
    const s = App.draft.service;
    return {
      tabs: 'book',
      html: `<div class="view has-tabs">
        <img class="logo" src="assets/logo.png" alt="" width="64" height="64">
        <h1 class="title">Randevu Oluştur</h1>
        <p class="sub">Önce hizmetini seç.</p>
        <button class="card tap ${s === 'EMS' ? 'blue' : ''}" data-act="pick" data-v="EMS">
          <h3 style="${s === 'EMS' ? 'color:var(--blue)' : ''}">EMS</h3>
          <p>${Rules.SESSION_MIN} dakika · 1–${Rules.CAP.EMS} kişi</p>
        </button>
        <button class="card tap ${s === 'FITNESS' ? 'blue' : ''}" data-act="pick" data-v="FITNESS">
          <h3 style="${s === 'FITNESS' ? 'color:var(--blue)' : ''}">Fitness</h3>
          <p>${Rules.SESSION_MIN} dakika · ${Rules.CAP.FITNESS} kişi</p>
        </button>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="next" ${s ? '' : 'disabled'}>${s ? 'DEVAM ET' : 'HİZMET SEÇ'}</button>
      </div>`,
      actions: {
        pick(el) { App.draft.service = el.dataset.v; App.draft.mode = 'SOLO'; App.render(); },
        next() {
          if (!App.draft.service) return;
          // Partner modu yalnızca EMS için — PRD §5A
          if (App.draft.service === 'EMS' && Store.partner()) App.go('mode');
          else App.go('slots');
        }
      }
    };
  },

  /* ---------------- 01B — Randevu Tipi ---------------- */
  mode: () => {
    const p = Store.partner();
    const m = App.draft.mode;
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}<h1 class="title">KİMLE?</h1></div>
        <div class="card blue">
          <h3>PARTNERİN: ${esc((p ? p.name : '').toUpperCase())}</h3>
          <p>Profilin partner hesabıyla bağlı.</p>
        </div>
        <button class="card tap ${m === 'SOLO' ? 'blue' : ''}" data-act="pick" data-v="SOLO">
          <h3 style="${m === 'SOLO' ? 'color:var(--blue)' : ''}">TEK BAŞIMA</h3>
          <p>Normal seans kapasitesi uygulanır.</p>
        </button>
        <button class="card tap ${m === 'PARTNER' ? 'blue' : ''}" data-act="pick" data-v="PARTNER">
          <h3 style="${m === 'PARTNER' ? 'color:var(--blue)' : ''}">PARTNERİMLE</h3>
          <p>Seans sadece ikinize ayrılır. İki EMS yeri kullanılır, kalan yerler üçüncü kişilere kapanır.</p>
        </button>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="next">SEANSLARA GİT</button>
      </div>`,
      actions: {
        pick(el) { App.draft.mode = el.dataset.v; App.render(); },
        next() { App.go('slots'); }
      }
    };
  },

  /* ---------------- 02 — Tarih ve Seans ---------------- */
  slots: () => {
    const d = App.draft;
    const days = [];
    for (let i = 0; i < 7; i++) days.push(Store.addDays(i));

    const nowKey = Store.iso(new Date()) + new Date().toTimeString().slice(0, 5);
    // Geçmiş saatler listelenmez — bugünün kalanı gösterilir.
    const remaining = (date) => Rules.slotsForDate(date).filter(t => (date + t) >= nowKey);

    if (!d.date) d.date = days.find(x => remaining(x).length) || days[0];

    const times = remaining(d.date);
    const partial = fmt.isToday(d.date) && times.length < Rules.slotsForDate(d.date).length;

    const cells = times.map(t => {
      const occ = Store.occupancy(d.date, t);
      const r = Rules.status(occ, d.service, d.mode);
      const cls = STATUS_CLS[r.status];
      const label = STATUS_TR[r.status];
      return `<button class="slot ${cls} ${d.time === t ? 'sel' : ''}" data-act="pickTime" data-v="${t}"
        ${r.status === 'RED' ? 'disabled' : ''} aria-label="${t} — ${label}">
        ${t}<em>${label}</em></button>`;
    }).join('');

    let detail = '';
    if (d.time) {
      const occ = Store.occupancy(d.date, d.time);
      const r = Rules.status(occ, d.service, d.mode);
      detail = `<div class="card ${STATUS_CLS[r.status]}">
        <div class="row"><h3 class="grow">${d.time} SEÇİLDİ</h3>
          <span class="pill ${STATUS_CLS[r.status]}"><i></i>${STATUS_TR[r.status]}</span></div>
        <p>${esc(r.reason)}</p>
        <p class="muted small">EMS ${occ.ems}/${Rules.CAP.EMS} · Fitness ${occ.fitness}/${Rules.CAP.FITNESS} · Toplam ${occ.ems + occ.fitness}/${Rules.CAP.TOTAL}</p>
      </div>`;
    }

    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}<h1 class="title">SEANSINI SEÇ</h1></div>
        <p class="sub">${d.service === 'EMS' ? 'EMS' : 'Fitness'}${d.mode === 'PARTNER' ? ' · Partnerimle' : ''} · ${Rules.SESSION_MIN} dakika</p>
        <div class="datestrip">
          ${days.map(x => `<button class="datechip ${x === d.date ? 'active' : ''} ${remaining(x).length ? '' : 'closed'}"
            data-act="pickDate" data-v="${x}">${fmt.short(x)}<span>${fmt.isToday(x) ? 'Bugün' : fmt.dow(x)}</span></button>`).join('')}
        </div>
        <div class="legend">
          <span class="pill green"><i></i>UYGUN</span>
          <span class="pill orange"><i></i>ONAY GEREKİR</span>
          <span class="pill red"><i></i>KAPALI</span>
        </div>
        ${partial ? '<p class="sub small muted left">Bugünün kalan seansları gösteriliyor.</p>' : ''}
        ${times.length
          ? `<div class="slotgrid">${cells}</div>`
          : `<div class="card"><h3>${Rules.isOpenOn(d.date) ? 'BUGÜN İÇİN SEANS KALMADI' : 'STÜDYO KAPALI'}</h3>
               <p>${Rules.isOpenOn(d.date) ? 'Yukarıdan başka bir gün seçebilirsin.' : 'Bu gün stüdyo kapalı.'}</p></div>`}
        ${detail}
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="next" ${d.time ? '' : 'disabled'}>DEVAM ET</button>
      </div>`,
      actions: {
        pickDate(el) { App.draft.date = el.dataset.v; App.draft.time = null; App.render(); },
        pickTime(el) { App.draft.time = el.dataset.v; App.render(); },
        next() {
          const dd = App.draft;
          if (!dd.time) return;
          const r = Rules.status(Store.occupancy(dd.date, dd.time), dd.service, dd.mode);
          if (r.status === 'RED') return App.toast('Bu seans seçilemez.');
          if (r.status === 'ORANGE') return App.go('warn');
          App.confirmBooking('CONFIRMED');
        }
      }
    };
  },

  /* ---------------- 03 — Turuncu Seans Uyarısı ---------------- */
  warn: () => {
    const d = App.draft;
    const occ = Store.occupancy(d.date, d.time);
    const r = Rules.status(occ, d.service, d.mode);
    const alts = Rules.greenAlternatives(d.date, d.service, d.mode, Store.occupancy, 3);
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}</div>
        <div class="spacer"></div>
        <h1 class="title">BU SEANS KISMEN DOLU</h1>
        <div class="card orange">
          <h3>${d.time} · ${d.service === 'EMS' ? 'EMS' : 'FITNESS'}</h3>
          <p>${esc(r.reason)} Yeşil bir saat seçmenizi öneriyoruz.</p>
        </div>
        ${alts.length ? `<div class="card">
          <p class="eyebrow">ÖNERİLEN UYGUN SAATLER</p>
          <div class="slotgrid">${alts.map(t => `<button class="slot green" data-act="useAlt" data-v="${t}">${t}<em>UYGUN</em></button>`).join('')}</div>
        </div>` : `<div class="card"><p>Bu gün için uygun yeşil seans kalmadı. Başka bir gün deneyebilirsin.</p></div>`}
        <p class="sub">Devam edersen talebin yönetici onayına gönderilir.</p>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="back">UYGUN SAAT SEÇ</button>
        <button class="btn btn--secondary" data-act="send">ONAYA GÖNDER</button>
      </div>`,
      actions: {
        useAlt(el) { App.draft.time = el.dataset.v; App.confirmBooking('CONFIRMED'); },
        send() { App.confirmBooking('PENDING'); }
      }
    };
  },

  /* ---------------- 04 — Randevu Onayı ---------------- */
  confirm: (p) => {
    const b = Store.get().bookings.find(x => x.id === p.id);
    return {
      tabs: false,
      html: `<div class="view">
        <div class="spacer"></div>
        <h1 class="title">RANDEVUN HAZIR</h1>
        <p class="sub">Seans onaylandı.</p>
        <div class="card green">
          <h3>${b.service === 'EMS' ? 'EMS' : 'FITNESS'} SEANSI</h3>
          <p>${fmt.long(b.date)} · ${b.time} – ${Rules.endTime(b.time)}</p>
          <p class="muted">${Rules.SESSION_MIN} dakika${b.mode === 'PARTNER' ? ' · Partnerinle (özel çift seansı)' : ''}</p>
        </div>
        <div class="card">
          <p class="eyebrow">HATIRLATMA</p>
          <p>Seanstan 2 saat önce bildirim göndereceğiz. Stüdyoda 5 dakika önce olmanı öneririz.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-go="appointments">RANDEVULARIMA GİT</button>
        <button class="btn btn--secondary" data-go="home">ANA SAYFAYA DÖN</button>
      </div>`
    };
  },

  /* ---------------- 04B — Onay Bekliyor ---------------- */
  pending: (p) => {
    const b = Store.get().bookings.find(x => x.id === p.id);
    return {
      tabs: false,
      html: `<div class="view">
        <div class="spacer"></div>
        <h1 class="title">TALEBİN İLETİLDİ</h1>
        <p class="sub">Yönetici onayı bekleniyor.</p>
        <div class="card orange">
          <h3>${fmt.med(b.date).toUpperCase()} · ${b.time}</h3>
          <p>${b.service === 'EMS' ? 'EMS' : 'Fitness'} · ${Rules.SESSION_MIN} dakika · ${b.mode === 'PARTNER' ? 'Partnerimle' : 'Tek başıma'}</p>
        </div>
        <div class="card">
          <h3>SONRA NE OLACAK?</h3>
          <p>Bu seans kısmen dolu olduğu için talebin yöneticiye iletildi. Karar verildiğinde bildirim alacaksın. Talebini o ana kadar geri çekebilirsin.</p>
        </div>
        <div class="admin-note">
          <b>Demo:</b> Onay akışını görmek için Profil → Yönetici Paneli ekranından talebi onaylayabilir ya da reddedebilirsin.
        </div>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-go="appointments">RANDEVULARIMA GİT</button>
        <button class="btn btn--danger" data-act="withdraw" data-v="${b.id}">TALEBİ GERİ ÇEK</button>
      </div>`,
      actions: {
        withdraw(el) {
          Store.setBookingStatus(el.dataset.v, 'CANCELLED');
          App.toast('Talebin geri çekildi.');
          App.go('appointments', { replace: true });
        }
      }
    };
  },

  /* ---------------- 06 / 06D — Randevularım ---------------- */
  appointments: () => {
    const list = Store.upcoming();
    return {
      tabs: 'appts',
      html: `<div class="view has-tabs">
        <h1 class="title">RANDEVULARIM</h1>
        <p class="sub">Yaklaşan randevuların</p>
        ${list.length ? list.map(b => {
          const st = b.status === 'PENDING'
            ? ['orange', 'ONAY BEKLİYOR'] : ['green', 'ONAYLANDI'];
          return `<button class="card tap ${st[0]}" data-go="detail:${b.id}">
            <div class="row"><h3 class="grow">${b.service === 'EMS' ? 'EMS' : 'FITNESS'} SEANSI</h3>
              <span class="pill ${st[0]}"><i></i>${st[1]}</span></div>
            <p>${fmt.long(b.date)} · ${b.time}</p>
            ${b.mode === 'PARTNER' ? '<p class="muted small">Partnerinle · özel çift seansı</p>' : ''}
          </button>`;
        }).join('') : `
          <div class="spacer"></div>
          <div class="card" style="align-items:center;text-align:center;padding:32px 18px">
            <h3>HENÜZ RANDEVUN YOK</h3>
            <p>İlk seansını seçmek için randevu al. Uygun saatler yeşil görünür.</p>
          </div>
          <button class="btn btn--primary" data-go="service">RANDEVU AL</button>`}
        <div class="spacer"></div>
      </div>`
    };
  },

  /* ---------------- 06B — Randevu Detayı ---------------- */
  detail: (p) => {
    const b = Store.get().bookings.find(x => x.id === p.id);
    if (!b) return { tabs: false, html: '<div class="view"><p class="sub">Randevu bulunamadı.</p></div>' };
    const can = Rules.canCancel(b.date, b.time);
    const st = b.status === 'PENDING' ? ['orange', 'ONAY BEKLİYOR'] : ['green', 'ONAYLANDI'];
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}<h1 class="title">RANDEVU DETAYI</h1></div>
        <div class="card ${st[0]}">
          <div class="row"><h3 class="grow">${b.service === 'EMS' ? 'EMS' : 'FITNESS'} SEANSI</h3>
            <span class="pill ${st[0]}"><i></i>${st[1]}</span></div>
          <p>${fmt.long(b.date)} · ${b.time} – ${Rules.endTime(b.time)}</p>
          <p class="muted">${b.mode === 'PARTNER' ? 'Partnerinle · özel çift seansı' : 'Tek başına'}</p>
        </div>
        <div class="card">
          <p class="eyebrow">STÜDYO</p>
          <p>Emek Mah. Yahya Kemal Cad. No: 63/A, Burdur</p>
          <a href="https://www.google.com/maps/dir/?api=1&destination=Emek%20Mah.%20Yahya%20Kemal%20Cad.%20No%2063A%20Burdur"
             target="_blank" rel="noopener" style="color:var(--blue);font-weight:700;font-size:13px;text-decoration:none">YOL TARİFİ AL →</a>
        </div>
        <div class="card">
          <p class="eyebrow">İPTAL KOŞULU</p>
          <p>${can.ok
            ? `Seansa ${Rules.CANCEL_WINDOW_H} saatten fazla var, uygulamadan iptal edebilirsin.`
            : esc(can.reason)}</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--danger" data-act="cancel" data-v="${b.id}" ${can.ok ? '' : 'disabled'}>RANDEVUYU İPTAL ET</button>
        ${can.ok ? '' : '<a class="btn btn--secondary" href="tel:+905512744522" style="text-decoration:none">STÜDYOYU ARA</a>'}
      </div>`,
      actions: { cancel(el) { App.go('cancel:' + el.dataset.v); } }
    };
  },

  /* ---------------- 06C — İptal Onayı ---------------- */
  cancel: (p) => {
    const b = Store.get().bookings.find(x => x.id === p.id);
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}</div>
        <div class="spacer"></div>
        <h1 class="title">RANDEVUYU İPTAL ET</h1>
        <p class="sub">Bu işlem geri alınamaz.</p>
        <div class="card red">
          <h3>${b.service === 'EMS' ? 'EMS' : 'FITNESS'} SEANSI</h3>
          <p>${fmt.long(b.date)} · ${b.time}</p>
        </div>
        <div class="card">
          <h3>NE OLACAK?</h3>
          <p>Yerin anında diğer üyelere açılır. Aynı saati tekrar istersen yeniden randevu alman gerekir.${b.mode === 'PARTNER' ? ' Çift seansı bozulur ve partnerine bildirim gider.' : ''}</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="back">VAZGEÇ</button>
        <button class="btn btn--danger" data-act="doCancel" data-v="${b.id}">EVET, İPTAL ET</button>
      </div>`,
      actions: {
        doCancel(el) {
          const bb = Store.setBookingStatus(el.dataset.v, 'CANCELLED');
          Store.notify('RANDEVU İPTAL EDİLDİ', `${fmt.med(bb.date)} ${bb.time} seansın iptal edildi.`);
          App.toast('Randevun iptal edildi.');
          App.go('appointments', { replace: true });
        }
      }
    };
  },

  /* ---------------- 07 — Profil ---------------- */
  profile: () => {
    const me = Store.me(), p = Store.partner();
    const bekleyen = Store.pendingRequests().length;
    return {
      tabs: 'profile',
      html: `<div class="view has-tabs">
        <h1 class="title">PROFİL</h1>
        <p class="sub">Hesap ve partner ayarların</p>
        <div class="card">
          <h3>${esc(me.name.toUpperCase())}</h3>
          <p class="muted">Üye No · ${esc(me.no)}</p>
          <p class="muted">${esc(me.phone)}</p>
        </div>
        <button class="card tap" data-go="partner">
          <div class="row"><h3 class="grow">PARTNER</h3><span class="pill ${p ? 'green' : ''}"><i></i>${p ? 'BAĞLI' : 'YOK'}</span></div>
          <p>${p ? esc(p.name) + ' · yönetici onaylı' : 'Çift seansı için partner bağlantısı kur.'}</p>
        </button>
        <button class="card tap" data-go="notifications">
          <div class="row"><h3 class="grow">BİLDİRİMLER</h3>
            ${Store.unreadCount() ? `<span class="pill red"><i></i>${Store.unreadCount()}</span>` : ''}</div>
          <p>Uygulama bildirimi açık · SMS ve WhatsApp kapalı</p>
        </button>
        <button class="card tap ${bekleyen ? 'orange' : 'blue'}" data-go="admin">
          <div class="row"><h3 class="grow" style="color:${bekleyen ? 'var(--text)' : 'var(--blue)'}">YÖNETİCİ PANELİ</h3>
            ${bekleyen
              ? `<span class="pill orange"><i></i>${bekleyen} TALEP</span>`
              : '<span class="pill blue"><i></i>DEMO</span>'}</div>
          <p>${bekleyen
            ? `${bekleyen} talep yönetici kararı bekliyor. Onayla ya da reddet.`
            : 'Onay kuyruğunu ve günün seanslarını yönet. Sunumda turuncu onay akışını göstermek için.'}</p>
        </button>
        <div class="spacer"></div>
        <button class="btn btn--secondary" data-act="reset">DEMO VERİSİNİ SIFIRLA</button>
        <button class="btn btn--danger" data-act="signout">ÇIKIŞ YAP</button>
      </div>`,
      actions: {
        signout() { Store.signOut(); App.go('welcome', { replace: true }); },
        reset() {
          if (!confirm('Tüm demo randevuları ve bildirimleri sıfırlanacak. Devam?')) return;
          Store.reset(); App.setDraft({}); App.toast('Demo verisi sıfırlandı.'); App.go('home', { replace: true });
        }
      }
    };
  },

  /* ---------------- 08 — Partner ---------------- */
  partner: () => {
    const p = Store.partner();
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}<h1 class="title">PARTNER</h1></div>
        <p class="sub">Bağlı hesabın ve çift seansı kuralları</p>
        ${p ? `<div class="card green">
          <div class="row"><h3 class="grow">${esc(p.name.toUpperCase())}</h3><span class="pill green"><i></i>BAĞLI</span></div>
          <p class="muted">Üye No · ${esc(p.no)} · yönetici onaylı</p>
        </div>` : `<div class="card"><h3>PARTNER YOK</h3><p>Bağlantı yönetici onayıyla kurulur.</p></div>`}
        <div class="card">
          <h3>ÇİFT SEANSI NASIL ÇALIŞIR?</h3>
          <p>Partnerimle modu yalnızca EMS için geçerlidir. Seans tamamen boşsa ve EMS'de ${Rules.CAP.EMS} kişilik kontenjan açıksa yeşil görünür. Onayladığında iki EMS yeri kullanılır; kalan EMS yeri ile Fitness yeri üçüncü kişilere kapanır.</p>
        </div>
        <div class="card orange">
          <h3>SEANS KISMEN DOLUYSA</h3>
          <p>Çift randevusu turuncu görünür. Sistem önce boş yeşil seans önerir; devam edersen talep yönetici onayına düşer.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--primary" data-act="bookPartner">PARTNERİMLE RANDEVU AL</button>
      </div>`,
      actions: {
        bookPartner() {
          App.setDraft({ service: 'EMS', mode: 'PARTNER', date: Store.iso(new Date()), time: null });
          App.go('slots');
        }
      }
    };
  },

  /* ---------------- 10 — Bildirimler ---------------- */
  notifications: () => {
    const list = Store.get().notifications;
    setTimeout(() => { Store.markNotificationsRead(); App.paintTabs(); }, 600);
    return {
      tabs: false,
      html: `<div class="view">
        <div class="topbar">${backBtn}<h1 class="title">BİLDİRİMLER</h1></div>
        ${list.length ? list.map(n => `<div class="card ${n.read ? '' : 'blue'}">
          ${n.read ? '' : '<p class="eyebrow blue">OKUNMADI</p>'}
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.body)}</p>
          <p class="muted small">${esc(n.when)}</p>
        </div>`).join('') : `<div class="card"><h3>BİLDİRİM YOK</h3><p>Onay sonuçları ve hatırlatmalar burada görünecek.</p></div>`}
        <div class="spacer"></div>
      </div>`
    };
  }
};
