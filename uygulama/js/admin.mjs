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
import { esc, fmt, icon, pill, toast, sheet, closeSheet, startOfDay } from './ui.mjs';

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
  const isWeek = view.mode === 'week';
  const start = anchorDay();
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

  const title = isWeek
    ? `${fmt.date(start)} – ${fmt.date(start + 6 * DAY)}`
    : fmt.full(start);
  const eyebrow = isWeek ? '7 GÜNLÜK GÖRÜNÜM' : 'GÜNLÜK GÖRÜNÜM';

  return {
    tabs: false, wide: true,
    html: shell('admin', `
      <div class="row between wrap" style="gap:10px">
        <div>
          <p class="eyebrow">${eyebrow}</p>
          <h2>${esc(title)}</h2>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn btn--secondary compact" data-act="prev">‹</button>
          <button class="btn btn--secondary compact" data-act="today">BUGÜN</button>
          <button class="btn btn--secondary compact" data-act="next">›</button>
          <button class="btn ${isWeek ? 'btn--secondary' : 'btn--primary'} compact" data-act="modeDay">GÜN</button>
          <button class="btn ${isWeek ? 'btn--primary' : 'btn--secondary'} compact" data-act="modeWeek">HAFTA</button>
        </div>
      </div>

      <div class="row wrap" style="gap:8px">
        ${pill('EMS', 'blue')}${pill('Fitness')}${pill('Çift · münhasır', 'warn')}
        <span class="grow"></span>
        <span class="tiny muted">Kartı sürükle · sağ tık: Kes / Yapıştır · Ctrl/Cmd+X, +V</span>
      </div>

      <div class="weekgrid">
        <table>
          <thead><tr><th>SAAT</th>${days.map(d => `
            <th class="${d === today ? 'today' : ''}">
              ${esc(fmt.dowShort(d))}<span>${fmt.dayNum(d)}</span>
            </th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `),
    actions: {
      prev() { view.anchor = anchorDay() - (view.mode === 'week' ? 7 : 1) * DAY; rerender(); },
      next() { view.anchor = anchorDay() + (view.mode === 'week' ? 7 : 1) * DAY; rerender(); },
      today() { view.anchor = startOfDay(Date.now()); rerender(); },
      modeDay() { view.mode = 'day'; rerender(); },
      modeWeek() { view.mode = 'week'; rerender(); },
      signout() { Store.signOut(); location.hash = '#/login'; },
      openAppt(el) { apptSheet(el.dataset.id); },
      openSlot(el) { slotSheet(Number(el.dataset.t)); }
    }
  };
}

function cellHtml(t) {
  const closure = Store.closureAt(t);
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
    return `<button class="${cls}" draggable="true" data-appt="${a.id}" data-act="openAppt" data-id="${a.id}">
        <b>${esc(names.join(' + '))}</b>
        <em>${esc(svc(a.serviceType))}${a.bookingMode === BookingMode.COUPLE ? ' · Çift' : ''}</em>
      </button>`;
  }).join('');

  if (closure) {
    return `<div class="cell" data-slot="${t}">
      <button class="appt" style="border-left-color:var(--bad);opacity:.75"
              data-act="openSlot" data-t="${t}">
        <b>Kapalı</b><em>${esc(closure.reason)}</em></button></div>`;
  }

  return `<div class="cell" data-slot="${t}">
    ${chips}
    ${occ.exclusiveAppointment ? '' :
      `<button class="emptyslot" data-act="openSlot" data-t="${t}" aria-label="Boş"></button>`}
  </div>`;
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
    <div class="row between">
      <div>
        <p class="eyebrow">${esc(fmt.full(a.startsAt))}</p>
        <h2>${esc(fmt.time(a.startsAt))} · ${esc(svc(a.serviceType))}${couple ? ' · Çift' : ''}</h2>
      </div>
      ${couple ? pill('Münhasır seans', 'warn') : ''}
    </div>

    ${couple ? `<p class="small muted">Bu saat stüdyoda başka hiçbir randevuya açık değil.</p>` : ''}

    <div class="stack tight">
      ${a.participants.map(p => {
        const m = Store.member(p.memberId);
        const u = A.usage(p.memberId);
        return `
          <div class="card flat">
            <div class="row between">
              <div>
                <h3>${esc(m?.name ?? p.memberId)}</h3>
                <p class="tiny muted mono">${esc(m?.memberNo ?? '')}${u ? ` · paket ${u.packageUsed}/${u.packageTotal}` : ''}</p>
              </div>
              ${attPill(p.attendanceStatus)}
            </div>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              <button class="btn btn--secondary compact" data-act="att" data-m="${p.memberId}" data-s="ATTENDED">Geldi</button>
              <button class="btn btn--secondary compact" data-act="att" data-m="${p.memberId}" data-s="NO_SHOW">Gelmedi</button>
              <button class="btn btn--secondary compact" data-act="late" data-m="${p.memberId}">Geç iptal</button>
              ${couple ? `<button class="btn btn--secondary compact" data-act="toSingle" data-m="${p.memberId}">Çıkar → tekli</button>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>

    ${!past ? `<button class="btn btn--secondary" data-act="cut">KES (taşımak için)</button>` : ''}
    <button class="btn btn--danger" data-act="adminCancel">RANDEVUYU İPTAL ET</button>
    <button class="btn btn--ghost" data-act="closeSheet">KAPAT</button>
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
    <p class="eyebrow">${esc(fmt.full(t))}</p>
    <h2>${esc(fmt.time(t))}</h2>
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
        <button class="btn btn--secondary" data-act="manual">RANDEVU EKLE</button>
      </div>` : ''}

    <button class="btn ${closure ? 'btn--secondary' : 'btn--danger'}" data-act="toggleClose">
      ${closure ? 'SEANSI YENİDEN AÇ' : 'SEANSI KAPAT'}
    </button>
    <button class="btn btn--ghost" data-act="closeSheet">KAPAT</button>
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
    <h2>Randevuyu taşı</h2>
    <div class="card flat">
      <h3>${esc(names)}</h3>
      <p class="small">${esc(fmt.full(a.startsAt))} ${esc(fmt.time(a.startsAt))}</p>
      <p class="small" style="color:var(--accent-2)">→ ${esc(fmt.full(targetStartsAt))} ${esc(fmt.time(targetStartsAt))}</p>
    </div>
    ${check.allowed
      ? `<p class="small muted">Hedef saat uygun. Üyeye bildirim gidecek.</p>
         <button class="btn btn--primary" data-act="ok">TAŞI VE BİLDİR</button>`
      : `<div class="card" style="border-color:rgba(248,113,113,.35)">
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
            <th>Üye</th><th>No</th><th>EMS paketi</th><th>Bu hafta</th>
            <th>Fitness</th><th>Partner</th><th>Bakiye</th><th>Durum</th>
          </tr></thead>
          <tbody>
            ${list.map(m => {
              const u = A.usage(m.id);
              const p = A.partner(m.id);
              const b = Store.balanceOf(m.id);
              return `<tr data-act="openMember" data-id="${m.id}">
                <td><b>${esc(m.name)}</b></td>
                <td class="mono muted">${esc(m.memberNo)}</td>
                <td>${u ? `${u.packageUsed}/${u.packageTotal}` : '—'}</td>
                <td>${u ? `${u.bucketUsed}/${u.bucketLimit}` : '—'}</td>
                <td>${m.fitnessAccess ? '✓' : '—'}</td>
                <td>${p ? esc(p.name.split(' ')[0]) : '—'}</td>
                <td style="color:${b.debt > 0 ? 'var(--warn)' : 'var(--text-2)'}">${esc(fmt.money(b.debt))}</td>
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

function memberSheet(id) {
  const m = Store.member(id);
  const u = A.usage(id);
  const b = Store.balanceOf(id);
  const pays = Store.paymentsOf(id);
  const METOT = { CASH: 'Nakit', CARD: 'Kart', BANK_TRANSFER: 'Havale' };

  sheet(`
    <div class="row between">
      <div><h2>${esc(m.name)}</h2><p class="tiny muted mono">${esc(m.memberNo)}</p></div>
      ${m.active ? pill('Aktif', 'ok') : pill('Pasif', 'bad')}
    </div>

    ${u ? `<div class="card flat">
      <div class="row between"><span class="small muted">Paket</span><b>${u.packageUsed} / ${u.packageTotal}</b></div>
      <div class="row between"><span class="small muted">Bu hafta</span><b>${u.bucketUsed} / ${u.bucketLimit}</b></div>
    </div>` : `<div class="card flat"><p class="small">EMS paketi yok.</p></div>`}

    <div class="card flat">
      <div class="row between"><span class="small muted">Paket bedeli</span><b>${esc(fmt.money(b.due))}</b></div>
      <div class="row between"><span class="small muted">Ödenen</span><b>${esc(fmt.money(b.paid))}</b></div>
      <div class="row between"><span class="small muted">Kalan</span>
        <b style="color:${b.debt > 0 ? 'var(--warn)' : 'var(--ok)'}">${esc(fmt.money(b.debt))}</b></div>
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
      ${pays.map(p => `<div class="row between small">
        <span class="muted">${esc(fmt.date(p.paidAt))} · ${esc(METOT[p.method] ?? p.method)}${p.note ? ` · ${esc(p.note)}` : ''}</span>
        <b>${esc(fmt.money(p.amount))}</b></div>`).join('')}</div>` : ''}

    <button class="btn btn--ghost" data-act="closeSheet">KAPAT</button>
  `, (root) => {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
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
  });
}

/* ------------------------------------------------------------------ */
/* Ayarlar — demo notları                                               */
/* ------------------------------------------------------------------ */

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
          <div class="card" style="border-color:rgba(251,191,36,.3)">
            <p class="eyebrow" style="color:var(--warn)">GEÇİCİ KARARLAR</p>
            <p class="small">Aşağıdakiler işletme sahibi onayı bekliyor. Nihai karar değildir.</p>
            ${DEMO_PROVISIONAL_NOTES.map(n => `<p class="small">· ${esc(n)}</p>`).join('')}
          </div>
          <div class="card">
            <p class="eyebrow">ÇALIŞMA SAATLERİ</p>
            ${row('Pzt – Cmt', '08:00 – 23:30')}
            ${row('Pazar', '10:00 – 22:00')}
            ${row('Seans', p.session.durationMinutes + ' dk + ' + p.session.bufferMinutes + ' dk tampon')}
          </div>
          <div class="card">
            <p class="eyebrow">VERİ</p>
            <p class="small">Owner Review Preview · Demo Data</p>
            <p class="tiny muted">Veriler yalnızca bu tarayıcıda tutulur. Sunucu ve veritabanı yok.</p>
            <button class="btn btn--ghost compact" data-act="resetDemo" style="margin-top:8px">DEMOYU SIFIRLA</button>
          </div>
        </div>
      </div>
    `),
    actions: {
      signout() { Store.signOut(); location.hash = '#/login'; },
      resetDemo() { Store.reset(); toast('Demo verisi sıfırlandı.'); rerender(); }
    }
  };
}
