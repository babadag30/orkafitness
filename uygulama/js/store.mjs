/* Orka EMS Fitness — DEMO kalıcılığı

   ⚠️ BU ÜRETİM KALICILIĞI DEĞİLDİR.
   Veri tarayıcının localStorage'ında tutulur. Sunucu, veritabanı ve
   kimlik doğrulama yok. Phase 2'de bu dosyanın yerini REST API alacak;
   domain katmanı değişmeyecek.

   Buradaki isimler ve telefonlar tamamen kurgudur. */

import { DEMO_POLICY, LedgerEventType, ServiceType, BookingMode,
         ParticipantRole, AttendanceStatus, AppointmentStatus,
         createEntry, startOfLocalDay, DAY, MINUTE } from '../../domain/index.mjs';

const KEY = 'orka.owner-demo.v1';
const OFF = DEMO_POLICY.locale.timezoneOffsetMinutes;

/** Demo giriş bilgisi. Gerçek kimlik doğrulama Phase 2'de gelecek. */
export const DEMO_PASSWORD = 'orka2026';

let uid = 0;
const nid = (p) => `${p}${(++uid).toString(36)}${Date.now().toString(36).slice(-3)}`;

/* ------------------------------------------------------------------ */
/* Demo verisi                                                          */
/* ------------------------------------------------------------------ */

function seed() {
  const today = startOfLocalDay(Date.now(), OFF);
  const pkgStart = today - 14 * DAY;          // paket 14 gün önce başladı
  const at = (dayOffset, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return today + dayOffset * DAY + (h * 60 + m) * MINUTE;
  };

  const M = (id, no, name, opts = {}) => [id, {
    id, memberNo: no, name,
    username: no,
    phone: opts.phone ?? '0500 000 00 00',
    active: opts.active ?? true,
    fitnessAccess: opts.fitnessAccess ?? true,
    joinedAt: today - (opts.joinedDaysAgo ?? 90) * DAY,
    note: opts.note ?? ''
  }];

  const members = Object.fromEntries([
    M('m-ahmet',  'ORK-0142', 'Ahmet Yıldız',   { joinedDaysAgo: 150 }),
    M('m-ayse',   'ORK-0143', 'Ayşe Yıldız',    { joinedDaysAgo: 150 }),
    M('m-mert',   'ORK-0087', 'Mert Kaya',      { joinedDaysAgo: 220 }),
    M('m-zeynep', 'ORK-0210', 'Zeynep Arslan',  { fitnessAccess: false, joinedDaysAgo: 60 }),
    M('m-elif',   'ORK-0056', 'Elif Demir',     { joinedDaysAgo: 180 }),
    M('m-selin',  'ORK-0164', 'Selin Özkan',    { fitnessAccess: false, joinedDaysAgo: 45 }),
    M('m-deniz',  'ORK-0233', 'Deniz Aksu',     { joinedDaysAgo: 20, note: 'Yalnızca Fitness' }),
    M('m-baris',  'ORK-0119', 'Barış Naz',      { active: false, joinedDaysAgo: 300 })
  ]);

  /* EMS paketleri. Deniz yalnızca Fitness, Barış pasif.
     Paket başlangıçları bilerek farklı: gerçek stüdyoda herkes aynı gün
     başlamaz ve haftalık kovalar üye başına kayar. Ayrıca bu sayede
     "8/8 kullanmış" bir üye kurgulanabiliyor — 4 kovanın da geçmiş olması
     gerekiyor (4 × 2 = 8). */
  const PKG_START = {
    'm-ahmet':  today - 15 * DAY,   // 2. kova bugünü kapsıyor → "bu hafta 1/2"
    'm-ayse':   today - 15 * DAY,
    'm-mert':   today - 26 * DAY,   // 4 kova geçti → paket tükenebilir
    'm-zeynep': today - 22 * DAY,
    'm-elif':   today - 12 * DAY,
    'm-selin':  today - 12 * DAY
  };
  const withPackage = Object.keys(PKG_START);
  const packages = {};
  for (const id of withPackage) {
    packages[id] = {
      id: `pkg-${id}`, memberId: id,
      startsAt: PKG_START[id],
      totalCredits: DEMO_POLICY.entitlement.totalCredits,
      active: true,
      priceTRY: 4800
    };
  }

  const links = [
    { id: 'lnk-1', memberAId: 'm-ahmet', memberBId: 'm-ayse',  active: true, endedAt: null, createdAt: pkgStart },
    { id: 'lnk-2', memberAId: 'm-elif',  memberBId: 'm-selin', active: true, endedAt: null, createdAt: pkgStart }
  ];

  const appointments = [];
  const ledgers = Object.fromEntries(withPackage.map(id => [id, []]));

  /** Geçmiş EMS seansı: randevu + rezervasyon + katılım kaydı. */
  const past = (memberIds, dayOffset, hhmm, mode = BookingMode.SINGLE, attendance = AttendanceStatus.ATTENDED) => {
    const startsAt = at(dayOffset, hhmm);
    const apptId = nid('a');
    appointments.push({
      id: apptId, serviceType: ServiceType.EMS, bookingMode: mode,
      startsAt, endsAt: startsAt + DEMO_POLICY.session.durationMinutes * MINUTE,
      status: AppointmentStatus.ACTIVE,
      exclusiveStudio: mode === BookingMode.COUPLE,
      participants: memberIds.map((mid, i) => ({
        id: nid('p'), memberId: mid,
        participantRole: i === 0 ? ParticipantRole.PRIMARY : ParticipantRole.PARTNER,
        attendanceStatus: attendance
      }))
    });
    for (const mid of memberIds) {
      ledgers[mid].push(createEntry({
        type: LedgerEventType.BOOKING_RESERVED, memberId: mid, appointmentId: apptId,
        memberPackageId: packages[mid].id, sessionStartsAt: startsAt, recordedAt: startsAt - DAY
      }));
      ledgers[mid].push(createEntry({
        type: attendance === AttendanceStatus.NO_SHOW
          ? LedgerEventType.NO_SHOW_CONSUMED : LedgerEventType.ATTENDED_CONSUMED,
        memberId: mid, memberPackageId: packages[mid].id, appointmentId: apptId,
        sessionStartsAt: startsAt, recordedAt: startsAt
      }));
    }
  };

  /** Gelecek randevu: randevu + rezervasyon (EMS ise). */
  const future = (memberIds, dayOffset, hhmm, service = ServiceType.EMS, mode = BookingMode.SINGLE) => {
    const startsAt = at(dayOffset, hhmm);
    const apptId = nid('a');
    const appt = {
      id: apptId, serviceType: service, bookingMode: mode,
      startsAt, endsAt: startsAt + DEMO_POLICY.session.durationMinutes * MINUTE,
      status: AppointmentStatus.ACTIVE,
      exclusiveStudio: mode === BookingMode.COUPLE,
      participants: memberIds.map((mid, i) => ({
        id: nid('p'), memberId: mid,
        participantRole: i === 0 ? ParticipantRole.PRIMARY : ParticipantRole.PARTNER,
        attendanceStatus: AttendanceStatus.SCHEDULED
      }))
    };
    appointments.push(appt);
    if (service === ServiceType.EMS) {
      for (const mid of memberIds) {
        ledgers[mid].push(createEntry({
          type: LedgerEventType.BOOKING_RESERVED, memberId: mid, appointmentId: apptId,
          memberPackageId: packages[mid].id, sessionStartsAt: startsAt, recordedAt: Date.now()
        }));
      }
    }
    return appt;
  };

  /* --- geçmiş kullanım ---
     Seanslar kova sınırına saygılı yerleştirilir (kova başına en fazla 2);
     aksi hâlde demo verisi kendi kuralını ihlal eder ve yönetici panelinde
     "5/2" gibi imkânsız sayılar görünür. */
  const BUCKET = DEMO_POLICY.entitlement.bucketDays;

  /** Üyenin paketinden, kova başına 2 olacak şekilde n geçmiş seans kullanır. */
  const useSessions = (memberId, n, hhmm, noShowAt = -1) => {
    const start = PKG_START[memberId];
    let placed = 0;
    for (let b = 0; placed < n && b < 4; b++) {
      for (let k = 0; k < DEMO_POLICY.entitlement.maxPerBucket && placed < n; k++) {
        // kovanın 1. ve 3. günü
        const dayFromPkg = b * BUCKET + k * 2;
        const offset = Math.round((start - today) / DAY) + dayFromPkg;
        if (offset >= 0) return placed;              // geleceğe seans yazma
        past([memberId], offset, hhmm, BookingMode.SINGLE,
          placed === noShowAt ? AttendanceStatus.NO_SHOW : AttendanceStatus.ATTENDED);
        placed++;
      }
    }
    return placed;
  };

  useSessions('m-ahmet', 5, '19:00');      // 5/8 · bu hafta 1/2 → sunumda randevu alabilir
  useSessions('m-ayse', 2, '19:00');       // 2/8 · bu hafta 0    → çift seansına uygun
  useSessions('m-mert', 8, '08:30');       // 8/8 → paket tükendi (red senaryosu)
  useSessions('m-zeynep', 7, '12:00', 3);  // 7/8 + bir gelmedi kaydı

  // Elif + Selin: geçmişte birlikte bir çift seansı yapmışlar
  past(['m-elif', 'm-selin'], -9, '20:00', BookingMode.COUPLE);
  past(['m-elif'], -6, '20:00');

  /* --- gelecek randevular --- */
  // Ahmet'in sıradaki randevusu Fitness — EMS hakkını tüketmez, sunumda
  // "EMS randevusu alabilir" durumu bozulmaz.
  future(['m-ahmet'], 1, '18:00', ServiceType.FITNESS);
  future(['m-ayse'],  1, '10:00');                                // EMS
  future(['m-elif'],  1, '10:00');                                // EMS → 2 EMS
  future(['m-deniz'], 1, '10:00', ServiceType.FITNESS);           // EMS 2 + Fitness 1
  future(['m-selin'], 2, '09:30');
  future(['m-zeynep'], 3, '12:00');
  // Münhasır çift seansı — takvimde hemen görünsün diye
  future(['m-elif', 'm-selin'], 4, '20:00', ServiceType.EMS, BookingMode.COUPLE);

  const payments = [
    { id: nid('pay'), memberId: 'm-ahmet', amount: 4800, method: 'CARD', paidAt: pkgStart, note: 'Paket bedeli' },
    { id: nid('pay'), memberId: 'm-ayse',  amount: 4800, method: 'CARD', paidAt: pkgStart, note: 'Paket bedeli' },
    { id: nid('pay'), memberId: 'm-mert',  amount: 2400, method: 'CASH', paidAt: pkgStart + DAY, note: 'İlk taksit' },
    { id: nid('pay'), memberId: 'm-elif',  amount: 4800, method: 'BANK_TRANSFER', paidAt: pkgStart, note: '' },
    { id: nid('pay'), memberId: 'm-zeynep', amount: 1000, method: 'CASH', paidAt: pkgStart + 2 * DAY, note: 'Kısmi ödeme' }
  ];

  return {
    version: 1,
    session: null,
    members, packages, ledgers, links, appointments, payments,
    closures: [{ startsAt: at(2, '13:00'), reason: 'Ekipman bakımı' }],
    notifications: []
  };
}

/* ------------------------------------------------------------------ */
/* Kalıcılık                                                            */
/* ------------------------------------------------------------------ */

/* PAYLAŞILAN durum: randevular, üyeler, defter, ödemeler…
   Supabase'te tek bir sürüm damgalı satırda tutulur, cihazlar arasında ortaktır. */
let state = seed();

/* CİHAZA ÖZEL oturum: paylaşılmaz.
   Paylaşılsaydı iPhone'da Ahmet olarak giriş yapmak Mac'i de Ahmet yapardı. */
const SESSION_KEY = KEY + '.session';
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? null; } catch { return null; }
}
let session = loadSession();
function saveSession() {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* kota */ }
}

/** Oturum, paylaşılan durumun üstüne bindirilerek verilir. */
export const get = () => ({ ...state, session });
export const rawState = () => state;

/* --- uzak senkronizasyon bağlantısı --- */

let sync = null;           // { push(mutation, state, actor) } — main.mjs enjekte eder
let onRemote = () => {};   // yeni durum geldiğinde arayüzü tazele
let onError = () => {};    // yazma başarısız → kullanıcıya bildir

export function attachSync(impl, { onRemoteState, onMutationError } = {}) {
  sync = impl;
  if (onRemoteState) onRemote = onRemoteState;
  if (onMutationError) onError = onMutationError;
}

/** Uzaktan gelen yetkili durumu benimser. Oturum korunur. */
export function applyRemoteState(next) {
  if (!next || !next.members) return;
  state = next;
  onRemote();
}

const actorLabel = () =>
  session?.role === 'ADMIN' ? 'admin' : (session?.memberId ?? 'anon');

/** Paylaşılan duruma yazma bekleniyor mu? */
export let inFlight = 0;

/**
 * Yerel değişikliği uzak duruma yazar.
 * İyimser: arayüz hemen güncellenir, yazma arka planda gider.
 * Başarısızlıkta değişiklik GERİ ALINIR — sessizce yerel kalmaz (v0.5 §32).
 */
function commit(mutation) {
  if (!sync) return Promise.resolve({ ok: true, local: true });
  const snapshot = structuredClone(state);
  inFlight++;
  return sync.push(mutation, state, actorLabel())
    .then((r) => {
      if (!r.ok) { state = snapshot; onError(r); onRemote(); }
      return r;
    })
    .catch((e) => {
      state = snapshot; onError({ error: String(e) }); onRemote();
      return { ok: false, error: String(e) };
    })
    .finally(() => { inFlight--; });
}

/** Eski çağrı yerleri için — artık yalnızca oturumu saklar. */
export function save() { saveSession(); }

/** Paylaşılan demoyu belirlenimci tohuma döndürür. Push abonelikleri KORUNUR. */
export function reset() {
  state = seed();
  commit({ type: 'RESET_DEMO' });
  return state;
}

export { seed as demoSeed };

/* ------------------------------------------------------------------ */
/* Sorgular                                                             */
/* ------------------------------------------------------------------ */

export const memberList = () => Object.values(state.members)
  .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

export const member = (id) => state.members[id] ?? null;

export const memberByUsername = (u) => Object.values(state.members)
  .find(m => m.username.toLowerCase() === String(u).trim().toLowerCase()) ?? null;

export const currentMember = () =>
  session?.role === 'MEMBER' ? state.members[session.memberId] : null;

/** Bir üyenin randevuları, yeniden eskiye. */
export function appointmentsOf(memberId) {
  return state.appointments
    .filter(a => a.status !== AppointmentStatus.CANCELLED &&
                 a.participants.some(p => p.memberId === memberId))
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function partnerOf(memberId) {
  const l = state.links.find(x => x.active && !x.endedAt &&
    (x.memberAId === memberId || x.memberBId === memberId));
  if (!l) return null;
  return state.members[l.memberAId === memberId ? l.memberBId : l.memberAId] ?? null;
}

export const closureAt = (startsAt) =>
  state.closures.find(c => c.startsAt === startsAt) ?? null;

export const paymentsOf = (memberId) => state.payments
  .filter(p => p.memberId === memberId)
  .sort((a, b) => b.paidAt - a.paidAt);

export function balanceOf(memberId) {
  const pkg = state.packages[memberId];
  const due = pkg?.priceTRY ?? 0;
  const paid = paymentsOf(memberId).reduce((s, p) => s + p.amount, 0);
  return { due, paid, debt: Math.max(0, due - paid) };
}

/* ------------------------------------------------------------------ */
/* Yazma — domain planlarını uygular                                    */
/* ------------------------------------------------------------------ */

/**
 * Domain motorunun ürettiği planı uygular.
 * Gerçek üründe bu tek bir veritabanı transaction'ı olacak; burada
 * hepsi tek senkron blokta yapılır ki kısmi yazma oluşmasın.
 */
export function applyPlan(plan, mutation) {
  if (!plan) return null;

  let appt = null;

  if (plan.appointment && !plan.appointment.id) {
    // yeni randevu
    appt = {
      id: nid('a'),
      ...plan.appointment,
      participants: plan.participants.map(p => ({ id: nid('p'), ...p }))
    };
    state.appointments.push(appt);
  } else if (plan.appointment?.id) {
    // var olan randevuyu güncelle
    appt = state.appointments.find(a => a.id === plan.appointment.id);
    if (appt) {
      Object.assign(appt, plan.appointment);
      for (const upd of plan.participants ?? []) {
        const p = appt.participants.find(x => x.memberId === upd.memberId);
        if (p) Object.assign(p, upd);
      }
      if (plan.removeParticipants?.length) {
        appt.participants = appt.participants
          .filter(p => !plan.removeParticipants.includes(p.memberId));
      }
    }
  }

  for (const e of plan.ledgerEntries ?? []) {
    // Randevu kimliği plan üretilirken henüz yoktu; burada bağlanır.
    // Taşıma doğrulaması bu bağı kullanarak randevunun kendi hakkını
    // iki kez saymaktan kurtulur.
    (state.ledgers[e.memberId] ??= []).push({
      ...e, id: nid('l'), appointmentId: e.appointmentId ?? appt?.id ?? null
    });
  }

  if (mutation) commit({ ...mutation, appointmentId: mutation.appointmentId ?? appt?.id ?? null });
  return appt;
}

/** Randevuyu başka bir saate taşır (yönetici). */
export function moveAppointment(appointmentId, startsAt) {
  const a = state.appointments.find(x => x.id === appointmentId);
  if (!a) return null;
  const delta = startsAt - a.startsAt;
  a.startsAt = startsAt;
  a.endsAt = (a.endsAt ?? a.startsAt) + delta;

  // Defterdeki seans tarihleri de taşınmalı — yoksa haftalık kova yanlış sayar.
  // Kayıtlar donmuş olduğu için değiştirilmez, yerlerine yenisi konur.
  for (const mid of a.participants.map(p => p.memberId)) {
    const led = state.ledgers[mid];
    if (!led) continue;
    state.ledgers[mid] = led.map(e =>
      e.appointmentId === a.id ? { ...e, sessionStartsAt: startsAt } : e);
  }

  // Bildirim içeriği sunucuda kurulur; gereken alanlar mutasyonla taşınır.
  commit({
    type: 'MOVE_APPOINTMENT',
    appointmentId: a.id,
    oldStartsAt: startsAt - delta,
    newStartsAt: startsAt,
    startsAt,
    serviceType: a.serviceType,
    bookingMode: a.bookingMode,
    memberIds: a.participants.map(p => p.memberId),
    memberNames: a.participants.map(p => state.members[p.memberId]?.name).filter(Boolean)
  });
  return a;
}

export function setAttendance(appointmentId, memberId, status) {
  const a = state.appointments.find(x => x.id === appointmentId);
  const p = a?.participants.find(x => x.memberId === memberId);
  if (p) { p.attendanceStatus = status; commit({ type: 'SET_ATTENDANCE', appointmentId, memberId, status }); }
  return a;
}

export function toggleClosure(startsAt, reason) {
  const i = state.closures.findIndex(c => c.startsAt === startsAt);
  const wasClosed = i >= 0;
  if (wasClosed) state.closures.splice(i, 1);
  else state.closures.push({ startsAt, reason: reason || 'Yönetici kapattı' });
  commit({ type: wasClosed ? 'OPEN_SLOT' : 'CLOSE_SLOT', startsAt });
}

export function addPayment(p) {
  state.payments.push({ id: nid('pay'), ...p });
  commit({ type: 'ADD_PAYMENT', memberId: p.memberId, amount: p.amount });
}

/* Uygulama içi bildirim listesi bilerek CİHAZ YERELİ tutulur: her küçük
   bildirim paylaşılan sürümü artırsaydı iki cihaz sürekli birbirini tazelerdi.
   Gerçek cihazlar arası uyarı yolu Web Push. */
const localNotes = [];
export function notify(title, body) {
  localNotes.unshift({ id: nid('n'), title, body, at: Date.now(), read: false });
}
export const notifications = () => localNotes;

export const unreadCount = () => localNotes.filter(n => !n.read).length;
export function markRead() { localNotes.forEach(n => n.read = true); }

/* ------------------------------------------------------------------ */
/* Oturum — DEMO                                                        */
/* ------------------------------------------------------------------ */

export function signInMember(username, password) {
  const m = memberByUsername(username);
  if (!m || password !== DEMO_PASSWORD) return { ok: false, msg: 'Kullanıcı adı veya parola hatalı.' };
  if (!m.active) return { ok: false, msg: 'Üyeliğin aktif değil. Stüdyoyla iletişime geç.' };
  session = { role: 'MEMBER', memberId: m.id };
  saveSession();
  return { ok: true, member: m };
}

export function signInAdmin(username, password) {
  if (String(username).trim().toLowerCase() !== 'yonetici' || password !== DEMO_PASSWORD) {
    return { ok: false, msg: 'Kullanıcı adı veya parola hatalı.' };
  }
  session = { role: 'ADMIN' };
  saveSession();
  return { ok: true };
}

export function signOut() { session = null; saveSession(); }
