/* Orka EMS Fitness — yönetici ekranları (işletme sahibi demosu)

   Takvim, randevu kartları, sürükle-bırak, kes/yapıştır, katılım, manuel
   randevu, seans aç/kapat, üyeler ve manuel ödeme.

   Taşıma doğrulaması TEK yoldan geçer: adapter.checkMove → domain
   validateReschedule. Sürükle-bırak ve yapıştır aynı fonksiyonu çağırır. */

import {
  ServiceType, BookingMode, Actor, AttendanceStatus, AppointmentStatus, DEMO_PROVISIONAL_NOTES
} from '../../domain/index.mjs';
import * as Store from './store.mjs';
import * as A from './adapter.mjs';
import * as AP from './admin-push.mjs';
import {
  esc, fmt, icon, pill, toast, sheet, swapSheet, closeSheet, isSheetOpen,
  startOfDay, monthStart, addMonths, dowOf, GUN_KISA_PZT
} from './ui.mjs';

const DAY = 86_400_000;
const NAV = [['admin', 'TAKVİM'], ['adminMembers', 'ÜYELER'], ['adminSettings', 'AYARLAR']];

/** Görünüm durumu — yeniden çizimden etkilenmesin diye modül seviyesinde. */
export const view = { mode: 'week', anchor: null };
/** Uygulama içi pano. İşletim sistemi panosu KULLANILMAZ (v0.5 §22). */
export const clipboard = { appointmentId: null };

let rerender = () => {};
export const setRerender = (fn) => { rerender = fn; };

const svc = (s) => (s === ServiceType.EMS ? 'EMS' : 'Fitness');
const anchorDay = () => view.anchor ?? startOfDay(Date.now());

/* Hafta görünümü, seçili günden başlayan yuvarlanan 7 günlük penceredir.
   Sabit Pzt–Paz ızgarası, haftanın son gününde ekranı geçmişle doldururdu;
   stüdyo için asıl değerli olan "önümüzdeki 7 gün". */

/* ------------------------------------------------------------------ */
/* Kabuk                                                                */
/* ------------------------------------------------------------------ */

function shell(active, inner) {
  return `
    <div class="view">
      <header class="adminbar">
        <img class="logo" src="assets/logo.png" alt="">
        <b style="font-size:13px;letter-spacing:-.01em">ORKA · YÖNETİM</b>
        <nav>${NAV.map(([r, l]) =>
          `<a class="${r === active ? 'on' : ''}" data-go="${r}">${l}</a>`).join('')}</nav>
        <span class="grow"></span>
        ${clipboard.appointmentId ? pill('Taşınmayı bekliyor · Esc', 'warn') : ''}
        <button class="iconbtn ghost" data-act="signout" title="Çıkış">${icon.logout}</button>
      </header>
      ${inner}
      <div class="demofoot">Owner Review Preview · Demo Data</div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Takvim                                                               */
/* ------------------------------------------------------------------ */

export function admin() {
  const mode = view.mode;
  const start = anchorDay();

  const HEAD = {
    day:   ['GÜNLÜK GÖRÜNÜM', fmt.full(start)],
    week:  ['7 GÜNLÜK GÖRÜNÜM', `${fmt.date(start)} – ${fmt.date(start + 6 * DAY)}`],
    month: ['AYLIK GENEL BAKIŞ', fmt.monthYear(start)]
  };
  const [eyebrow, title] = HEAD[mode] ?? HEAD.week;

  const segBtn = (m, label) =>
    `<button class="${mode === m ? 'on' : ''}" data-act="mode${m[0].toUpperCase()}${m.slice(1)}">${label}</button>`;

  return {
    tabs: false, wide: true,
    html: shell('admin', `
      <div class="row between wrap" style="gap:var(--sp-3)">
        <div>
          <p class="eyebrow">${esc(eyebrow)}</p>
          <h2>${esc(title)}</h2>
        </div>
        <div class="row" style="gap:var(--sp-3)">
          <div class="row" style="gap:6px">
            <button class="btn btn--secondary compact" data-act="prev" aria-label="Önceki">‹</button>
            <button class="btn btn--secondary compact" data-act="today">BUGÜN</button>
            <button class="btn btn--secondary compact" data-act="next" aria-label="Sonraki">›</button>
          </div>
          <div class="seg">${segBtn('day', 'GÜN')}${segBtn('week', 'HAFTA')}${segBtn('month', 'AY')}</div>
        </div>
      </div>

      <div class="row wrap" style="gap:8px">
        ${pill('EMS', 'blue')}${pill('Fitness')}${pill('Çift · münhasır', 'warn')}
        <span class="grow"></span>
        <span class="tiny muted">${mode === 'month'
          ? 'Genel bakış — düzenlemek için bir güne tıkla'
          : 'Kartı sürükle · sağ tık: Kes / Yapıştır · Ctrl/Cmd+X, +V'}</span>
      </div>

      ${mode === 'month' ? monthHtml(start) : gridHtml(mode, start)}
    `),
    actions: {
      prev() {
        view.anchor = mode === 'month' ? addMonths(start, -1)
                    : anchorDay() - (mode === 'week' ? 7 : 1) * DAY;
        rerender();
      },
      next() {
        view.anchor = mode === 'month' ? addMonths(start, 1)
                    : anchorDay() + (mode === 'week' ? 7 : 1) * DAY;
        rerender();
      },
      today() { view.anchor = startOfDay(Date.now()); rerender(); },
      modeDay() { view.mode = 'day'; rerender(); },
      modeWeek() { view.mode = 'week'; rerender(); },
      modeMonth() { view.mode = 'month'; rerender(); },
      /* Ay yalnızca genel bakıştır: gün seçilince düzenlenebilir GÜN görünümü açılır. */
      pickDay(el) { view.anchor = Number(el.dataset.t); view.mode = 'day'; rerender(); },
      signout() { Store.signOut(); location.hash = '#/login'; },
      openAppt(el) { apptSheet(el.dataset.id); },
      openSlot(el) { slotSheet(Number(el.dataset.t)); }
    }
  };
}

/* ---------------- GÜN / HAFTA ızgarası ---------------- */

function gridHtml(mode, start) {
  const isWeek = mode === 'week';
  const days = isWeek ? Array.from({ length: 7 }, (_, i) => start + i * DAY) : [start];

  const times = [...new Set(days.flatMap(d => A.slotsOfDay(d).map(t => t - startOfDay(t))))]
    .sort((a, b) => a - b);

  const today = startOfDay(Date.now());
  const nowT = Date.now();

  const rows = times.map(off => `
    <tr>
      <th>${esc(fmt.time(start + off))}</th>
      ${days.map(d => {
        const t = d + off;
        const open = A.slotsOfDay(d).includes(t);
        if (!open) return '<td class="dayoff"></td>';
        return `<td class="${t <= nowT && nowT < t + 30 * 60_000 ? 'now' : ''}">${cellHtml(t)}</td>`;
      }).join('')}
    </tr>`).join('');

  /* Sütun genişlikleri CSS'te sabitlenir (table-layout:fixed): saat sütunu
     sabit, kalan alan güne eşit bölünür. Aynı saatte üç randevu olması
     Pazartesi'yi genişletemez. */
  return `
    <div class="weekgrid cal cal--${isWeek ? 'week' : 'day'}">
      <table>
        <thead><tr><th>SAAT</th>${days.map(d => `
          <th class="${d === today ? 'today' : ''}">
            ${esc(fmt.dowShort(d))}<span>${fmt.dayNum(d)}</span>
          </th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Bir saat hücresi. Yerleşimi HÜCRE belirler, randevular değil:
 * 1 randevu tam hücre · 2 randevu iki şerit · 3–4 randevu kompakt 2×2.
 * Satır yüksekliği sabittir, yoğun saat satırı uzatmaz.
 */
function cellHtml(t) {
  const closure = Store.closureAt(t);

  if (closure) {
    return `<div class="cell" data-n="1" data-slot="${t}">
      <button class="appt closed" data-act="openSlot" data-t="${t}">
        <b>Kapalı</b><em>${esc(closure.reason)}</em></button></div>`;
  }

  const occ = A.occupancyAt(t);
  const items = occ.overlapping;

  const chips = items.map(a => {
    const names = a.participants
      .filter(p => !['MEMBER_CANCELLED', 'ADMIN_CANCELLED'].includes(p.attendanceStatus))
      .map(p => Store.member(p.memberId)?.name.split(' ')[0] ?? '?');
    const cls = [
      'appt',
      a.serviceType === ServiceType.FITNESS ? 'fitness' : '',
      a.bookingMode === BookingMode.COUPLE ? 'couple' : '',
      clipboard.appointmentId === a.id ? 'cut' : '',
      a.startsAt < Date.now() ? 'past' : ''
    ].filter(Boolean).join(' ');
    /* Takvim kartında yalnızca ad + hizmet. Paket, ödeme ve kapasite
       matematiği burada GÖSTERİLMEZ (detay için karta tıklanır). */
    return `<button class="${cls}" draggable="true" data-appt="${a.id}" data-act="openAppt" data-id="${a.id}"
              title="${esc(names.join(' + '))} · ${esc(svc(a.serviceType))}">
        <b>${esc(names.join(' + '))}</b>
        <em>${esc(svc(a.serviceType))}${a.bookingMode === BookingMode.COUPLE ? ' · Çift' : ''}</em>
      </button>`;
  }).join('');

  const canAdd = !occ.exclusiveAppointment && items.length < 4;
  const n = Math.min(items.length, 4);

  return `<div class="cell${canAdd && n ? ' can-add' : ''}" data-n="${n}" data-slot="${t}">
    ${chips}
    ${canAdd ? `<button class="emptyslot" data-act="openSlot" data-t="${t}" aria-label="Boş saat"></button>` : ''}
  </div>`;
}

/* ---------------- AY: yalnızca genel bakış ---------------- */

/**
 * Ay görünümü randevu DÜZENLEME yüzeyi değildir: kart yok, sürükle-bırak yok.
 * Yanıtladığı sorular: hangi gün yoğun, hangi gün boş, çift seansı nerede.
 * Sayımlar motordan gelir (releasingStatuses kuralı burada tekrarlanmaz).
 */
function monthHtml(anchor) {
  const ms = monthStart(anchor);
  const total = Math.round((addMonths(ms, 1) - ms) / DAY);
  const lead = (dowOf(ms) + 6) % 7;               // hafta Pazartesi başlar
  const first = ms - lead * DAY;
  const cells = Math.ceil((lead + total) / 7) * 7;

  const stats = monthStats(first, cells);
  const today = startOfDay(Date.now());

  const body = Array.from({ length: cells }, (_, i) => {
    const d = first + i * DAY;
    const s = stats.get(d);
    const other = d < ms || d >= ms + total * DAY;
    const closed = !A.slotsOfDay(d).length;
    const cls = ['mday', other ? 'other' : '', d === today ? 'today' : '', closed ? 'closed' : '']
      .filter(Boolean).join(' ');

    const lines = s ? [
      s.ems ? `<span class="mstat ems"><i></i>EMS ${s.ems}</span>` : '',
      s.fit ? `<span class="mstat fit"><i></i>Fitness ${s.fit}</span>` : '',
      s.cpl ? `<span class="mstat cpl"><i></i>Çift ${s.cpl}</span>` : ''
    ].filter(Boolean).join('') : '';

    return `<button class="${cls}" data-act="pickDay" data-t="${d}"
              aria-label="${esc(fmt.full(d))}">
      <span class="num">${fmt.dayNum(d)}</span>
      ${lines ? `<span class="mstats">${lines}</span>`
              : `<span class="quiet">${closed ? 'Kapalı' : other ? '' : 'Boş'}</span>`}
    </button>`;
  }).join('');

  return `
    <div class="monthgrid">
      <div class="monthhead">${GUN_KISA_PZT.map(g => `<span>${g}</span>`).join('')}</div>
      <div class="monthbody">${body}</div>
    </div>`;
}

/** Gün başlangıcı → {ems, fit, cpl}. Her randevu bir kez sayılır. */
function monthStats(from, days) {
  const to = from + days * DAY;
  const out = new Map();
  const seen = new Set();

  // Motor saat bazlı çalışır; yalnızca gerçekten dolu saatler sorgulanır.
  const occupied = [...new Set(Store.get().appointments.map(a => a.startsAt))]
    .filter(t => t >= from && t < to);

  for (const t of occupied) {
    for (const a of A.occupancyAt(t).overlapping) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const d = startOfDay(a.startsAt);
      if (d < from || d >= to) continue;
      const s = out.get(d) ?? { ems: 0, fit: 0, cpl: 0 };
      if (a.bookingMode === BookingMode.COUPLE) s.cpl++;
      else if (a.serviceType === ServiceType.FITNESS) s.fit++;
      else s.ems++;
      out.set(d, s);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Randevu detayı                                                       */
/* ------------------------------------------------------------------ */

export function apptSheet(id) {
  const a = Store.get().appointments.find(x => x.id === id);
  if (!a) return;
  const couple = a.bookingMode === BookingMode.COUPLE;
  const past = a.startsAt < Date.now();

  sheet(`
    <div class="sheethead">
      <p class="eyebrow">${esc(fmt.full(a.startsAt))}</p>
      <div class="row between">
        <h2>${esc(fmt.time(a.startsAt))} · ${esc(svc(a.serviceType))}${couple ? ' · Çift' : ''}</h2>
        ${couple ? pill('Münhasır', 'warn') : ''}
      </div>
    </div>

    ${couple ? `<p class="small muted">Bu saat stüdyoda başka hiçbir randevuya açık değil.</p>` : ''}

    <div class="stack tight">
      ${a.participants.map(p => {
        const m = Store.member(p.memberId);
        return `
          <div class="card flat">
            <div class="row between">
              <div class="grow">
                <h3>${esc(m?.name ?? p.memberId)}</h3>
                <p class="tiny muted mono">${esc(m?.memberNo ?? '')}</p>
              </div>
              ${attPill(p.attendanceStatus)}
            </div>
            <div class="row wrap" style="gap:6px">
              <button class="btn btn--secondary compact" data-act="att" data-m="${p.memberId}" data-s="ATTENDED">Geldi</button>
              <button class="btn btn--secondary compact" data-act="att" data-m="${p.memberId}" data-s="NO_SHOW">Gelmedi</button>
              <button class="btn btn--secondary compact" data-act="late" data-m="${p.memberId}">Geç iptal</button>
              ${couple ? `<button class="btn btn--secondary compact" data-act="toSingle" data-m="${p.memberId}">Çıkar → tekli</button>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>

    ${!past ? `<button class="btn btn--secondary" data-act="cut">KES — BAŞKA SAATE TAŞI</button>` : ''}

    <div class="dangerzone">
      <button class="btn btn--danger" data-act="adminCancel">RANDEVUYU İPTAL ET</button>
    </div>
  `, (root) => {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;

      if (act === 'closeSheet') return closeSheet();

      if (act === 'att') {
        Store.setAttendance(a.id, b.dataset.m, AttendanceStatus[b.dataset.s]);
        toast(b.dataset.s === 'ATTENDED' ? 'Katılım işaretlendi.' : 'Gelmedi işaretlendi.');
      }
      if (act === 'late') {
        const r = A.lateCancel({ appointment: a, memberId: b.dataset.m });
        toast(r.ok ? 'Geç iptal kaydedildi — hak yandı, saat başkasına açıldı.'
                   : r.result.adminMessage, !r.ok);
      }
      if (act === 'toSingle') {
        const r = A.coupleToSingle({ appointment: a, removeMemberId: b.dataset.m });
        toast(r.ok ? 'Çift seansı tek kişilik seansa çevrildi.' : r.result.adminMessage, !r.ok);
      }
      if (act === 'adminCancel') {
        const r = A.cancel({ appointment: a, memberId: null, actor: Actor.ADMIN });
        toast(r.ok ? 'Randevu iptal edildi, haklar iade edildi.' : r.result.adminMessage, !r.ok);
      }
      if (act === 'cut') {
        clipboard.appointmentId = a.id;
        toast('Kesildi. Hedef saate sağ tıkla → Yapıştır (veya Ctrl/Cmd+V).');
      }
      closeSheet();
      rerender();
    });
  });
}

const attPill = (s) => ({
  ATTENDED: pill('Geldi', 'ok'),
  NO_SHOW: pill('Gelmedi', 'bad'),
  LATE_CANCEL: pill('Geç iptal', 'warn'),
  MEMBER_CANCELLED: pill('Üye iptal etti'),
  ADMIN_CANCELLED: pill('Stüdyo iptal etti')
}[s] ?? pill('Planlandı', 'blue'));

/* ------------------------------------------------------------------ */
/* Boş seans: manuel randevu / kapat-aç / yapıştır                      */
/* ------------------------------------------------------------------ */

export function slotSheet(t) {
  const closure = Store.closureAt(t);
  const occ = A.occupancyAt(t);
  const cutId = clipboard.appointmentId;

  const eligible = Store.memberList().filter(m => m.active);

  sheet(`
    <div class="sheethead">
      <p class="eyebrow">${esc(fmt.full(t))}</p>
      <div class="row between">
        <h2>${esc(fmt.time(t))}</h2>
        ${closure ? pill('Kapalı', 'bad') : ''}
      </div>
    </div>

    <p class="small muted">EMS ${occ.emsPeople}/${A.POLICY.capacity.ems} ·
       Fitness ${occ.fitnessPeople}/${A.POLICY.capacity.fitness} ·
       Toplam ${occ.totalPeople}/${A.POLICY.capacity.total}</p>

    ${cutId ? `<button class="btn btn--primary" data-act="paste">BURAYA YAPIŞTIR</button>` : ''}

    ${!closure ? `
      <div class="stack tight">
        <p class="eyebrow">MANUEL RANDEVU</p>
        <div class="field">
          <label for="mm">Üye</label>
          <select id="mm">${eligible.map(m =>
            `<option value="${m.id}">${esc(m.name)} · ${esc(m.memberNo)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label for="ms">Seans</label>
          <select id="ms">
            <option value="EMS">EMS</option>
            <option value="EMS_COUPLE">EMS · Çift (partnerle)</option>
            <option value="FITNESS">Fitness</option>
          </select>
        </div>
        <button class="btn btn--primary" data-act="manual">RANDEVU EKLE</button>
      </div>` : ''}

    <div class="dangerzone">
      <button class="btn ${closure ? 'btn--secondary' : 'btn--danger'}" data-act="toggleClose">
        ${closure ? 'SEANSI YENİDEN AÇ' : 'SEANSI KAPAT'}
      </button>
      <button class="btn btn--ghost" data-act="closeSheet">VAZGEÇ</button>
    </div>
  `, (root) => {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;

      if (act === 'closeSheet') return closeSheet();

      if (act === 'paste') { closeSheet(); return pasteInto(t); }

      if (act === 'manual') {
        const memberId = root.querySelector('#mm').value;
        const sel = root.querySelector('#ms').value;
        const r = A.book({
          memberId,
          serviceType: sel === 'FITNESS' ? ServiceType.FITNESS : ServiceType.EMS,
          bookingMode: sel === 'EMS_COUPLE' ? BookingMode.COUPLE : BookingMode.SINGLE,
          startsAt: t
        });
        if (!r.ok) { toast(r.result.adminMessage, true); return; }
        toast('Randevu eklendi.');
      }

      if (act === 'toggleClose') {
        Store.toggleClosure(t, 'Yönetici kapattı');
        toast(closure ? 'Seans yeniden açıldı.' : 'Seans kapatıldı.');
      }

      closeSheet();
      rerender();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Taşıma — sürükle-bırak ve yapıştır aynı doğrulamayı kullanır         */
/* ------------------------------------------------------------------ */

export function attemptMove(appointmentId, targetStartsAt) {
  const a = Store.get().appointments.find(x => x.id === appointmentId);
  if (!a) return;
  if (a.startsAt === targetStartsAt) { clipboard.appointmentId = null; return rerender(); }

  const check = A.checkMove({ appointment: a, targetStartsAt });
  const names = a.participants.map(p => Store.member(p.memberId)?.name).filter(Boolean).join(' + ');

  sheet(`
    <div class="sheethead">
      <p class="eyebrow">RANDEVUYU TAŞI</p>
      <h2>${esc(names)}</h2>
    </div>
    <div class="card flat">
      <div class="row between"><span class="small muted">Şu an</span>
        <b class="small">${esc(fmt.full(a.startsAt))} · ${esc(fmt.time(a.startsAt))}</b></div>
      <div class="row between"><span class="small muted">Yeni saat</span>
        <b class="small" style="color:var(--brand)">${esc(fmt.full(targetStartsAt))} · ${esc(fmt.time(targetStartsAt))}</b></div>
    </div>
    ${check.allowed
      ? `<p class="small muted">Hedef saat uygun. Üyeye bildirim gidecek.</p>
         <button class="btn btn--primary" data-act="ok">TAŞI VE BİLDİR</button>`
      : `<div class="card bad">
           <p class="eyebrow" style="color:var(--bad)">TAŞINAMAZ</p>
           <p class="small">${esc(check.adminMessage)}</p>
         </div>
         ${check.overridable ? `<button class="btn btn--danger" data-act="force">GEREKÇEYLE YİNE DE TAŞI</button>` : ''}`}
    <button class="btn btn--ghost" data-act="cancel">VAZGEÇ</button>
  `, (root) => {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;

      if (b.dataset.act === 'ok') {
        A.move({ appointment: a, targetStartsAt });
        Store.notify('Randevun taşındı',
          `${fmt.full(targetStartsAt)} ${fmt.time(targetStartsAt)} olarak güncellendi.`);
        toast('Randevu taşındı.');
      }
      if (b.dataset.act === 'force') {
        Store.moveAppointment(a.id, targetStartsAt);
        toast('Kural aşılarak taşındı — denetim kaydına yazılacak.');
      }
      clipboard.appointmentId = null;
      closeSheet();
      rerender();
    });
  });
}

function pasteInto(t) {
  const id = clipboard.appointmentId;
  if (!id) return toast('Panoda randevu yok.', true);
  attemptMove(id, t);
}

/* ------------------------------------------------------------------ */
/* Üyeler                                                               */
/* ------------------------------------------------------------------ */

export function adminMembers() {
  const list = Store.memberList();
  return {
    tabs: false, wide: true,
    html: shell('adminMembers', `
      <div class="row between wrap">
        <div><p class="eyebrow">ÜYELER</p><h2>${list.length} kayıt</h2></div>
      </div>
      <div class="weekgrid" style="overflow-x:auto">
        <table class="tbl">
          <thead><tr>
            <th>Üye</th><th>EMS paketi</th><th>Bu hafta</th>
            <th>Fitness</th><th>Partner</th><th class="num">Bakiye</th><th>Durum</th>
          </tr></thead>
          <tbody>
            ${list.map(m => {
              const u = A.usage(m.id);
              const p = A.partner(m.id);
              const b = Store.balanceOf(m.id);
              return `<tr data-act="openMember" data-id="${m.id}">
                <td><b>${esc(m.name)}</b><span class="sub mono">${esc(m.memberNo)}</span></td>
                <td class="mono">${u ? `${u.packageUsed}/${u.packageTotal}` : '—'}</td>
                <td class="mono">${u ? `${u.bucketUsed}/${u.bucketLimit}` : '—'}</td>
                <td>${m.fitnessAccess ? '✓' : '—'}</td>
                <td>${p ? esc(p.name.split(' ')[0]) : '<span class="muted">—</span>'}</td>
                <td class="num"><b style="color:${b.debt > 0 ? 'var(--warn)' : 'var(--ok)'}">${esc(fmt.money(b.debt))}</b></td>
                <td>${m.active ? pill('Aktif', 'ok') : pill('Pasif', 'bad')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `),
    actions: {
      signout() { Store.signOut(); location.hash = '#/login'; },
      openMember(el) { memberSheet(el.dataset.id); }
    }
  };
}

/** Üye panelinin içeriği. Çekmecede de, çekmece içi geri dönüşte de kullanılır. */
function memberPanel(id) {
  const m = Store.member(id);
  if (!m) return null;
  const u = A.usage(id);
  const b = Store.balanceOf(id);
  const pays = Store.paymentsOf(id);
  const METOT = { CASH: 'Nakit', CARD: 'Kart', BANK_TRANSFER: 'Havale' };

  const p = A.partner(id);

  const html = `
    <div class="sheethead">
      <div class="row between">
        <h2>${esc(m.name)}</h2>
        ${m.active ? pill('Aktif', 'ok') : pill('Pasif', 'bad')}
      </div>
      <p class="tiny muted mono">${esc(m.memberNo)}</p>
    </div>

    ${u ? `<div class="card flat">
      <div class="row between"><span class="small muted">EMS paketi</span><b class="mono">${u.packageUsed} / ${u.packageTotal}</b></div>
      <div class="row between"><span class="small muted">Bu hafta</span><b class="mono">${u.bucketUsed} / ${u.bucketLimit}</b></div>
      ${p ? `<div class="row between"><span class="small muted">Partner</span><b class="small">${esc(p.name)}</b></div>` : ''}
    </div>` : `<div class="card flat"><p class="small">EMS paketi yok.</p></div>`}

    <div class="card flat">
      <div class="row between"><span class="small muted">Paket bedeli</span><b class="mono">${esc(fmt.money(b.due))}</b></div>
      <div class="row between"><span class="small muted">Ödenen</span><b class="mono">${esc(fmt.money(b.paid))}</b></div>
      <div class="row between"><span class="small muted">Kalan</span>
        <b class="mono" style="color:${b.debt > 0 ? 'var(--warn)' : 'var(--ok)'}">${esc(fmt.money(b.debt))}</b></div>
    </div>

    <div class="stack tight">
      <p class="eyebrow">ÖDEME EKLE</p>
      <div class="row" style="gap:8px">
        <div class="field grow"><label for="pa">Tutar</label>
          <input id="pa" type="number" inputmode="numeric" placeholder="0"></div>
        <div class="field grow"><label for="pm">Yöntem</label>
          <select id="pm"><option value="CASH">Nakit</option><option value="CARD">Kart</option>
          <option value="BANK_TRANSFER">Havale</option></select></div>
      </div>
      <div class="field"><label for="pn">Not</label><input id="pn" placeholder="(isteğe bağlı)"></div>
      <button class="btn btn--secondary" data-act="addPay">ÖDEMEYİ KAYDET</button>
    </div>

    ${pays.length ? `<div class="stack tight"><p class="eyebrow">ÖDEME GEÇMİŞİ</p>
      ${pays.map(x => `<div class="row between small">
        <span class="muted">${esc(fmt.date(x.paidAt))} · ${esc(METOT[x.method] ?? x.method)}${x.note ? ` · ${esc(x.note)}` : ''}</span>
        <b class="mono">${esc(fmt.money(x.amount))}</b></div>`).join('')}</div>` : ''}

    <div class="sheetfoot">
      <button class="btn btn--primary" data-act="openNotify">${icon.bell} BİLDİRİM GÖNDER</button>
      <button class="btn btn--ghost" data-act="closeSheet">KAPAT</button>
    </div>`;

  const mount = (root) => {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      // Aynı çekmecenin içinde yer değiştirir — üst üste ikinci çekmece açılmaz.
      if (btn.dataset.act === 'openNotify') return notifySheet(id, { from: 'member' });
      if (btn.dataset.act === 'addPay') {
        const amount = Number(root.querySelector('#pa').value);
        if (!amount || amount <= 0) return toast('Geçerli bir tutar gir.', true);
        Store.addPayment({
          memberId: id, amount,
          method: root.querySelector('#pm').value,
          paidAt: Date.now(),
          note: root.querySelector('#pn').value.trim()
        });
        toast('Ödeme kaydedildi.');
      }
      closeSheet();
      rerender();
    });
  };

  /* Üye detayı listeyle yan yana okunduğu için ÇEKMECE; ama ekran kenarına
     yapışan duvar değil, kenarlardan içeri çekilmiş yüzen panel. */
  return { html, mount };
}

function memberSheet(id) {
  const v = memberPanel(id);
  if (v) sheet(v.html, v.mount, { variant: 'drawer' });
}

/* ------------------------------------------------------------------ */
/* Ayarlar — demo notları                                               */
/* ------------------------------------------------------------------ */

const GUN_KIS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/** Bugünden başlayarak istenen haftagününe düşen ilk tarih. */
function nextDayOfWeek(dow) {
  const t0 = startOfDay(Date.now());
  for (let i = 0; i < 7; i++) if (dowOf(t0 + i * DAY) === dow) return t0 + i * DAY;
  return t0;
}

/**
 * Çalışma saatleri POLİTİKADAN okunur, elle yazılmaz.
 * Aynı saatlere sahip ardışık günler tek satırda toplanır (Pzt – Cmt gibi);
 * politikada bir gün değişirse burada kendiliğinden ayrışır.
 */
function workingHourRows() {
  const hours = A.POLICY.schedule.hours;
  const groups = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {        // hafta Pazartesi başlar
    const h = hours[d];
    const key = h ? `${h.open}-${h.close}` : 'closed';
    const last = groups.at(-1);
    if (last && last.key === key) last.days.push(d);
    else groups.push({ key, days: [d], h });
  }
  return groups.map(g => ({
    label: g.days.length === 1
      ? GUN_KIS[g.days[0]]
      : `${GUN_KIS[g.days[0]]} – ${GUN_KIS[g.days.at(-1)]}`,
    value: g.h ? `${g.h.open} – ${g.h.close}` : 'Kapalı'
  }));
}

/**
 * Takvimde görünen SON SATIR, yani son seansın başlangıcı.
 * Kapanış saatiyle karıştırılmasın diye ayrıca gösterilir ve motordan
 * alınır — ayarlar ekranı ile takvim böylece asla ayrışamaz.
 */
function lastSessionSummary() {
  const seen = new Map();
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const slots = A.slotsOfDay(nextDayOfWeek(d));
    if (!slots.length) continue;
    const t = fmt.time(slots.at(-1));
    if (!seen.has(t)) seen.set(t, []);
    seen.get(t).push(d);
  }
  return [...seen.entries()].map(([t, days]) => {
    const label = days.length === 1
      ? GUN_KIS[days[0]]
      : `${GUN_KIS[days[0]]}–${GUN_KIS[days.at(-1)]}`;
    return `${label} ${t}`;
  }).join(' · ');
}

export function adminSettings() {
  const p = A.POLICY;
  const row = (k, v) => `<div class="row between"><span class="small muted">${esc(k)}</span><b>${esc(v)}</b></div>`;

  return {
    tabs: false, wide: true,
    html: shell('adminSettings', `
      <div><p class="eyebrow">AYARLAR</p><h2>Çalışan kurallar</h2></div>

      <div class="admincols">
        <div class="stack">
          <div class="card">
            <p class="eyebrow">KAPASİTE</p>
            ${row('EMS', p.capacity.ems + ' kişi')}
            ${row('Fitness', p.capacity.fitness + ' kişi')}
            ${row('Toplam', p.capacity.total + ' kişi')}
            ${row('Çift seansı', p.couple.exclusiveStudio ? 'Stüdyoyu kapatır' : 'Normal kapasite')}
          </div>
          <div class="card">
            <p class="eyebrow">EMS PAKETİ</p>
            ${row('Kredi', p.entitlement.totalCredits)}
            ${row('Döngü', p.entitlement.cycleDays + ' gün')}
            ${row('Kova', p.entitlement.bucketDays + ' gün')}
            ${row('Kova başına', p.entitlement.maxPerBucket + ' seans')}
            ${row('Devir', p.entitlement.bucketRollover ? 'Var' : 'Yok')}
          </div>
          <div class="card">
            <p class="eyebrow">RANDEVU VE İPTAL</p>
            ${row('Ufuk', p.bookingWindow.horizonDays + ' gün')}
            ${row('Kapanış', p.bookingWindow.cutoffMinutesBeforeStart + ' dk önce')}
            ${row('EMS iptal', p.cancellation.ems.cutoffHours + ' saat')}
            ${row('İptal hakkı', p.cancellation.ems.allowancePerCycle + ' / dönem')}
            ${row('Fitness iptal', p.cancellation.fitness.cutoffHours + ' saat')}
          </div>
        </div>

        <div class="stack">
          <div class="card warn">
            <p class="eyebrow" style="color:var(--warn)">GEÇİCİ KARARLAR</p>
            <p class="small">Aşağıdakiler işletme sahibi onayı bekliyor. Nihai karar değildir.</p>
            ${DEMO_PROVISIONAL_NOTES.map(n => `<p class="small">· ${esc(n)}</p>`).join('')}
          </div>
          <div class="card warn">
            <div class="row between">
              <p class="eyebrow" style="color:var(--warn)">ÇALIŞMA SAATLERİ</p>
              ${pill('Geçici', 'warn')}
            </div>
            ${workingHourRows().map(h => row(h.label, h.value)).join('')}
            ${row('Son seans', lastSessionSummary())}
            ${row('Seans', p.session.durationMinutes + ' dk + ' + p.session.bufferMinutes + ' dk tampon')}
            <p class="tiny muted">Kapanış saati stüdyonun kapandığı andır; son seans ondan
            önce başlayıp biter. Takvimdeki son satır bu yüzden kapanıştan erkendir.</p>
            <p class="tiny" style="color:var(--warn)">İşletme sahibi onayı bekliyor — nihai karar değildir.</p>
          </div>
          <div class="card">
            <p class="eyebrow">VERİ</p>
            <p class="small">Owner Review Preview · Demo Data</p>
            <p class="tiny muted">Demo verileri Supabase üzerinde paylaşılır ve bağlı cihazlar
            arasında canlı senkronize edilir; bildirimler sunucu tarafında üretilir.
            Bu altyapı bir production veritabanı değildir.</p>
            <button class="btn btn--ghost compact" data-act="resetDemo" style="margin-top:8px">DEMOYU SIFIRLA</button>
          </div>
        </div>
      </div>
    `),
    actions: {
      signout() { Store.signOut(); location.hash = '#/login'; },
      resetDemo() {
        sheet(`
          <h2>Demoyu sıfırla</h2>
          <p class="small">Paylaşılan demo verisi başlangıç durumuna döner —
          <b>bağlı tüm cihazlarda</b>. Web Push abonelikleri korunur.</p>
          <button class="btn btn--danger" data-act="confirmReset">EVET, SIFIRLA</button>
          <button class="btn btn--ghost" data-act="closeSheet">VAZGEÇ</button>`);
      },
      confirmReset() { Store.reset(); closeSheet(); toast('Demo verisi sıfırlandı.'); rerender(); },
      closeSheet
    }
  };
}

/* ------------------------------------------------------------------ */
/* Manuel bildirim — yöneticiden seçili üyeye                           */
/* ------------------------------------------------------------------ */

/**
 * Gönderim sunucuda yapılır. Burada yalnızca metin toplanır ve önizlenir.
 * Yönetici anahtarı istemci koduna gömülü değildir; ilk kullanımda sorulur ve
 * yalnızca sessionStorage'da tutulur (v0.5 demo sınırı — üretimde ADMIN RBAC).
 */
/** Panel açık ise İÇERİĞİ DEĞİŞİR; üst üste ikinci bir çekmece açılmaz. */
function present(html, mount) {
  if (isSheetOpen()) swapSheet(html, mount);
  else sheet(html, mount, { variant: 'drawer' });
}

const backBtn = (from) => from === 'member'
  ? `<button class="btn btn--ghost compact" data-act="backToMember">‹ ÜYE DETAYI</button>` : '';

export function notifySheet(memberId, opts = {}) {
  const from = opts.from;
  const m = Store.member(memberId);
  if (!m) return;

  if (!AP.hasKey()) return keySheet(memberId, opts);

  present(`
    <div class="sheethead">
      <p class="eyebrow">BİLDİRİM GÖNDER</p>
      <h2>${esc(m.name)}</h2>
      <p class="tiny muted mono">${esc(m.memberNo)}</p>
    </div>

    ${backBtn(from)}

    <div class="card flat" id="pushstate">
      <div class="row"><span class="pill"><i></i>Bildirim durumu kontrol ediliyor…</span></div>
    </div>

    <div class="field">
      <label for="ntpl">Şablon</label>
      <select id="ntpl">
        ${AP.TEMPLATES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}
      </select>
    </div>

    <div class="field">
      <label for="ntitle">Başlık <span class="tiny muted" id="ncount1"></span></label>
      <input id="ntitle" maxlength="${AP.TITLE_MAX}" placeholder="Bildirim başlığı">
    </div>

    <div class="field">
      <label for="nbody">Mesaj <span class="tiny muted" id="ncount2"></span></label>
      <textarea id="nbody" rows="4" style="min-height:92px" maxlength="${AP.BODY_MAX}" placeholder="Üyeye gidecek mesaj"></textarea>
    </div>

    <div class="stack tight">
      <p class="eyebrow">ÖNİZLEME</p>
      <div class="notifpreview">
        <img src="assets/logo.png" alt="">
        <div class="grow">
          <span class="app">Orka EMS Fitness</span>
          <b id="pvtitle">—</b>
          <p id="pvbody">—</p>
        </div>
      </div>
      <p class="tiny muted">Üyenin kilit ekranında yaklaşık böyle görünür.</p>
    </div>

    <div class="sheetfoot">
      <button class="btn btn--primary" data-act="sendNotif" id="sendbtn" disabled>BİLDİRİMİ GÖNDER</button>
      <button class="btn btn--ghost" data-act="closeSheet">VAZGEÇ</button>
    </div>
  `, (root) => {
    const $ = (id) => root.querySelector('#' + id);
    const tpl = $('ntpl'), title = $('ntitle'), bodyEl = $('nbody'), sendBtn = $('sendbtn');
    let devices = 0;

    const applyTemplate = () => {
      const t = AP.templateById(tpl.value);
      title.value = AP.fill(t.title, m.name);
      bodyEl.value = AP.fill(t.body, m.name);
      paint();
      if (t.id === 'CUSTOM') bodyEl.focus();
    };

    const paint = () => {
      const tv = title.value.trim();
      const bv = bodyEl.value.trim();
      $('pvtitle').textContent = tv || 'Başlık';
      $('pvbody').textContent = bv || 'Mesaj metni burada görünecek.';
      $('ncount1').textContent = `${title.value.length}/${AP.TITLE_MAX}`;
      $('ncount2').textContent = `${bodyEl.value.length}/${AP.BODY_MAX}`;
      // Mesaj boşsa ya da üyenin aktif cihazı yoksa gönderim kapalı
      sendBtn.disabled = !tv || !bv || devices === 0;
    };

    tpl.addEventListener('change', applyTemplate);
    title.addEventListener('input', paint);
    bodyEl.addEventListener('input', paint);
    applyTemplate();

    // Üyenin aktif abonelikleri
    AP.memberPushStatus(memberId).then((r) => {
      const box = $('pushstate');
      if (r?.reason === 'UNAUTHORIZED') {
        AP.clearKey();
        box.innerHTML = `<p class="small" style="color:var(--bad)">Yönetici anahtarı geçersiz.</p>`;
        return;
      }
      if (r?.reason === 'NOT_CONFIGURED') {
        box.innerHTML = `<p class="small" style="color:var(--warn)">Manuel bildirim sunucuda kapalı (DEMO_ADMIN_KEY tanımlı değil).</p>`;
        return;
      }
      devices = r?.deviceCount ?? 0;
      box.innerHTML = devices
        ? `<div class="row between"><span class="pill ok"><i></i>Bildirimler açık</span>
             <span class="tiny muted">${devices} cihaz</span></div>`
        : `<div class="row between"><span class="pill"><i></i>Bildirim izni yok</span></div>
           <p class="small muted">Bu üye henüz bu cihazında bildirim izni vermemiş.</p>`;
      paint();
    });

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'closeSheet') return closeSheet();
      if (b.dataset.act === 'backToMember') {
        const v = memberPanel(memberId);
        return v && swapSheet(v.html, v.mount);
      }
      if (b.dataset.act !== 'sendNotif') return;

      sendBtn.disabled = true;
      sendBtn.textContent = 'GÖNDERİLİYOR…';
      const r = await AP.send({
        memberId,
        template: tpl.value,
        title: title.value.trim(),
        message: bodyEl.value.trim()
      });

      if (r?.ok) {
        toast(`Bildirim gönderildi (${r.sent} cihaz).`);
        closeSheet();
      } else {
        if (r?.reason === 'UNAUTHORIZED') AP.clearKey();
        toast(r?.error ?? 'Bildirim gönderilemedi.', true);
        sendBtn.disabled = false;
        sendBtn.textContent = 'BİLDİRİMİ GÖNDER';
      }
    });
  });
}

/** Yönetici anahtarı bir kez sorulur; kodda tutulmaz. */
function keySheet(memberId, opts = {}) {
  const from = opts.from;
  present(`
    <div class="sheethead">
      <p class="eyebrow">YÖNETİCİ ANAHTARI</p>
      <h2>Bildirim gönderimi</h2>
    </div>
    ${backBtn(from)}
    <p class="small">Üyelere serbest metin bildirimi göndermek sunucuda ayrı bir
    anahtarla korunuyor. Anahtar yalnızca bu sekmede saklanır, koda yazılmaz.</p>
    <div class="field">
      <label for="akey">Anahtar</label>
      <input id="akey" type="password" placeholder="DEMO_ADMIN_KEY" autocomplete="off">
    </div>
    <div class="sheetfoot">
      <button class="btn btn--primary" data-act="saveKey">DEVAM ET</button>
      <button class="btn btn--ghost" data-act="closeSheet">VAZGEÇ</button>
    </div>
  `, (root) => {
    const input = root.querySelector('#akey');
    input.focus();
    const submit = async () => {
      const v = input.value.trim();
      if (!v) return toast('Anahtar boş olamaz.', true);
      AP.setKey(v);
      const r = await AP.verifyKey();
      // Anahtar kabul edilirse aynı panelde yazaca geçilir.
      if (r?.ok) notifySheet(memberId, opts);
      else {
        AP.clearKey();
        toast(r?.error ?? 'Anahtar doğrulanamadı.', true);
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'closeSheet') return closeSheet();
      if (b.dataset.act === 'backToMember') {
        const v = memberPanel(memberId);
        return v && swapSheet(v.html, v.mount);
      }
      if (b.dataset.act === 'saveKey') submit();
    });
  });
}
