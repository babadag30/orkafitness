/* Orka EMS Fitness — üye ekranları (işletme sahibi demosu)

   Bu dosyada iş kuralı YOKTUR. Her karar adapter üzerinden domain motoruna
   sorulur ve gelen RuleResult gösterilir. Üyeye asla ham kapasite ya da
   sebep kodu gösterilmez (v0.5 §17). */

import { ServiceType, BookingMode, Actor, AttendanceStatus } from '../../domain/index.mjs';
import * as Store from './store.mjs';
import * as A from './adapter.mjs';
import { esc, fmt, icon, topbar, pill, empty, toast, sheet, closeSheet, startOfDay } from './ui.mjs';

/** Devam eden randevu taslağı. */
export const draft = { serviceType: null, bookingMode: BookingMode.SINGLE, day: null, startsAt: null };

export function resetDraft() {
  draft.serviceType = null;
  draft.bookingMode = BookingMode.SINGLE;
  draft.day = null;
  draft.startsAt = null;
}

const svcLabel = (s) => (s === ServiceType.EMS ? 'EMS' : 'Fitness');

/* ================================================================== */
/* Giriş                                                               */
/* ================================================================== */

export const login = () => ({
  tabs: false,
  html: `
    <div class="view" style="justify-content:center;gap:28px;min-height:100dvh">
      <div class="brand">
        <img src="assets/logo.png" alt="Orka EMS Fitness">
        <div class="center">
          <h1>Orka EMS Fitness</h1>
          <p class="small">Randevu ve paket yönetimi</p>
        </div>
      </div>

      <div class="stack">
        <div class="field">
          <label for="u">Üye numarası</label>
          <input id="u" autocomplete="username" placeholder="ORK-0142" spellcheck="false">
        </div>
        <div class="field">
          <label for="p">Parola</label>
          <input id="p" type="password" autocomplete="current-password" placeholder="••••••••">
        </div>
        <button class="btn btn--primary" data-act="signin">GİRİŞ YAP</button>
      </div>

      <div class="demohint">
        <b>Önizleme</b> — üye: <b>ORK-0142</b> · yönetici: <b>yonetici</b> · parola: <b>${esc(Store.DEMO_PASSWORD)}</b>
      </div>

      <p class="tiny muted center">Hesabını stüdyo oluşturur. Kayıt olma yoktur.</p>
    </div>`,
  after() {
    const u = document.getElementById('u');
    const p = document.getElementById('p');
    u.value = 'ORK-0142';
    p.value = Store.DEMO_PASSWORD;
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSignIn(); });
  },
  actions: { signin: doSignIn }
});

function doSignIn() {
  const u = document.getElementById('u').value;
  const p = document.getElementById('p').value;

  const admin = Store.signInAdmin(u, p);
  if (admin.ok) return location.hash = '#/admin';

  const r = Store.signInMember(u, p);
  if (!r.ok) return toast(r.msg, true);
  location.hash = '#/home';
}

/* ================================================================== */
/* Ana sayfa                                                           */
/* ================================================================== */

export function home() {
  const me = Store.currentMember();
  const use = A.usage(me.id);
  const bal = Store.balanceOf(me.id);
  const now = Date.now();

  const upcoming = Store.appointmentsOf(me.id)
    .filter(a => a.startsAt >= now && !isCancelledFor(a, me.id));
  const next = upcoming[0];

  const firstName = me.name.split(' ')[0];
  const saat = new Date(now + 3 * 3600_000).getUTCHours();
  const selam = saat < 11 ? 'Günaydın' : saat < 18 ? 'Merhaba' : 'İyi akşamlar';

  return {
    tabs: 'home',
    html: `
      <div class="view has-tabs">
        <div class="row between">
          <div>
            <p class="eyebrow">${esc(selam)}</p>
            <h1>${esc(firstName)}</h1>
          </div>
          <button class="iconbtn" data-go="notifications" aria-label="Bildirimler">${icon.bell}</button>
        </div>

        ${next ? heroCard(next, me.id) : `
          <div class="hero">
            <p class="eyebrow accent">SIRADAKİ SEANS</p>
            <div class="when">Yok</div>
            <p class="small">Henüz planlanmış bir randevun yok.</p>
          </div>`}

        <button class="btn btn--primary" data-go="book">${icon.plus} RANDEVU AL</button>

        ${use ? `
          <div class="usage">
            <div class="cell">
              <p class="eyebrow">BU HAFTA</p>
              <div class="val mono">${use.bucketUsed} <span>/ ${use.bucketLimit}</span></div>
              <div class="bar"><i style="width:${(use.bucketUsed / use.bucketLimit) * 100}%"></i></div>
            </div>
            <div class="cell">
              <p class="eyebrow">PAKET</p>
              <div class="val mono">${use.packageUsed} <span>/ ${use.packageTotal}</span></div>
              <div class="bar"><i style="width:${(use.packageUsed / use.packageTotal) * 100}%"></i></div>
            </div>
          </div>` : `
          <div class="card flat">
            <p class="eyebrow">EMS PAKETİ</p>
            <p class="small">Tanımlı EMS paketin yok. Fitness randevusu alabilirsin.</p>
          </div>`}

        ${bal.debt > 0 ? `
          <div class="card" style="border-color:rgba(251,191,36,.3)">
            <div class="row between">
              <div>
                <p class="eyebrow" style="color:var(--warn)">ÖDEME</p>
                <h3>${esc(fmt.money(bal.debt))} bakiye</h3>
              </div>
              ${pill('Stüdyoya danış', 'warn')}
            </div>
          </div>` : ''}

        <div class="stack tight">
          <div class="row between">
            <h2>Yaklaşan randevular</h2>
            ${upcoming.length > 1 ? `<button class="btn btn--ghost compact" data-go="appointments">TÜMÜ</button>` : ''}
          </div>
          ${upcoming.length
            ? upcoming.slice(0, 3).map(a => apptCard(a, me.id)).join('')
            : empty('Yaklaşan randevu yok', 'Randevu Al ile başlayabilirsin.')}
        </div>
      </div>`
  };
}

function heroCard(a, meId) {
  const others = a.participants.filter(p => p.memberId !== meId)
    .map(p => Store.member(p.memberId)?.name.split(' ')[0]).filter(Boolean);
  return `
    <button class="hero card tap" style="text-align:left" data-go="appt:${a.id}">
      <p class="eyebrow accent">SIRADAKİ SEANS</p>
      <div class="when">${esc(fmt.time(a.startsAt))}</div>
      <div class="row wrap" style="gap:8px">
        ${pill(fmt.rel(a.startsAt), 'blue')}
        ${pill(svcLabel(a.serviceType))}
        ${a.bookingMode === BookingMode.COUPLE ? pill('Çift seansı', 'warn') : ''}
      </div>
      ${others.length ? `<p class="small">Partner: ${esc(others.join(', '))}</p>` : ''}
    </button>`;
}

function apptCard(a, meId) {
  const others = a.participants.filter(p => p.memberId !== meId)
    .map(p => Store.member(p.memberId)?.name).filter(Boolean);
  const mine = a.participants.find(p => p.memberId === meId);
  return `
    <button class="card tap" data-go="appt:${a.id}">
      <div class="row between">
        <div>
          <h3>${esc(fmt.time(a.startsAt))} · ${esc(svcLabel(a.serviceType))}</h3>
          <p class="small">${esc(fmt.rel(a.startsAt))}</p>
        </div>
        ${statusPill(a, mine)}
      </div>
      ${others.length ? `<p class="tiny muted">+ ${esc(others.join(', '))}</p>` : ''}
    </button>`;
}

function statusPill(a, participant) {
  const s = participant?.attendanceStatus;
  if (s === AttendanceStatus.ATTENDED) return pill('Katıldı', 'ok');
  if (s === AttendanceStatus.NO_SHOW) return pill('Gelmedi', 'bad');
  if (s === AttendanceStatus.LATE_CANCEL) return pill('Geç iptal', 'warn');
  if (s === AttendanceStatus.MEMBER_CANCELLED) return pill('İptal edildi');
  if (s === AttendanceStatus.ADMIN_CANCELLED) return pill('Stüdyo iptal etti');
  if (a.bookingMode === BookingMode.COUPLE) return pill('Çift', 'warn');
  return pill('Planlandı', 'blue');
}

const isCancelledFor = (a, memberId) => {
  const p = a.participants.find(x => x.memberId === memberId);
  return [AttendanceStatus.MEMBER_CANCELLED, AttendanceStatus.ADMIN_CANCELLED].includes(p?.attendanceStatus);
};

/* ================================================================== */
/* Randevu al — servis seçimi                                          */
/* ================================================================== */

export function book() {
  const me = Store.currentMember();
  const use = A.usage(me.id);

  return {
    tabs: 'book',
    html: `
      <div class="view has-tabs">
        ${topbar('Randevu Al', { back: false })}
        <p class="dim">Hangi seans için randevu almak istiyorsun?</p>

        <div class="stack">
          <button class="choice" data-act="pickEms">
            <span class="ico">${icon.bolt}</span>
            <span class="txt">
              <h3>EMS</h3>
              <span class="small muted">25 dakikalık elektro kas uyarımı seansı</span>
              ${use ? `<span class="tiny muted">Paketinde ${use.packageTotal - use.packageUsed} seans kaldı</span>` : ''}
            </span>
          </button>

          <button class="choice" data-act="pickFitness">
            <span class="ico" style="background:rgba(34,211,238,.13)">${icon.dumbbell}</span>
            <span class="txt">
              <h3>Fitness</h3>
              <span class="small muted">Serbest çalışma seansı</span>
              <span class="tiny muted">EMS paketinden düşmez</span>
            </span>
          </button>
        </div>
      </div>`,
    actions: {
      pickEms() { resetDraft(); draft.serviceType = ServiceType.EMS; location.hash = '#/slots'; },
      pickFitness() { resetDraft(); draft.serviceType = ServiceType.FITNESS; location.hash = '#/slots'; }
    }
  };
}

/* ================================================================== */
/* Gün + saat seçimi                                                   */
/* ================================================================== */

export function slots() {
  const me = Store.currentMember();
  if (!draft.serviceType) { location.hash = '#/book'; return { tabs: 'book', html: '' }; }

  const days = A.days();
  if (!draft.day) draft.day = (days.find(d => d.open) ?? days[0]).startsAt;

  const isEms = draft.serviceType === ServiceType.EMS;
  const partner = isEms ? A.partner(me.id) : null;
  const couple = draft.bookingMode === BookingMode.COUPLE;

  const list = A.daySlots({
    memberId: me.id,
    serviceType: draft.serviceType,
    bookingMode: draft.bookingMode,
    dayStartsAt: draft.day
  }).filter(s => s.state !== 'GEÇTİ');

  const uygun = list.filter(s => s.allowed).length;

  return {
    tabs: 'book',
    html: `
      <div class="view has-tabs">
        ${topbar(svcLabel(draft.serviceType) + ' Randevusu')}

        ${isEms && partner ? `
          <button class="switch ${couple ? 'on' : ''}" data-act="toggleCouple">
            <span class="knob"></span>
            <span class="grow">
              <b style="font-size:14px">Partnerimle geleceğim</b>
              <span class="small muted" style="display:block">
                ${couple
                  ? `${esc(partner.name)} ile 2 kişilik özel seans`
                  : 'İki kişilik özel EMS seansı açar'}
              </span>
            </span>
          </button>` : ''}

        ${couple ? `
          <div class="card flat" style="border-color:rgba(251,191,36,.3)">
            <p class="eyebrow" style="color:var(--warn)">ÖZEL ÇİFT SEANSI</p>
            <p class="small">${esc(me.name.split(' ')[0])} + ${esc(partner.name.split(' ')[0])} — stüdyo
            bu seans boyunca yalnızca size ayrılır. Bu yüzden sadece tamamen boş saatler seçilebilir.</p>
          </div>` : ''}

        <div class="stack tight">
          <p class="eyebrow">GÜN SEÇ</p>
          <div class="daystrip">
            ${days.map(d => `
              <button class="day ${d.startsAt === draft.day ? 'on' : ''} ${d.open ? '' : 'off'}"
                      data-act="pickDay" data-t="${d.startsAt}">
                <em>${esc(fmt.dowShort(d.startsAt))}</em>
                <b>${fmt.dayNum(d.startsAt)}</b>
              </button>`).join('')}
          </div>
        </div>

        <div class="stack tight">
          <div class="row between">
            <p class="eyebrow">SAAT SEÇ</p>
            <span class="tiny muted">${uygun} uygun saat</span>
          </div>
          ${list.length ? `
            <div class="slots">
              ${list.map(s => `
                <button class="slot ${s.startsAt === draft.startsAt ? 'on' : ''} ${s.allowed ? '' : 'off'}"
                        data-act="pickSlot" data-t="${s.startsAt}" ${s.allowed ? '' : 'disabled'}
                        title="${esc(s.allowed ? 'Uygun' : s.memberMessage)}">
                  ${esc(fmt.time(s.startsAt))}
                  <small>${s.allowed ? 'Uygun' : s.state === 'KAPALI' ? 'Kapalı' : 'Dolu'}</small>
                </button>`).join('')}
            </div>`
            : empty('Bu gün kapalı', 'Başka bir gün seç.')}
        </div>

        ${draft.startsAt ? `
          <button class="btn btn--primary" data-act="goConfirm">DEVAM ET</button>` : ''}
      </div>`,
    actions: {
      toggleCouple() {
        draft.bookingMode = couple ? BookingMode.SINGLE : BookingMode.COUPLE;
        draft.startsAt = null;
        rerender();
      },
      pickDay(el) { draft.day = Number(el.dataset.t); draft.startsAt = null; rerender(); },
      pickSlot(el) { draft.startsAt = Number(el.dataset.t); rerender(); },
      goConfirm() { location.hash = '#/confirm'; }
    }
  };
}

/* ================================================================== */
/* Onay                                                                */
/* ================================================================== */

export function confirm() {
  const me = Store.currentMember();
  if (!draft.startsAt) { location.hash = '#/book'; return { tabs: 'book', html: '' }; }

  const couple = draft.bookingMode === BookingMode.COUPLE;
  const partner = couple ? A.partner(me.id) : null;

  return {
    tabs: 'book',
    html: `
      <div class="view has-tabs">
        ${topbar('Onayla')}

        <div class="hero">
          <p class="eyebrow accent">${couple ? '2 KİŞİLİK ÖZEL EMS SEANSI' : esc(svcLabel(draft.serviceType).toUpperCase() + ' SEANSI')}</p>
          <div class="when">${esc(fmt.time(draft.startsAt))}</div>
          <p>${esc(fmt.full(draft.startsAt))}</p>
        </div>

        <div class="card">
          <div class="row between"><span class="muted small">Katılımcı</span>
            <b>${esc(couple ? `${me.name.split(' ')[0]} + ${partner.name.split(' ')[0]}` : me.name)}</b></div>
          <div class="row between"><span class="muted small">Seans</span>
            <b>${esc(svcLabel(draft.serviceType))}${couple ? ' · Çift' : ''}</b></div>
          <div class="row between"><span class="muted small">Süre</span>
            <b>${A.POLICY.session.durationMinutes} dakika</b></div>
          ${draft.serviceType === ServiceType.EMS ? `
            <div class="row between"><span class="muted small">Paket</span>
              <b>${couple ? 'Her ikinizden 1 seans' : '1 seans düşer'}</b></div>` : `
            <div class="row between"><span class="muted small">Paket</span>
              <b>EMS paketinden düşmez</b></div>`}
        </div>

        ${couple ? `
          <p class="small muted">Onayladığında bu saat stüdyoda başka hiç kimseye açılmaz.</p>` : ''}

        <button class="btn btn--primary" data-act="doBook">RANDEVUYU OLUŞTUR</button>
        <button class="btn btn--ghost" data-act="back">VAZGEÇ</button>
      </div>`,
    actions: {
      doBook() {
        const r = A.book({
          memberId: me.id,
          serviceType: draft.serviceType,
          bookingMode: draft.bookingMode,
          startsAt: draft.startsAt
        });
        if (!r.ok) return toast(r.result.memberMessage, true);

        Store.notify('Randevun oluşturuldu',
          `${fmt.full(draft.startsAt)} ${fmt.time(draft.startsAt)} · ${svcLabel(draft.serviceType)}`);
        toast('Randevun oluşturuldu.');
        resetDraft();
        location.hash = '#/home';
      }
    }
  };
}

/* ================================================================== */
/* Randevularım                                                        */
/* ================================================================== */

export function appointments() {
  const me = Store.currentMember();
  const now = Date.now();
  const all = Store.appointmentsOf(me.id);
  const upcoming = all.filter(a => a.startsAt >= now && !isCancelledFor(a, me.id));
  const history = all.filter(a => a.startsAt < now || isCancelledFor(a, me.id)).reverse();

  return {
    tabs: 'appts',
    html: `
      <div class="view has-tabs">
        ${topbar('Randevularım', { back: false })}

        <div class="stack tight">
          <p class="eyebrow">YAKLAŞAN</p>
          ${upcoming.length ? upcoming.map(a => apptCard(a, me.id)).join('')
                            : empty('Yaklaşan randevu yok')}
        </div>

        <div class="stack tight">
          <p class="eyebrow">GEÇMİŞ</p>
          ${history.length ? history.slice(0, 12).map(a => apptCard(a, me.id)).join('')
                           : empty('Geçmiş kayıt yok')}
        </div>
      </div>`
  };
}

/* ================================================================== */
/* Randevu detayı + iptal                                              */
/* ================================================================== */

export function appt(params) {
  const me = Store.currentMember();
  const a = Store.get().appointments.find(x => x.id === params.id);
  if (!a) { location.hash = '#/appointments'; return { tabs: 'appts', html: '' }; }

  const mine = a.participants.find(p => p.memberId === me.id);
  const others = a.participants.filter(p => p.memberId !== me.id)
    .map(p => Store.member(p.memberId)?.name).filter(Boolean);
  const couple = a.bookingMode === BookingMode.COUPLE;
  const future = a.startsAt >= Date.now();
  const cancelCheck = future ? A.checkCancel({ appointment: a, memberId: me.id }) : null;

  return {
    tabs: 'appts',
    html: `
      <div class="view has-tabs">
        ${topbar('Randevu')}

        <div class="hero">
          <p class="eyebrow accent">${couple ? '2 KİŞİLİK ÖZEL EMS SEANSI' : esc(svcLabel(a.serviceType).toUpperCase())}</p>
          <div class="when">${esc(fmt.time(a.startsAt))}</div>
          <p>${esc(fmt.full(a.startsAt))}</p>
          <div class="row wrap" style="gap:8px">${statusPill(a, mine)}</div>
        </div>

        ${others.length ? `
          <div class="card">
            <p class="eyebrow">KATILIMCILAR</p>
            <p>${esc(me.name)}</p>
            ${others.map(n => `<p>${esc(n)}</p>`).join('')}
          </div>` : ''}

        ${couple ? `
          <div class="card flat">
            <p class="small">Bu seans yalnızca size ayrılmış özel bir çift seansıdır.
            İptal edilirse randevunun tamamı iptal olur.</p>
          </div>` : ''}

        ${future ? (cancelCheck.allowed
          ? `<button class="btn btn--danger" data-act="cancel">RANDEVUYU İPTAL ET</button>`
          : `<div class="card flat"><p class="small">${esc(cancelCheck.memberMessage)}</p></div>`) : ''}
      </div>`,
    actions: {
      cancel() {
        sheet(`
          <h2>Randevuyu iptal et</h2>
          <p class="small">${esc(fmt.full(a.startsAt))} · ${esc(fmt.time(a.startsAt))}</p>
          ${couple ? `<p class="small">Bu bir çift seansı — randevunun tamamı iptal edilecek.</p>` : ''}
          <p class="small muted">Bu paket döneminde kullanabileceğin iptal hakkı sınırlıdır.</p>
          <button class="btn btn--danger" data-act="confirmCancel">EVET, İPTAL ET</button>
          <button class="btn btn--ghost" data-act="closeSheet">VAZGEÇ</button>
        `);
      },
      confirmCancel() {
        const r = A.cancel({ appointment: a, memberId: me.id, actor: Actor.MEMBER });
        closeSheet();
        if (!r.ok) return toast(r.result.memberMessage, true);
        Store.notify('Randevun iptal edildi', `${fmt.full(a.startsAt)} ${fmt.time(a.startsAt)}`);
        toast('Randevun iptal edildi.');
        location.hash = '#/appointments';
      },
      closeSheet
    }
  };
}

/* ================================================================== */
/* Profil                                                              */
/* ================================================================== */

export function profile() {
  const me = Store.currentMember();
  const use = A.usage(me.id);
  const bal = Store.balanceOf(me.id);
  const partner = A.partner(me.id);
  const pays = Store.paymentsOf(me.id);

  const METOT = { CASH: 'Nakit', CARD: 'Kart', BANK_TRANSFER: 'Havale' };

  return {
    tabs: 'profile',
    html: `
      <div class="view has-tabs">
        ${topbar('Profil', { back: false })}

        <div class="card">
          <div class="row">
            <span class="ico" style="width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;
                  border-radius:16px;background:rgba(59,130,246,.14);color:var(--accent-2)">${icon.user}</span>
            <div class="grow">
              <h2>${esc(me.name)}</h2>
              <p class="small mono">${esc(me.memberNo)}</p>
            </div>
            ${me.active ? pill('Aktif', 'ok') : pill('Pasif', 'bad')}
          </div>
        </div>

        ${use ? `
          <div class="card">
            <p class="eyebrow">EMS PAKETİ</p>
            <div class="row between"><span class="small muted">Bu hafta</span>
              <b class="mono">${use.bucketUsed} / ${use.bucketLimit}</b></div>
            <div class="row between"><span class="small muted">Paket</span>
              <b class="mono">${use.packageUsed} / ${use.packageTotal}</b></div>
            <div class="row between"><span class="small muted">Hafta biter</span>
              <b>${esc(fmt.date(use.bucketEndsAt))}</b></div>
          </div>` : ''}

        <div class="card">
          <p class="eyebrow">ERİŞİM</p>
          <div class="row between"><span class="small muted">Fitness</span>
            ${me.fitnessAccess ? pill('Açık', 'ok') : pill('Kapalı')}</div>
          <div class="row between"><span class="small muted">EMS partneri</span>
            <b>${partner ? esc(partner.name) : '—'}</b></div>
        </div>

        <div class="card">
          <p class="eyebrow">ÖDEME</p>
          <div class="row between"><span class="small muted">Paket bedeli</span>
            <b>${esc(fmt.money(bal.due))}</b></div>
          <div class="row between"><span class="small muted">Ödenen</span>
            <b>${esc(fmt.money(bal.paid))}</b></div>
          <div class="row between"><span class="small muted">Kalan</span>
            <b style="color:${bal.debt > 0 ? 'var(--warn)' : 'var(--ok)'}">${esc(fmt.money(bal.debt))}</b></div>
          ${pays.length ? `<div style="margin-top:8px">${pays.map(p => `
            <div class="row between tiny muted" style="padding:4px 0">
              <span>${esc(fmt.date(p.paidAt))} · ${esc(METOT[p.method] ?? p.method)}</span>
              <span>${esc(fmt.money(p.amount))}</span>
            </div>`).join('')}</div>` : ''}
        </div>

        <button class="btn btn--ghost" data-act="signout">${icon.logout} ÇIKIŞ YAP</button>

        <div class="demofoot">
          Owner Review Preview · Demo Data<br>
          Veriler yalnızca bu tarayıcıda tutulur.
          <button class="btn btn--ghost compact" style="margin-top:10px" data-act="resetDemo">DEMOYU SIFIRLA</button>
        </div>
      </div>`,
    actions: {
      signout() { Store.signOut(); location.hash = '#/login'; },
      resetDemo() { Store.reset(); toast('Demo verisi sıfırlandı.'); location.hash = '#/home'; }
    }
  };
}

/* ================================================================== */
/* Bildirimler                                                         */
/* ================================================================== */

export function notifications() {
  const list = Store.get().notifications;
  Store.markRead();
  return {
    tabs: 'home',
    html: `
      <div class="view has-tabs">
        ${topbar('Bildirimler')}
        ${list.length ? list.map(n => `
          <div class="card">
            <h3>${esc(n.title)}</h3>
            <p class="small">${esc(n.body)}</p>
            <p class="tiny muted">${esc(fmt.rel(n.at))} ${esc(fmt.time(n.at))}</p>
          </div>`).join('') : empty('Bildirim yok')}
      </div>`
  };
}

let rerender = () => {};
export const setRerender = (fn) => { rerender = fn; };
