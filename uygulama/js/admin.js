/* Orka EMS Fitness — yönetici paneli ekranları
   Figma karşılıkları: A02 Günlük Takvim, A03 Haftalık Takvim, A04 Seans Detayı,
   A05 Onay Kuyruğu, A06 Üyeler, A07 Üye Detayı, A08 Partner Talepleri, A09 Ayarlar.
   900px altında telefon düzeni, üstünde tam genişlikte masaüstü paneli. */

(() => {

const NAV = [
  ['admin',         'TAKVİM'],
  ['adminRequests', 'TALEPLER'],
  ['adminMembers',  'ÜYELER'],
  ['adminSettings', 'AYARLAR']
];

const GUN_TAM = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function shell(active, title, inner) {
  const bekleyen = Store.pendingRequests().length + Store.partnerRequests().length;
  return `<div class="view admin">
    <div class="topbar">
      <button class="back" data-act="adminBack" aria-label="Geri">
        <svg width="22" height="30" viewBox="0 0 22 30" fill="none"><path d="M15 6 L8 15 L15 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <h1 class="title">${esc(title)}</h1>
    </div>

    <header class="adminbar">
      <img src="assets/logo.png" alt="" width="34" height="34">
      <b>ORKA EMS FITNESS</b>
      <span class="pill red"><i></i>YÖNETİCİ</span>
      <nav>${NAV.map(([r, l]) => `<a class="${r === active ? 'on' : ''}" data-go="${r}">${l}</a>`).join('')}</nav>
      <span class="grow"></span>
      ${bekleyen
        ? `<span class="pill orange"><i></i>${bekleyen} BEKLEYEN TALEP</span>`
        : '<span class="pill green"><i></i>BEKLEYEN TALEP YOK</span>'}
      <button class="btn btn--secondary" data-act="adminExit" style="min-height:38px;font-size:11px">UYGULAMAYA DÖN</button>
    </header>

    <div class="adminnav">${NAV.map(([r, l]) => `
      <button class="navchip ${r === active ? 'on' : ''}" data-go="${r}">${l}${
        r === 'adminRequests' && bekleyen ? ` <b>${bekleyen}</b>` : ''}</button>`).join('')}
    </div>

    ${inner}
    <div class="spacer"></div>
  </div>`;
}

const pill = (txt, cls) => `<span class="pill ${cls || ''}"><i></i>${esc(txt)}</span>`;

function meterHtml(occ, cls) {
  const cap = Rules.CAP.TOTAL;
  const dolu = occ.ems + occ.fitness;
  return `<div class="meter">${Array.from({ length: cap }, (_, i) =>
    `<i class="${i < dolu ? 'on ' + (cls || 'green') : ''}"></i>`).join('')}</div>`;
}

/* ============================ A02 — Günlük Takvim ============================ */
Screens.admin = () => {
  const day = App.adminDate || Store.iso(new Date());
  const times = Rules.slotsForDate(day);
  const now = new Date();
  const nowKey = Store.iso(now) + now.toTimeString().slice(0, 5);
  const bekleyen = Store.pendingRequests().length;

  const boxes = times.map(t => {
    const occ = Store.occupancy(day, t);
    const r = Rules.status(occ, 'EMS', 'SOLO');
    const past = (day + t) < nowKey;
    const cls = past ? '' : STATUS_CLS[r.status];
    const names = Store.bookingsAt(day, t)
      .filter(b => b.status === 'CONFIRMED')
      .map(b => { const m = Store.member(b.member); return m ? m.name.split(' ')[0] : '—'; });
    const talep = Store.pendingAt(day, t).length;
    return `<button class="slotbox tap ${cls} ${past ? 'past' : ''}" data-go="adminSession:${day}_${t}">
      <div class="row"><b class="grow">${t}</b>${past ? pill('GEÇTİ') : pill(STATUS_TR[r.status], cls)}</div>
      ${meterHtml(occ, cls)}
      <p class="small muted">EMS ${occ.ems}/${Rules.CAP.EMS} · FIT ${occ.fitness}/${Rules.CAP.FITNESS}</p>
      <p class="small who">${names.length ? esc(names.join(', ')) : (occ.adminClosed ? esc(occ.closedReason) : '—')}</p>
      ${talep ? `<p class="small" style="color:var(--orange);font-weight:700">${talep} talep bekliyor</p>` : ''}
    </button>`;
  }).join('');

  return {
    tabs: false, full: true,
    html: shell('admin', 'TAKVİM', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">${Store.iso(new Date()) === day ? 'BUGÜN' : GUN_TAM[new Date(day + 'T00:00:00').getDay()].toUpperCase()}</p>
          <h2 class="adminh2">${fmt.long(day)}</h2>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn--secondary compact" data-act="dayPrev">‹ ÖNCEKİ</button>
          <button class="btn btn--secondary compact" data-act="dayToday">BUGÜN</button>
          <button class="btn btn--secondary compact" data-act="dayNext">SONRAKİ ›</button>
          <button class="btn btn--secondary compact" data-go="adminWeek">HAFTA</button>
        </div>
      </div>
      ${bekleyen ? `<button class="card tap orange" data-go="adminRequests">
        <div class="row"><h3 class="grow">${bekleyen} SEANS TALEBİ ONAY BEKLİYOR</h3>${pill('GÖRÜNTÜLE', 'orange')}</div>
      </button>` : ''}
      <div class="legend">
        ${pill('UYGUN — BOŞ', 'green')}${pill('KISMEN DOLU — ONAY GEREKİR', 'orange')}${pill('KAPALI VEYA DOLU', 'red')}
        <span class="grow"></span>
        <span class="small muted">${times.length} seans · ${Rules.SESSION_MIN} dk + ${Rules.BUFFER_MIN} dk tampon = ${Rules.CADENCE} dk kadans</span>
      </div>
      ${times.length ? `<div class="slotboxes">${boxes}</div>`
                     : '<div class="card"><h3>STÜDYO KAPALI</h3><p>Bu gün için tanımlı çalışma saati yok.</p></div>'}
    `),
    actions: {
      dayPrev() { App.adminDate = shiftDay(day, -1); App.render(); },
      dayNext() { App.adminDate = shiftDay(day, 1); App.render(); },
      dayToday() { App.adminDate = Store.iso(new Date()); App.render(); }
    }
  };
};

function shiftDay(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return Store.iso(d);
}

/* ============================ A03 — Haftalık Takvim ============================ */
Screens.adminWeek = () => {
  const start = App.adminWeekStart || mondayOf(Store.iso(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const now = new Date();
  const nowKey = Store.iso(now) + now.toTimeString().slice(0, 5);

  // Haftadaki tüm olası saatlerin birleşimi
  const allTimes = [...new Set(days.flatMap(d => Rules.slotsForDate(d)))].sort();

  const rows = allTimes.map(t => `
    <tr>
      <th>${t}</th>
      ${days.map(d => {
        if (!Rules.slotsForDate(d).includes(t)) return '<td class="off"><span>—</span></td>';
        const occ = Store.occupancy(d, t);
        const r = Rules.status(occ, 'EMS', 'SOLO');
        const past = (d + t) < nowKey;
        const cls = past ? 'past' : STATUS_CLS[r.status];
        const label = occ.adminClosed ? 'KAPALI'
          : occ.exclusiveCouple ? 'ÇİFT'
          : (occ.ems + occ.fitness) === 0 ? 'BOŞ'
          : `${occ.ems + occ.fitness}/${Rules.CAP.TOTAL}`;
        return `<td><button class="wcell ${cls}" data-go="adminSession:${d}_${t}" title="${d} ${t}">${label}</button></td>`;
      }).join('')}
    </tr>`).join('');

  return {
    tabs: false, full: true,
    html: shell('admin', 'HAFTALIK TAKVİM', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">HAFTALIK GÖRÜNÜM</p>
          <h2 class="adminh2">${fmt.med(start)} – ${fmt.med(days[6])}</h2>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn--secondary compact" data-act="weekPrev">‹ ÖNCEKİ</button>
          <button class="btn btn--secondary compact" data-act="weekThis">BU HAFTA</button>
          <button class="btn btn--secondary compact" data-act="weekNext">SONRAKİ ›</button>
          <button class="btn btn--secondary compact" data-go="admin">GÜN</button>
        </div>
      </div>
      <div class="legend">
        ${pill('BOŞ', 'green')}${pill('KISMEN DOLU', 'orange')}${pill('KAPALI / DOLU', 'red')}
        <span class="grow"></span><span class="small muted">Hücreye dokun → seans detayı</span>
      </div>
      <div class="tablewrap">
        <table class="weektable">
          <thead><tr><th>SAAT</th>${days.map(d => `<th class="${Store.iso(new Date()) === d ? 'today' : ''}">${fmt.dow(d)}<span>${new Date(d + 'T00:00:00').getDate()}</span></th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `),
    actions: {
      weekPrev() { App.adminWeekStart = shiftDay(start, -7); App.render(); },
      weekNext() { App.adminWeekStart = shiftDay(start, 7); App.render(); },
      weekThis() { App.adminWeekStart = mondayOf(Store.iso(new Date())); App.render(); }
    }
  };
};

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  const diff = (d.getDay() + 6) % 7;   // Pazartesi = 0
  d.setDate(d.getDate() - diff);
  return Store.iso(d);
}

/* ============================ A04 — Seans Detayı ============================ */
Screens.adminSession = (p) => {
  const [day, time] = String(p.id || '').split('_');
  const occ = Store.occupancy(day, time);
  const r = Rules.status(occ, 'EMS', 'SOLO');
  const cls = STATUS_CLS[r.status];
  const kayitlar = Store.bookingsAt(day, time);

  return {
    tabs: false, full: true,
    html: shell('admin', 'SEANS DETAYI', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">${esc(fmt.long(day))}</p>
          <h2 class="adminh2">${esc(time)} – ${Rules.endTime(time)} ${pill(STATUS_TR[r.status], cls)}</h2>
        </div>
        <button class="btn btn--secondary compact" data-go="admin">TAKVİME DÖN</button>
      </div>

      <div class="admincols">
        <div class="col">
          <div class="card">
            <p class="eyebrow">KATILIMCILAR</p>
            ${kayitlar.length ? kayitlar.map(b => {
              const m = Store.member(b.member);
              const st = b.status === 'PENDING' ? ['orange', 'ONAY BEKLİYOR']
                       : b.status === 'NO_SHOW' ? ['red', 'GELMEDİ']
                       : ['green', 'ONAYLANDI'];
              return `<div class="lrow">
                <div class="grow">
                  <b>${esc(m ? m.name : b.member)}</b>
                  <p class="small muted">${esc(b.member)} · ${b.service === 'EMS' ? 'EMS' : 'Fitness'} · ${b.mode === 'PARTNER' ? 'Partnerimle' : 'Tek başına'}</p>
                </div>
                ${pill(st[1], st[0])}
                ${b.status === 'CONFIRMED' ? `<button class="btn btn--danger compact" data-act="noShow" data-v="${b.id}">GELMEDİ</button>` : ''}
                <button class="btn btn--secondary compact" data-go="adminMember:${b.member}">KART</button>
              </div>`;
            }).join('') : '<p class="small muted">Bu seansta kayıt yok.</p>'}
          </div>

          <div class="card">
            <p class="eyebrow">KONTENJAN</p>
            ${[['EMS', occ.ems, Rules.CAP.EMS], ['FITNESS', occ.fitness, Rules.CAP.FITNESS],
               ['TOPLAM STÜDYO', occ.ems + occ.fitness, Rules.CAP.TOTAL]].map(([n, f, c]) => `
              <div>
                <div class="row"><b class="small">${n}</b><span class="grow"></span><b class="small">${f}/${c}</b></div>
                <div class="meter">${Array.from({ length: c }, (_, i) => `<i class="${i < f ? 'on ' + (cls || 'green') : ''}"></i>`).join('')}</div>
              </div>`).join('')}
            <p class="small muted">${esc(r.reason)}</p>
          </div>
        </div>

        <div class="col side">
          <div class="card">
            <p class="eyebrow">SEANS AKSİYONLARI</p>
            ${occ.adminClosed
              ? `<p class="small">Kapatma sebebi: <b>${esc(occ.closedReason)}</b></p>
                 <button class="btn btn--primary" data-act="openSlot">SEANSI AÇ</button>`
              : `<button class="btn btn--danger" data-act="closeSlot">SEANSI KAPAT</button>
                 <p class="small muted">Seansı kapatırsan mevcut randevular iptal edilir ve müşterilere bildirim gider.</p>`}
          </div>
          <div class="card">
            <p class="eyebrow">BİLGİ</p>
            <div class="kv">Süre<b>${Rules.SESSION_MIN} dk</b></div>
            <div class="kv">Tampon<b>${Rules.BUFFER_MIN} dk</b></div>
            <div class="kv">Bekleyen talep<b>${Store.pendingAt(day, time).length}</b></div>
          </div>
        </div>
      </div>
    `),
    actions: {
      noShow(el) {
        const b = Store.markNoShow(el.dataset.v);
        const m = Store.member(b.member);
        App.toast(`${m ? m.name : 'Üye'} gelmedi olarak işaretlendi.`);
        App.render();
      },
      closeSlot() {
        if (!confirm('Seans kapatılacak ve mevcut randevular iptal edilecek. Devam?')) return;
        Store.closeSlot(day, time, 'Yönetici kapattı');
        Store.notify('SEANS İPTAL EDİLDİ', `${fmt.med(day)} ${time} seansı stüdyo tarafından kapatıldı.`);
        App.toast('Seans kapatıldı.');
        App.render();
      },
      openSlot() { Store.openSlot(day, time); App.toast('Seans açıldı.'); App.render(); }
    }
  };
};

/* ==================== A05 + A08 — Talepler ==================== */
Screens.adminRequests = () => {
  const seans = Store.pendingRequests();
  const partner = Store.partnerRequests();

  return {
    tabs: false, full: true,
    html: shell('adminRequests', 'TALEPLER', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">YÖNETİCİ ONAYI GEREKEN</p>
          <h2 class="adminh2">TALEPLER</h2>
        </div>
        <span class="small muted">Ortalama karar süresi hedefi: 2 saat</span>
      </div>

      <p class="eyebrow">SEANS TALEPLERİ · ${seans.length}</p>
      ${seans.length ? seans.map(b => {
        const m = Store.member(b.member);
        const occ = Store.occupancy(b.date, b.time);
        const r = Rules.status(occ, b.service, b.mode);
        return `<div class="card orange reqcard">
          <div class="grow">
            <div class="row">
              <b>${esc(m ? m.name : b.member)}</b>
              <span class="small muted">${esc(b.member)}</span>
              ${pill('KISMEN DOLU', 'orange')}
            </div>
            <p><b>${fmt.med(b.date)} · ${b.time}</b> · ${b.service === 'EMS' ? 'EMS' : 'Fitness'} · ${b.mode === 'PARTNER' ? 'Partnerimle' : 'Tek başıma'}</p>
            <p class="small muted">Şu anki doluluk: EMS ${occ.ems}/${Rules.CAP.EMS} · Fitness ${occ.fitness}/${Rules.CAP.FITNESS}${
              r.status === 'RED' ? ' — bu talep artık kapasiteye sığmıyor' : ''}</p>
          </div>
          <div class="row acts">
            <button class="btn btn--danger compact" data-act="reject" data-v="${b.id}">REDDET</button>
            <button class="btn btn--primary compact" data-act="approve" data-v="${b.id}">ONAYLA</button>
          </div>
        </div>`;
      }).join('') : '<div class="card"><p class="small muted">Bekleyen seans talebi yok.</p></div>'}

      <p class="eyebrow" style="margin-top:8px">PARTNER TALEPLERİ · ${partner.length}</p>
      ${partner.length ? partner.map(p => {
        const a = Store.member(p.from), b = Store.member(p.to);
        return `<div class="card orange reqcard">
          <div class="grow">
            <div class="row">
              <b>${esc(a ? a.name : p.from)}</b>
              <span style="color:var(--blue);font-weight:700">→</span>
              <b>${esc(b ? b.name : p.to)}</b>
              ${pill('ONAY BEKLİYOR', 'orange')}
              <span class="small muted">${esc(p.when)}</span>
            </div>
            <p class="small muted">Onaylarsan iki profil partner olur ve EMS seanslarında "Partnerimle" modunu kullanabilirler.${
              (a && a.partner) || (b && b.partner) ? ' Taraflardan birinin mevcut bağlantısı çözülecek.' : ''}</p>
          </div>
          <div class="row acts">
            <button class="btn btn--danger compact" data-act="pReject" data-v="${p.id}">REDDET</button>
            <button class="btn btn--primary compact" data-act="pApprove" data-v="${p.id}">ONAYLA</button>
          </div>
        </div>`;
      }).join('') : '<div class="card"><p class="small muted">Bekleyen partner talebi yok.</p></div>'}
    `),
    actions: {
      approve(el) {
        const b = Store.get().bookings.find(x => x.id === el.dataset.v);
        const r = Rules.status(Store.occupancy(b.date, b.time), b.service, b.mode);
        if (r.status === 'RED') {
          Store.setBookingStatus(b.id, 'REJECTED');
          Store.notify('TALEBİN REDDEDİLDİ', `${fmt.med(b.date)} ${b.time} seansı bu arada doldu.`);
          App.toast('Kapasite dolduğu için onaylanamadı.');
        } else {
          Store.setBookingStatus(b.id, 'CONFIRMED');
          Store.notify('TALEBİN ONAYLANDI', `${fmt.med(b.date)} ${b.time} seansın onaylandı.`);
          App.toast('Talep onaylandı.');
        }
        App.render();
      },
      reject(el) {
        const b = Store.setBookingStatus(el.dataset.v, 'REJECTED');
        Store.notify('TALEBİN REDDEDİLDİ', `${fmt.med(b.date)} ${b.time} seansı için talebin reddedildi.`);
        App.toast('Talep reddedildi.');
        App.render();
      },
      pApprove(el) { Store.decidePartner(el.dataset.v, true); App.toast('Partner bağlantısı kuruldu.'); App.render(); },
      pReject(el) { Store.decidePartner(el.dataset.v, false); App.toast('Partner talebi reddedildi.'); App.render(); }
    }
  };
};

/* ============================ A06 — Üyeler ============================ */
Screens.adminMembers = () => {
  const q = (App.adminQuery || '').toLocaleLowerCase('tr');
  const all = Store.memberList();
  const list = q ? all.filter(m =>
    m.name.toLocaleLowerCase('tr').includes(q) ||
    m.no.toLocaleLowerCase('tr').includes(q) ||
    m.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) : all;

  return {
    tabs: false, full: true,
    html: shell('adminMembers', 'ÜYELER', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">${all.length} KAYITLI ÜYE</p>
          <h2 class="adminh2">ÜYELER</h2>
        </div>
        <input class="input search" id="memberSearch" placeholder="Ad, telefon veya üye no ara"
               value="${esc(App.adminQuery || '')}" autocomplete="off">
      </div>

      <div class="tablewrap">
        <table class="datatable">
          <thead><tr>
            <th>ÜYE NO</th><th>AD SOYAD</th><th>TELEFON</th><th>PARTNER</th>
            <th>GELMEME</th><th>DURUM</th><th></th>
          </tr></thead>
          <tbody>
            ${list.length ? list.map(m => {
              const p = m.partner ? Store.member(m.partner) : null;
              const uyari = m.noShow >= Rules.NO_SHOW_THRESHOLD;
              return `<tr>
                <td class="mono">${esc(m.no)}</td>
                <td><b>${esc(m.name)}</b></td>
                <td class="muted">${esc(m.phone)}</td>
                <td class="${p ? '' : 'muted'}">${p ? esc(p.name) : '—'}</td>
                <td class="${uyari ? 'warn' : 'muted'}">${m.noShow}${uyari ? ' ⚠' : ''}</td>
                <td>${m.active ? pill('AKTİF', 'green') : pill('PASİF', 'red')}</td>
                <td><button class="btn btn--secondary compact" data-go="adminMember:${m.no}">AÇ</button></td>
              </tr>`;
            }).join('') : '<tr><td colspan="7" class="muted" style="padding:20px">Eşleşen üye yok.</td></tr>'}
          </tbody>
        </table>
      </div>
    `),
    after() {
      const s = document.getElementById('memberSearch');
      if (!s) return;
      s.addEventListener('input', () => {
        App.adminQuery = s.value;
        const pos = s.selectionStart;
        App.render();
        const n = document.getElementById('memberSearch');
        if (n) { n.focus(); n.setSelectionRange(pos, pos); }
      });
    }
  };
};

/* ============================ A07 — Üye Detayı ============================ */
Screens.adminMember = (p) => {
  const m = Store.member(p.id);
  if (!m) return { tabs: false, full: true, html: shell('adminMembers', 'ÜYE', '<div class="card"><p>Üye bulunamadı.</p></div>') };
  const partner = m.partner ? Store.member(m.partner) : null;
  const gecmis = Store.bookingsOf(m.no).slice(0, 12);
  const uyari = m.noShow >= Rules.NO_SHOW_THRESHOLD;

  const stLabel = (s) => s === 'CONFIRMED' ? ['green', 'Onaylandı']
    : s === 'PENDING' ? ['orange', 'Onay bekliyor']
    : s === 'NO_SHOW' ? ['red', 'Gelmedi']
    : s === 'REJECTED' ? ['red', 'Reddedildi'] : ['red', 'İptal edildi'];

  return {
    tabs: false, full: true,
    html: shell('adminMembers', 'ÜYE DETAYI', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">‹ ÜYELERE DÖN</p>
          <h2 class="adminh2">${esc(m.name)} ${m.active ? pill('AKTİF ÜYE', 'green') : pill('PASİF', 'red')}</h2>
        </div>
        <button class="btn btn--secondary compact" data-go="adminMembers">LİSTEYE DÖN</button>
      </div>

      <div class="admincols">
        <div class="col">
          <div class="card">
            <p class="eyebrow">KİMLİK</p>
            <div class="kv">Üye numarası<b>${esc(m.no)}</b></div>
            <div class="kv">Telefon<b>${esc(m.phone)}</b></div>
            <div class="kv">Kayıt tarihi<b>${esc(m.joined)}</b></div>
          </div>
          <div class="card">
            <p class="eyebrow">RANDEVU GEÇMİŞİ · ${Store.bookingsOf(m.no).length}</p>
            ${gecmis.length ? gecmis.map(b => {
              const st = stLabel(b.status);
              return `<div class="lrow">
                <b class="small" style="min-width:120px">${fmt.med(b.date)} · ${b.time}</b>
                <span class="small muted grow">${b.service === 'EMS' ? 'EMS' : 'Fitness'} · ${b.mode === 'PARTNER' ? 'Partnerimle' : 'Tek başına'}</span>
                ${pill(st[1].toLocaleUpperCase('tr'), st[0])}
              </div>`;
            }).join('') : '<p class="small muted">Kayıt yok.</p>'}
          </div>
        </div>

        <div class="col side">
          <div class="card ${partner ? 'green' : ''}">
            <p class="eyebrow">PARTNER</p>
            ${partner ? `
              <div class="kv">Bağlı profil<b>${esc(partner.name)}</b></div>
              <div class="kv">Üye numarası<b>${esc(partner.no)}</b></div>
              <p class="small muted">Bağlantıyı kaldırırsan gelecekteki çift randevuları iptal edilir.</p>
              <button class="btn btn--danger" data-act="unlink">BAĞLANTIYI KALDIR</button>
            ` : '<p class="small muted">Bağlı partner yok. Bağlantı, üyenin talebi ve yönetici onayıyla kurulur.</p>'}
          </div>

          <div class="card ${uyari ? 'orange' : ''}">
            <p class="eyebrow">DEVAMSIZLIK</p>
            <div class="kv">Gelmeme (no-show)<b>${m.noShow} kez</b></div>
            <div class="kv">Geç kalma<b>${m.late || 0} kez</b></div>
            <p class="small muted">Uyarı eşiği ${Rules.NO_SHOW_THRESHOLD} gelmedir.${
              uyari ? ' <b>Eşik aşıldı.</b> Kısıtlama otomatik uygulanmaz, karar yöneticinindir.' : ''}</p>
          </div>

          <div class="card">
            <p class="eyebrow">HESAP</p>
            <button class="btn btn--secondary" data-act="toggleActive">${m.active ? 'ÜYEYİ PASİFLEŞTİR' : 'ÜYEYİ AKTİFLEŞTİR'}</button>
            <p class="small muted">Pasif üye uygulamaya giriş yapamaz. Randevu kayıtları silinmez.</p>
          </div>
        </div>
      </div>
    `),
    actions: {
      unlink() {
        if (!confirm('Partner bağlantısı kaldırılacak ve gelecekteki çift randevuları iptal edilecek. Devam?')) return;
        Store.unlinkPartner(m.no);
        App.toast('Bağlantı kaldırıldı.');
        App.render();
      },
      toggleActive() {
        Store.setMemberActive(m.no, !m.active);
        App.toast(m.active ? 'Üye pasifleştirildi.' : 'Üye aktifleştirildi.');
        App.render();
      }
    }
  };
};

/* ============================ A09 — Ayarlar ============================ */
Screens.adminSettings = () => {
  const c = Rules.config();
  const gunler = [1, 2, 3, 4, 5, 6, 0];
  const ornek = Store.iso(new Date());
  const slotSayisi = (gun) => {
    const h = c.hours[gun];
    if (!h || !h.open || !h.close) return 0;
    const cad = c.sessionMin + c.bufferMin;
    let n = 0;
    for (let t = Rules.toMin(h.open); t + c.sessionMin <= Rules.toMin(h.close); t += cad) n++;
    return n;
  };

  return {
    tabs: false, full: true,
    html: shell('adminSettings', 'AYARLAR', `
      <div class="row between adminhead">
        <div>
          <p class="eyebrow">STÜDYO YAPILANDIRMASI</p>
          <h2 class="adminh2">AYARLAR</h2>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn--secondary compact" data-act="resetCfg">VARSAYILANA DÖN</button>
          <button class="btn btn--primary compact" data-act="saveCfg">DEĞİŞİKLİKLERİ KAYDET</button>
        </div>
      </div>

      <div class="admin-note">Buradaki değerler kural motorunu doğrudan besler. Kaydettiğin an
      seans ızgarası, kapasite hesabı ve iptal penceresi tüm uygulamada değişir.</div>

      <div class="admincols">
        <div class="col">
          <div class="card">
            <p class="eyebrow">ÇALIŞMA SAATLERİ</p>
            ${gunler.map(g => {
              const h = c.hours[g] || {};
              return `<div class="lrow">
                <b class="small" style="min-width:96px">${GUN_TAM[g]}</b>
                <input class="input tiny" type="time" data-h="${g}" data-k="open" value="${h.open || ''}">
                <span class="muted">–</span>
                <input class="input tiny" type="time" data-h="${g}" data-k="close" value="${h.close || ''}">
                <span class="grow"></span>
                <span class="small muted">${slotSayisi(g)} seans</span>
              </div>`;
            }).join('')}
            <p class="small muted">Bir günü kapatmak için saatleri boş bırak.</p>
          </div>

          <div class="card">
            <p class="eyebrow">SEANS DÜZENİ</p>
            <div class="lrow"><b class="small grow">Seans süresi (dk)</b>
              <input class="input tiny" type="number" min="5" max="120" data-cfg="sessionMin" value="${c.sessionMin}"></div>
            <div class="lrow"><b class="small grow">Seanslar arası tampon (dk)</b>
              <input class="input tiny" type="number" min="0" max="60" data-cfg="bufferMin" value="${c.bufferMin}"></div>
            <div class="kv">Kadans (otomatik)<b>${c.sessionMin + c.bufferMin} dk</b></div>
            <div class="kv">Bugün üretilen seans<b>${Rules.slotsForDate(ornek).length}</b></div>
          </div>
        </div>

        <div class="col">
          <div class="card">
            <p class="eyebrow">KONTENJAN</p>
            <div class="lrow"><b class="small grow">EMS kontenjanı</b>
              <input class="input tiny" type="number" min="1" max="10" data-cap="EMS" value="${c.caps.EMS}"></div>
            <div class="lrow"><b class="small grow">Fitness kontenjanı</b>
              <input class="input tiny" type="number" min="1" max="10" data-cap="FITNESS" value="${c.caps.FITNESS}"></div>
            <div class="lrow"><b class="small grow">Toplam eşzamanlı müşteri</b>
              <input class="input tiny" type="number" min="1" max="10" data-cap="TOTAL" value="${c.caps.TOTAL}"></div>
            <p class="small muted">Çift seansı yalnızca EMS için geçerlidir ve 2 yer tüketir.</p>
          </div>

          <div class="card">
            <p class="eyebrow">İPTAL VE DEVAMSIZLIK</p>
            <div class="lrow"><b class="small grow">Serbest iptal süresi (saat)</b>
              <input class="input tiny" type="number" min="0" max="72" data-cfg="cancelWindowH" value="${c.cancelWindowH}"></div>
            <div class="lrow"><b class="small grow">Geç kalma toleransı (dk)</b>
              <input class="input tiny" type="number" min="0" max="60" data-cfg="lateToleranceMin" value="${c.lateToleranceMin}"></div>
            <div class="lrow"><b class="small grow">No-show uyarı eşiği</b>
              <input class="input tiny" type="number" min="1" max="20" data-cfg="noShowThreshold" value="${c.noShowThreshold}"></div>
          </div>

          <div class="card">
            <p class="eyebrow">PRD DURUMU</p>
            <p class="small muted">Bu değerler PRD v0.2 §21'de hâlâ işletmeci onayı bekliyor.
            Onaylandığında burada sabitlenir ve teklif belgesine yazılır.</p>
          </div>
        </div>
      </div>
    `),
    actions: {
      saveCfg() {
        const hours = {};
        document.querySelectorAll('[data-h]').forEach(i => {
          const g = i.dataset.h;
          hours[g] = hours[g] || {};
          hours[g][i.dataset.k] = i.value;
        });
        Object.keys(hours).forEach(g => {
          if (!hours[g].open || !hours[g].close) hours[g] = null;
        });

        const patch = { hours, caps: {} };
        document.querySelectorAll('[data-cfg]').forEach(i => { patch[i.dataset.cfg] = Number(i.value); });
        document.querySelectorAll('[data-cap]').forEach(i => { patch.caps[i.dataset.cap] = Number(i.value); });

        if (patch.sessionMin < 5) return App.toast('Seans süresi en az 5 dakika olmalı.');
        if (patch.caps.TOTAL < Math.max(patch.caps.EMS, patch.caps.FITNESS)) {
          return App.toast('Toplam kapasite, tekil kontenjanlardan küçük olamaz.');
        }
        Store.saveConfig(patch);
        App.toast('Ayarlar kaydedildi. Kurallar güncellendi.');
        App.render();
      },
      resetCfg() {
        if (!confirm('Ayarlar PRD varsayılanlarına dönecek. Devam?')) return;
        Store.resetConfig();
        App.toast('Varsayılan ayarlara dönüldü.');
        App.render();
      }
    }
  };
};

})();
