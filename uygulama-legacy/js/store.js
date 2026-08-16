/* Orka EMS Fitness — uygulama durumu
   Veri modeli PRD v0.2 §15 ile aynı. Kalıcılık localStorage üzerinde;
   gerçek üründe bu katmanın yerini REST API alacak (PRD §7). */

const Store = (() => {
  // Şema değişince yükselt: eski kayıt yok sayılır, demo sıfırdan kurulur.
  const KEY = 'orka.demo.v2';

  const iso = (d) => {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };
  const addDays = (n) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  const ME = 'ORK-0142';

  /** Şu andan itibaren gelen ilk N seansı sırayla verir.
      Demo verisi buna göre kurulur; böylece sunum günün hangi saatinde
      açılırsa açılsın ekranda yeşil/turuncu/kırmızı üçü de görünür. */
  function upcomingSlots(count) {
    const now = new Date();
    const nowKey = iso(now) + now.toTimeString().slice(0, 5);
    const out = [];
    for (let i = 0; i < 6 && out.length < count; i++) {
      const d = addDays(i);
      for (const t of Rules.slotsForDate(d)) {
        if (d + t >= nowKey) out.push({ date: d, time: t });
        if (out.length >= count) break;
      }
    }
    return out;
  }

  function seed() {
    const s = upcomingSlots(14);
    const at = (i) => s[Math.min(i, s.length - 1)];
    const bk = (id, i, service, mode, member, extra) =>
      Object.assign({ id, date: at(i).date, time: at(i).time, service, mode, member, status: 'CONFIRMED' }, extra || {});

    return {
      session: { signedIn: false, phone: '' },
      me: ME,
      // Ayarlar ekranından düzenlenir, Rules.configure ile motora aktarılır.
      config: Rules.defaults(),
      members: {
        'ORK-0142': { no: 'ORK-0142', name: 'Hasan Babadağ', phone: '0551 274 45 22', partner: 'ORK-0143', noShow: 0, late: 1, active: true, joined: '14 Mart 2026' },
        'ORK-0143': { no: 'ORK-0143', name: 'Aslı Yılmaz', phone: '0532 118 90 04', partner: 'ORK-0142', noShow: 0, late: 0, active: true, joined: '14 Mart 2026' },
        'ORK-0087': { no: 'ORK-0087', name: 'Mert Kaya', phone: '0505 663 21 78', partner: null, noShow: 1, late: 0, active: true, joined: '02 Ocak 2026' },
        'ORK-0210': { no: 'ORK-0210', name: 'Zeynep Arslan', phone: '0543 902 55 31', partner: null, noShow: 0, late: 2, active: true, joined: '11 Mayıs 2026' },
        'ORK-0056': { no: 'ORK-0056', name: 'Elif Demir', phone: '0538 447 12 96', partner: 'ORK-0164', noShow: 3, late: 1, active: true, joined: '20 Şubat 2026' },
        'ORK-0164': { no: 'ORK-0164', name: 'Selin Özkan', phone: '0507 550 18 27', partner: 'ORK-0056', noShow: 1, late: 0, active: true, joined: '30 Haziran 2026' },
        'ORK-0119': { no: 'ORK-0119', name: 'Barış Naz', phone: '0546 780 33 12', partner: null, noShow: 0, late: 0, active: false, joined: '08 Nisan 2026' },
        'ORK-0233': { no: 'ORK-0233', name: 'Deniz Aksu', phone: '0533 214 66 08', partner: null, noShow: 0, late: 0, active: true, joined: '21 Temmuz 2026' }
      },
      partnerRequests: [
        { id: 'p1', from: 'ORK-0087', to: 'ORK-0210', when: '2 saat önce', status: 'PENDING' },
        { id: 'p2', from: 'ORK-0233', to: 'ORK-0119', when: 'Dün', status: 'PENDING' }
      ],
      // Diğer üyelerin randevuları. Konumlar "şu andan sonraki n. seans" olarak
      // verilir; sunum saatinden bağımsız olarak durum çeşitliliği garanti edilir.
      bookings: [
        bk('b1', 1, 'EMS', 'SOLO', 'ORK-0087'),                                  // → turuncu (1/3)
        bk('b2', 2, 'EMS', 'SOLO', 'ORK-0210'),                                  // → turuncu (2/3)
        bk('b3', 2, 'EMS', 'SOLO', 'ORK-0164'),
        bk('b4', 4, 'EMS', 'SOLO', 'ORK-0056'),                                  // → turuncu (EMS+Fitness)
        bk('b5', 4, 'FITNESS', 'SOLO', 'ORK-0164'),
        bk('b6', 7, 'EMS', 'PARTNER', 'ORK-0056', { partnerOf: 'ORK-0164' }),    // → kırmızı (özel çift)
        bk('b7', 9, 'EMS', 'SOLO', 'ORK-0087'),                                  // → kırmızı (3/3 dolu)
        bk('b8', 9, 'EMS', 'SOLO', 'ORK-0210'),
        bk('b9', 9, 'EMS', 'SOLO', 'ORK-0056'),
        bk('b10', 12, 'FITNESS', 'SOLO', 'ORK-0087')                             // → turuncu
      ],
      closures: [
        { date: at(5).date, time: at(5).time, reason: 'Ekipman bakımı' },        // → kırmızı (kapalı)
        { date: at(11).date, time: at(11).time, reason: 'Özel grup dersi' }
      ],
      notifications: [
        { id: 'n1', title: 'STÜDYODAN', body: 'Yaz programı başladı. Hafta içi 08:00 seansları artık açık.', when: '2 gün önce', read: true }
      ],
      partnerRequest: null
    };
  }

  let state = load();

  function load() {
    let s = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.members) s = parsed;
      }
    } catch (e) { /* bozuk kayıt — sıfırdan başla */ }
    if (!s) s = seed();

    // Eksik alanları tamamla — eski bir kayıt yüklendiğinde ekranların
    // "tanımsız" değerleri yanlış yorumlamasını önler (örn. active === undefined
    // bütün üyeleri pasif göstermişti).
    if (!s.config) s.config = Rules.defaults();
    if (!s.partnerRequests) s.partnerRequests = [];
    if (!s.notifications) s.notifications = [];
    if (!s.closures) s.closures = [];
    if (!s.bookings) s.bookings = [];
    Object.values(s.members || {}).forEach(m => {
      if (m.active === undefined) m.active = true;
      if (m.noShow === undefined) m.noShow = 0;
      if (m.late === undefined) m.late = 0;
      if (m.partner === undefined) m.partner = null;
    });

    Rules.configure(s.config);   // kayıtlı ayarları motora uygula
    return s;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* kota dolu */ }
  }

  function reset() {
    Rules.configure(Rules.defaults());
    state = seed();
    Rules.configure(state.config);
    save();
  }

  /* ---------- ayarlar ---------- */
  function saveConfig(patch) {
    state.config = Object.assign({}, state.config, patch);
    if (patch.caps)  state.config.caps  = Object.assign({}, state.config.caps, patch.caps);
    if (patch.hours) state.config.hours = Object.assign({}, state.config.hours, patch.hours);
    Rules.configure(state.config);
    save();
    return state.config;
  }
  function resetConfig() {
    state.config = Rules.defaults();
    Rules.configure(state.config);
    save();
    return state.config;
  }

  /* ---------- üye işlemleri ---------- */
  const memberList = () => Object.values(state.members)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const member = (no) => state.members[no] || null;

  function setMemberActive(no, active) {
    const m = state.members[no];
    if (m) { m.active = !!active; save(); }
    return m;
  }

  function unlinkPartner(no) {
    const m = state.members[no];
    if (!m || !m.partner) return null;
    const other = state.members[m.partner];
    if (other) other.partner = null;
    m.partner = null;
    // PRD §5A — bağlantı kalkınca gelecekteki çift randevuları iptal edilir
    const nowKey = iso(new Date()) + new Date().toTimeString().slice(0, 5);
    state.bookings.forEach(b => {
      if (b.mode === 'PARTNER' && (b.member === no || b.partnerOf === no)
          && b.status === 'CONFIRMED' && (b.date + b.time) >= nowKey) {
        b.status = 'CANCELLED';
      }
    });
    save();
    return other;
  }

  function markNoShow(bookingId) {
    const b = state.bookings.find(x => x.id === bookingId);
    if (!b) return null;
    b.status = 'NO_SHOW';
    const m = state.members[b.member];
    if (m) m.noShow = (m.noShow || 0) + 1;
    save();
    return b;
  }

  const bookingsOf = (no) => state.bookings
    .filter(b => b.member === no || b.partnerOf === no)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const bookingsAt = (dateISO, time) => state.bookings
    .filter(b => b.date === dateISO && b.time === time && b.status !== 'CANCELLED' && b.status !== 'REJECTED');

  /* ---------- partner talepleri ---------- */
  const partnerRequests = () => state.partnerRequests.filter(r => r.status === 'PENDING');

  function decidePartner(id, approve) {
    const r = state.partnerRequests.find(x => x.id === id);
    if (!r) return null;
    r.status = approve ? 'APPROVED' : 'REJECTED';
    if (approve) {
      const a = state.members[r.from], b = state.members[r.to];
      if (a && b) {
        // Tek partner kuralı: varsa eski bağlantılar çözülür
        if (a.partner && state.members[a.partner]) state.members[a.partner].partner = null;
        if (b.partner && state.members[b.partner]) state.members[b.partner].partner = null;
        a.partner = b.no;
        b.partner = a.no;
      }
    }
    save();
    return r;
  }

  const get = () => state;
  const me = () => state.members[state.me];
  const partner = () => {
    const p = me().partner;
    return p ? state.members[p] : null;
  };

  /** Bir seansın doluluğu. Yalnızca ONAYLANMIŞ randevular kontenjan tüketir;
      onay bekleyen talepler yer tutmaz (PRD §5 — talep yönetici kararına kadar askıda). */
  function occupancy(dateISO, time) {
    let ems = 0, fitness = 0, exclusiveCouple = false;
    for (const b of state.bookings) {
      if (b.date !== dateISO || b.time !== time || b.status !== 'CONFIRMED') continue;
      const seats = b.mode === 'PARTNER' ? 2 : 1;
      if (b.service === 'EMS') ems += seats; else fitness += seats;
      if (b.mode === 'PARTNER') exclusiveCouple = true;
    }
    const c = state.closures.find(c => c.date === dateISO && c.time === time);
    return {
      ems, fitness, exclusiveCouple,
      adminClosed: !!c,
      closedReason: c ? c.reason : null
    };
  }

  function pendingAt(dateISO, time) {
    return state.bookings.filter(b => b.date === dateISO && b.time === time && b.status === 'PENDING');
  }

  function myBookings() {
    return state.bookings
      .filter(b => (b.member === state.me || b.partnerOf === state.me) && b.status !== 'CANCELLED')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function upcoming() {
    const nowKey = iso(new Date()) + new Date().toTimeString().slice(0, 5);
    return myBookings().filter(b => (b.date + b.time) >= nowKey && b.status !== 'REJECTED');
  }

  function pendingRequests() {
    return state.bookings.filter(b => b.status === 'PENDING');
  }

  function addBooking(b) {
    const id = 'b' + Date.now().toString(36);
    state.bookings.push(Object.assign({ id, status: 'CONFIRMED' }, b));
    save();
    return id;
  }

  function setBookingStatus(id, status) {
    const b = state.bookings.find(x => x.id === id);
    if (b) { b.status = status; save(); }
    return b;
  }

  function notify(title, body) {
    state.notifications.unshift({
      id: 'n' + Date.now().toString(36),
      title, body, when: 'Az önce', read: false
    });
    save();
  }

  function markNotificationsRead() {
    state.notifications.forEach(n => n.read = true);
    save();
  }

  const unreadCount = () => state.notifications.filter(n => !n.read).length;

  function signIn(phone) {
    state.session = { signedIn: true, phone };
    save();
  }
  function signOut() {
    state.session = { signedIn: false, phone: '' };
    save();
  }

  function closeSlot(dateISO, time, reason) {
    if (!state.closures.find(c => c.date === dateISO && c.time === time)) {
      state.closures.push({ date: dateISO, time, reason: reason || 'Yönetici kapattı' });
    }
    // PRD §13 — kapatılan seanstaki randevular iptal edilir
    state.bookings.forEach(b => {
      if (b.date === dateISO && b.time === time && b.status === 'CONFIRMED') b.status = 'CANCELLED';
    });
    save();
  }
  function openSlot(dateISO, time) {
    state.closures = state.closures.filter(c => !(c.date === dateISO && c.time === time));
    save();
  }

  return {
    iso, addDays, get, me, partner, occupancy, pendingAt,
    myBookings, upcoming, pendingRequests,
    addBooking, setBookingStatus, notify, markNotificationsRead, unreadCount,
    signIn, signOut, closeSlot, openSlot, save, reset,
    saveConfig, resetConfig,
    memberList, member, setMemberActive, unlinkPartner, markNoShow, bookingsOf, bookingsAt,
    partnerRequests, decidePartner
  };
})();
