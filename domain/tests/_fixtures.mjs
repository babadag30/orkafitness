/* Test kurgusu — okunabilir dünya kurucu.

   Testlerin kendisi iş kuralını anlatmalı, veri hazırlamayı değil.
   Bu yüzden kurgu burada toplandı ve zincirlenebilir yazıldı. */

import {
  ServiceType, BookingMode, ParticipantRole,
  AttendanceStatus, AppointmentStatus, LedgerEventType,
  DEFAULT_POLICY, createEntry, toEpoch
} from '../index.mjs';

/** Sabit zaman ekseni — testler saate göre değişmez. */
export const NOW = '2026-09-01T09:00:00+03:00';
export const PACKAGE_START = '2026-09-01T00:00:00+03:00';
/** Paket başlangıcından 3 gün sonra → 0 numaralı 7 günlük kova. */
export const SLOT = '2026-09-04T10:00:00+03:00';
/** 0 numaralı kovadaki ikinci bir gün. */
export const SLOT_SAME_BUCKET = '2026-09-05T10:00:00+03:00';
/** 1 numaralı kova (paket başından 8. gün). */
export const SLOT_NEXT_BUCKET = '2026-09-09T10:00:00+03:00';

let seq = 0;
const nextId = (p) => `${p}-${++seq}`;

export function makeWorld({ policy = DEFAULT_POLICY, now = NOW } = {}) {
  const members = new Map();
  const packages = new Map();
  const ledgers = new Map();
  const links = [];
  const appointments = [];

  const world = {
    /** Üye ekler. Varsayılan aktif. */
    member(id, opts = {}) {
      members.set(id, { id, name: opts.name ?? id, active: opts.active ?? true });
      return world;
    },

    /** Üyeye EMS paketi tanımlar. */
    pkg(memberId, opts = {}) {
      packages.set(memberId, {
        id: opts.id ?? nextId('pkg'),
        memberId,
        startsAt: toEpoch(opts.startsAt ?? PACKAGE_START),
        totalCredits: opts.totalCredits ?? policy.entitlement.totalCredits,
        active: opts.active ?? true
      });
      if (!ledgers.has(memberId)) ledgers.set(memberId, []);
      return world;
    },

    /** Partner bağı kurar (simetrik, tek satır). */
    link(a, b, opts = {}) {
      links.push({
        id: opts.id ?? nextId('link'),
        memberAId: a,
        memberBId: b,
        active: opts.active ?? true,
        endedAt: opts.endedAt ?? null
      });
      return world;
    },

    /** Defterlere doğrudan rezervasyon yazar — geçmiş kullanımı kurgulamak için. */
    reserve(memberId, sessionStartsAt, count = 1) {
      const p = packages.get(memberId);
      const list = ledgers.get(memberId) ?? [];
      for (let i = 0; i < count; i++) {
        list.push(createEntry({
          type: LedgerEventType.BOOKING_RESERVED,
          memberId,
          memberPackageId: p?.id ?? null,
          sessionStartsAt,
          recordedAt: toEpoch(now)
        }));
      }
      ledgers.set(memberId, list);
      return world;
    },

    /** Defter kaydını doğrudan ekler (iade, manuel düzeltme vb.). */
    entry(memberId, type, sessionStartsAt, extra = {}) {
      const p = packages.get(memberId);
      const list = ledgers.get(memberId) ?? [];
      list.push(createEntry({
        type, memberId, memberPackageId: p?.id ?? null,
        sessionStartsAt, recordedAt: toEpoch(now), ...extra
      }));
      ledgers.set(memberId, list);
      return world;
    },

    /** Var olan bir randevu kurgular. */
    booking({ service = ServiceType.EMS, mode = BookingMode.SINGLE,
              startsAt = SLOT, memberIds = [], exclusive, status } = {}) {
      const start = toEpoch(startsAt);
      appointments.push({
        id: nextId('appt'),
        serviceType: service,
        bookingMode: mode,
        startsAt: start,
        endsAt: start + policy.session.durationMinutes * 60_000,
        status: status ?? AppointmentStatus.ACTIVE,
        exclusiveStudio: exclusive ?? (mode === BookingMode.COUPLE && policy.couple.exclusiveStudio),
        participants: memberIds.map((mid, i) => ({
          id: nextId('part'),
          memberId: mid,
          participantRole: i === 0 ? ParticipantRole.PRIMARY : ParticipantRole.PARTNER,
          attendanceStatus: AttendanceStatus.SCHEDULED
        }))
      });
      return world;
    },

    /** Aynı saate n adet tek kişilik randevu koyar. */
    fill(service, n, startsAt = SLOT, prefix = 'x') {
      for (let i = 0; i < n; i++) {
        const mid = `${prefix}${i}`;
        if (!members.has(mid)) world.member(mid);
        world.booking({ service, startsAt, memberIds: [mid] });
      }
      return world;
    },

    /** Motora verilecek bağlam. */
    ctx(overrides = {}) {
      return {
        now: toEpoch(now),
        policy,
        slot: { startsAt: toEpoch(SLOT) },
        members, packages, ledgers, links, appointments,
        ...overrides
      };
    },

    appointments,
    members,
    packages,
    ledgers,
    links
  };

  return world;
}

/** İki aktif üye + paket + partner bağı — en sık kullanılan kurgu. */
export function coupleWorld(opts = {}) {
  return makeWorld(opts)
    .member('ahmet', { name: 'Ahmet' })
    .member('ayse', { name: 'Ayşe' })
    .pkg('ahmet')
    .pkg('ayse')
    .link('ahmet', 'ayse');
}

/** Tek aktif üye + paket. */
export function soloWorld(opts = {}) {
  return makeWorld(opts).member('ahmet', { name: 'Ahmet' }).pkg('ahmet');
}
