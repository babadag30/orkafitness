/* Orka EMS Fitness — iş kuralları motoru
   Kaynak: PRD v0.2 §4 (çalışma düzeni), §5 (kapasite ve durum), §5A (çift seansı), §13 (iptal)
   Bu dosya tek doğru kaynaktır. Arayüz buradaki sonuçları gösterir, kendi kararını vermez.

   Sayısal değerler artık sabit değil: yönetici panelindeki Ayarlar ekranı
   configure() ile bunları değiştirir ve tüm uygulama anında yeni kurala geçer. */

const Rules = (() => {

  const DEFAULTS = {
    sessionMin: 25,
    bufferMin: 5,
    caps: { EMS: 3, FITNESS: 1, TOTAL: 3 },
    // 0 = Pazar. null = kapalı gün.
    hours: {
      0: { open: '10:00', close: '22:00' },
      1: { open: '08:00', close: '23:30' },
      2: { open: '08:00', close: '23:30' },
      3: { open: '08:00', close: '23:30' },
      4: { open: '08:00', close: '23:30' },
      5: { open: '08:00', close: '23:30' },
      6: { open: '08:00', close: '23:30' }
    },
    cancelWindowH: 4,
    lateToleranceMin: 10,
    noShowThreshold: 3
  };

  let CFG = JSON.parse(JSON.stringify(DEFAULTS));

  /** Ayarlar ekranından gelen değerleri uygular. */
  function configure(patch) {
    if (!patch) return CFG;
    CFG = Object.assign({}, CFG, patch);
    if (patch.caps) CFG.caps = Object.assign({}, DEFAULTS.caps, patch.caps);
    if (patch.hours) CFG.hours = Object.assign({}, DEFAULTS.hours, patch.hours);
    return CFG;
  }
  const config = () => CFG;
  const defaults = () => JSON.parse(JSON.stringify(DEFAULTS));

  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  /** Bir tarih için seans başlangıç saatleri. PRD §4 ızgara üretim kuralı. */
  function slotsForDate(dateISO) {
    const d = new Date(dateISO + 'T00:00:00');
    const cfg = CFG.hours[d.getDay()];
    if (!cfg || !cfg.open || !cfg.close) return [];
    const open = toMin(cfg.open);
    const close = toMin(cfg.close);
    const cadence = CFG.sessionMin + CFG.bufferMin;
    const out = [];
    // Son slotun bitişi kapanışı geçemez.
    for (let t = open; t + CFG.sessionMin <= close; t += cadence) out.push(toHHMM(t));
    return out;
  }

  const isOpenOn = (dateISO) => slotsForDate(dateISO).length > 0;

  /**
   * Bir seansın durumu. PRD §5 algoritmasının birebir karşılığı.
   * occ: { ems, fitness, adminClosed, closedReason, exclusiveCouple }
   * service: 'EMS' | 'FITNESS'   mode: 'SOLO' | 'PARTNER'
   */
  function status(occ, service, mode) {
    const need = mode === 'PARTNER' ? 2 : 1;
    const total = occ.ems + occ.fitness;
    const CAP = CFG.caps;

    if (occ.adminClosed) {
      return { status: 'RED', reason: occ.closedReason || 'Yönetici tarafından kapatıldı', need };
    }
    if (occ.exclusiveCouple) {
      return { status: 'RED', reason: 'Bu seans özel çift seansı — üçüncü kişiye kapalı', need };
    }
    if (service === 'EMS' && occ.ems + need > CAP.EMS) {
      return { status: 'RED', reason: `EMS kontenjanı yetersiz (${occ.ems}/${CAP.EMS} dolu)`, need };
    }
    if (service === 'FITNESS' && occ.fitness + need > CAP.FITNESS) {
      return { status: 'RED', reason: `Fitness kontenjanı dolu (${occ.fitness}/${CAP.FITNESS})`, need };
    }
    if (total + need > CAP.TOTAL) {
      return { status: 'RED', reason: `Stüdyo kapasitesi dolu (${total}/${CAP.TOTAL})`, need };
    }
    if (total === 0) {
      return { status: 'GREEN', reason: 'Seans tamamen boş — doğrudan randevu alabilirsin', need };
    }
    return {
      status: 'ORANGE',
      reason: mode === 'PARTNER'
        ? 'Seans kısmen dolu. Çift seansı üçüncü kişiyi dışarıda bırakacağı için yönetici onayı gerekir.'
        : `Seans kısmen dolu (${total}/${CAP.TOTAL}). Kalan kontenjan için yönetici onayı gerekir.`,
      need
    };
  }

  /** PRD §13 — seansa N saatten az kaldıysa uygulamadan iptal edilemez. */
  function canCancel(dateISO, time, now = new Date()) {
    const start = new Date(dateISO + 'T' + time + ':00');
    const hoursLeft = (start - now) / 3600000;
    if (hoursLeft < 0) return { ok: false, reason: 'Bu seans geçmiş.' };
    if (hoursLeft < CFG.cancelWindowH) {
      return { ok: false, reason: `Seansa ${CFG.cancelWindowH} saatten az kaldı. İptal için stüdyoyla iletişime geç.` };
    }
    return { ok: true };
  }

  const endTime = (time) => toHHMM(toMin(time) + CFG.sessionMin);

  /** Turuncu bir seans yerine önerilecek yeşil alternatifler. PRD §3 madde 6. */
  function greenAlternatives(dateISO, service, mode, occupancyOf, limit = 3) {
    const out = [];
    for (const t of slotsForDate(dateISO)) {
      if (out.length >= limit) break;
      if (status(occupancyOf(dateISO, t), service, mode).status === 'GREEN') out.push(t);
    }
    return out;
  }

  return {
    configure, config, defaults,
    get SESSION_MIN() { return CFG.sessionMin; },
    get BUFFER_MIN() { return CFG.bufferMin; },
    get CADENCE() { return CFG.sessionMin + CFG.bufferMin; },
    get CAP() { return CFG.caps; },
    get HOURS() { return CFG.hours; },
    get CANCEL_WINDOW_H() { return CFG.cancelWindowH; },
    get LATE_TOLERANCE() { return CFG.lateToleranceMin; },
    get NO_SHOW_THRESHOLD() { return CFG.noShowThreshold; },
    slotsForDate, isOpenOn, status, canCancel, endTime, greenAlternatives,
    toMin, toHHMM
  };
})();
