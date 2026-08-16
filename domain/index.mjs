/* Orka EMS Fitness — domain katmanı tek giriş noktası
   v0.5 §26 Phase 1 sınırı: burada yalnızca iş kuralı var.
   Framework yok, tarayıcı yok, veritabanı yok, ağ yok.

   Phase 2'de sunucu bu modülü olduğu gibi kullanır; kalıcılık katmanı
   yalnızca RuleResult.metadata.plan içindeki yazma niyetini uygular. */

export * from './core/types.mjs';
export * from './core/result.mjs';
export * from './core/time.mjs';

export { DEFAULT_POLICY, withPolicy } from './config/policy.default.mjs';
export { DEMO_POLICY, DEMO_PROVISIONAL_NOTES } from './config/policy.demo.mjs';

export { resolveCycle, isWithinCycle, resolveBucket } from './policies/cycle.policy.mjs';
export {
  validateStudioCapacity, validateNormalCapacity,
  validateExclusiveCoupleSlot, validateNoExclusiveConflict
} from './policies/capacity.policy.mjs';
export { validateMemberEntitlement, entitlementSummary } from './policies/entitlement.policy.mjs';
export {
  resolveLinkedPartner, validatePartnerLink, endPartnerLink, findActiveLink
} from './policies/partner.policy.mjs';
export { validateBookingWindow, validateSlotOpen } from './policies/booking-window.policy.mjs';
export {
  validateCancellation, buildCancellationPlan,
  convertCoupleToSingle, recordLateCancel
} from './policies/cancellation.policy.mjs';
export { slotsForDate, isOpenOn, hoursForDate, bookableDays, minToHHMM } from './policies/schedule.policy.mjs';

export { createEntry, projectEntitlement, bucketUsageFor, cancellationsUsed } from './ledger/ledger.mjs';
export { computeOccupancy, hasMemberConflict, isExclusive, occupiesSeat } from './engine/occupancy.mjs';
export {
  canBook, canBookSingleEMS, canBookCoupleEMS, canBookFitness,
  validateReschedule, validateFitnessAccess
} from './engine/booking.engine.mjs';
