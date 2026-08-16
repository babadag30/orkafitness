# Orka EMS Fitness — PWA & Studio Management System
# Product Specification v0.5 — Working Contract

> Status: WORKING PRODUCT CONTRACT
> Date: 2026-08-16
> Target reader: Claude Code and future development agents
> Owner: Orka EMS Fitness
>
> This document supersedes v0.4 where explicitly changed.
> It is intentionally change-friendly because the business owner may refine rules after the next review.
>
> IMPORTANT:
> - Centralize business rules.
> - Do not scatter capacity/package/cancellation logic across UI files.
> - Model appointments with participants so single/couple behavior can evolve without schema destruction.
> - Items marked PROVISIONAL are current working decisions and may be changed after owner review.
> - Items marked OPEN DECISION must not be guessed.

---

# 0. Engineering Goal: Make Business Rules Cheap to Change

Orka's business rules may evolve after owner feedback.

Architecture must therefore separate:

1. Domain facts
2. Business policies
3. Persistence
4. UI

Examples of policy values/strategies that must not be hardcoded throughout the app:

- EMS capacity
- Fitness capacity
- total studio occupancy
- couple exclusivity
- package total credits
- weekly limit
- package cycle
- cancellation cutoff
- cancellation allowance
- booking horizon
- booking cutoff
- debt booking restriction

Changing a rule should normally require:
- one policy/config change
- affected rule tests
- no unrelated UI rewrite

---

# 1. Product Surfaces

## Member PWA

Members can:

- login with username/password
- book EMS
- book Fitness
- optionally book an EMS couple session with their linked partner
- see next appointment
- see appointment history
- see EMS package usage
- see payment/debt status
- cancel when allowed
- receive reminders/transactional notifications

## Admin Studio Panel

Admin can:

- manage day/week calendar
- manage members
- link EMS partners
- create/reset accounts
- manage EMS packages
- record manual payments
- manage attendance/no-show
- move appointments with drag/drop
- move appointments with Cut/Paste and Ctrl/Cmd+X/V
- close/open slots
- override rules with reason
- see audit log
- see backup/sync status

---

# 2. Authentication

- username + password
- no self sign-up
- admin creates member accounts
- no SMS OTP in v1
- passwords hashed server-side
- rate limiting
- server-side MEMBER / ADMIN authorization

PROVISIONAL:
- username defaults to member number
- first login forces password change

---

# 3. Service Types

The system has two distinct booking services:

## EMS

EMS has:
- package entitlement
- weekly usage rule
- total package credits
- single booking
- couple booking
- EMS capacity rules

## FITNESS

Fitness is independent from EMS entitlement.

Fitness has:
- NO session credit/entitlement
- NO weekly credit limit
- NO EMS package deduction
- capacity only
- appointment history
- attendance
- cancellation policy
- notifications

A member may book Fitness whenever:
- member is active
- booking is inside booking window
- target time is open
- Fitness capacity permits
- total studio occupancy permits
- no exclusive EMS couple booking occupies the slot
- member has no overlapping appointment

---

# 4. Normal Studio Capacity Rules — CONFIRMED WORKING RULE

Current owner-approved working model:

- EMS maximum simultaneous people: 3
- Fitness maximum simultaneous people: 2
- Normal total studio simultaneous occupancy: 4

Therefore normal non-couple booking must satisfy:

`emsPeople <= 3`

`fitnessPeople <= 2`

`emsPeople + fitnessPeople <= 4`

Examples:

| EMS | Fitness | Result |
|---:|---:|---|
| 0 | 2 | ALLOWED |
| 1 | 2 | ALLOWED |
| 2 | 2 | ALLOWED |
| 3 | 0 | ALLOWED |
| 3 | 1 | ALLOWED |
| 3 | 2 | NOT ALLOWED |

This replaces the old demo total capacity of 3.

---

# 5. EMS Couple Booking — CURRENT WORKING RULE

An EMS couple session is not merely "two EMS seats".

It is an EXCLUSIVE STUDIO SESSION.

When an EMS couple booking exists in a time slot:

- exactly 2 linked EMS members are booked
- no third EMS member may book
- no Fitness member may book
- the couple owns the studio for that appointment time

Therefore:

`EMS_COUPLE => exclusiveStudio = true`

Once active:

`other EMS bookings = 0`

`Fitness bookings = 0`

## Couple Booking Eligibility

A couple booking can only be created when:

1. initiating member is active
2. initiating member has a linked active partner
3. linked partner is active
4. both have valid EMS packages
5. both have total EMS entitlement available
6. both are below the relevant weekly EMS limit
7. neither has a time conflict
8. target slot is open
9. target time currently has NO other EMS booking
10. target time currently has NO Fitness booking
11. booking horizon/cutoff permits
12. final validation succeeds atomically server-side

A couple booking must not be allowed into a partially occupied slot.

Once booked, the target time becomes unavailable to every other member for both EMS and Fitness.

---

# 6. Partner Relationship Model

Admin explicitly links EMS partners.

Example:

Ahmet ↔ Ayşe

Relationship must be symmetric from the product perspective.

Either Ahmet or Ayşe can initiate the couple booking.

When Ahmet chooses couple mode:
- Ayşe is automatically resolved as Ahmet's linked partner

When Ayşe chooses couple mode:
- Ahmet is automatically resolved

The user should not search the full member directory.

## Suggested domain model

Use a dedicated relation such as:

`MemberPartnerLink`

Fields may include:

- id
- memberAId
- memberBId
- active
- createdAt
- createdBy
- endedAt

Database constraints must prevent:
- linking a member to themselves
- duplicate active pair rows
- contradictory active partner relationships if business policy allows only one active EMS partner per member

PROVISIONAL:
- one active EMS partner per member in v1

Admin can:
- create link
- replace/end link
- see current partner
- audit changes

---

# 7. Appointment Participant Model — IMPORTANT

Do NOT design Appointment as permanently containing only one `memberId`.

Use:

## Appointment

Represents the shared booking/time reservation.

Suggested conceptual fields:

- id
- serviceType: EMS | FITNESS
- bookingMode: SINGLE | COUPLE
- startsAt
- endsAt
- status
- exclusiveStudio
- createdBy
- createdAt
- idempotencyKey

## AppointmentParticipant

Represents each real member participating.

Suggested conceptual fields:

- id
- appointmentId
- memberId
- participantRole: PRIMARY | PARTNER
- attendanceStatus
- entitlementReservation/reference where applicable

Examples:

### Single EMS
Appointment:
- service = EMS
- mode = SINGLE
- exclusiveStudio = false

Participants:
- Ahmet

### Couple EMS
Appointment:
- service = EMS
- mode = COUPLE
- exclusiveStudio = true

Participants:
- Ahmet
- Ayşe

### Fitness
Appointment:
- service = FITNESS
- mode = SINGLE
- exclusiveStudio = false

Participants:
- Ahmet

This model is intentionally chosen so future couple rule changes do not require destructive schema redesign.

---

# 8. EMS Entitlement

Each EMS participant is validated independently.

Current package business model:

- 8 EMS sessions per package period
- max 2 EMS sessions per week/bucket
- unused weekly allowance does not roll over

For a couple appointment:

Ahmet uses/reserves 1 EMS entitlement.

Ayşe uses/reserves 1 EMS entitlement.

The couple booking is valid only if BOTH members pass entitlement checks.

Entitlement must use an append-oriented ledger.

Suggested event types:

- BOOKING_RESERVED
- ATTENDED_CONSUMED
- NO_SHOW_CONSUMED
- LATE_CANCEL_CONSUMED
- MEMBER_CANCEL_RELEASED
- ADMIN_CANCEL_RELEASED
- MANUAL_ADJUSTMENT

Each participant's entitlement lifecycle must be independently traceable.

---

# 9. EMS Package Cycle

PROVISIONAL — OWNER REVIEW EXPECTED

Current recommended working model:

- 28-day package cycle
- divided into four 7-day entitlement buckets
- maximum 2 EMS sessions per bucket
- unused bucket entitlement does not roll forward

Reason:
this matches strict `2 + 2 + 2 + 2 = 8`.

This rule must be implemented behind a cycle strategy/policy so switching later to:
- calendar month
- Monday-Sunday week
- another package cycle

does not require rewriting unrelated booking code.

---

# 10. Couple Booking UX

Couple mode must NOT be the default.

Default:
- single EMS booking

Member should deliberately opt in.

Recommended UX:

During EMS booking, show a low-emphasis secondary control such as:

`Partnerimle geleceğim`

or

`2 kişilik EMS seansı`

Default:
OFF

When enabled:

- show linked partner name
- explain that the booking is for the two linked members
- show only slots eligible for an exclusive couple booking
- do not let user choose another arbitrary member
- final confirmation displays both member names

Example:

`Ahmet + Ayşe`

`2 kişilik özel EMS seansı`

The control must be discoverable but visually secondary so users do not enable it accidentally.

---

# 11. Couple Slot Visibility

A slot may be available for a normal booking but unavailable for a couple booking.

Example:

At 10:00:
- 1 EMS single already exists

Normal EMS may still have capacity.

Couple mode:
- NOT AVAILABLE

At 10:00:
- 1 Fitness booking exists

Couple mode:
- NOT AVAILABLE

At 10:00:
- completely empty and open

Couple mode:
- AVAILABLE if both partners pass entitlement checks

The UI must use the selected booking mode when calculating availability.

---

# 12. Cross-Service Capacity Policy

Normal mode and exclusive couple mode are two separate policy branches.

Pseudo-policy:

IF an active exclusive couple appointment overlaps target time:
    reject every new EMS/Fitness booking

ELSE IF requested booking is EMS COUPLE:
    require zero existing overlapping EMS participants
    require zero existing overlapping Fitness participants
    require both partner eligibility
    create exclusive appointment

ELSE:
    enforce normal capacity:
        EMS <= 3
        Fitness <= 2
        total occupancy <= 4

Final validation is always server-side and transactional.

---

# 13. Cancellation

EMS confirmed rule:

- member self-cancel cutoff: 24 hours before
- EMS member has 1 self-service cancellation allowance per EMS package period
- admin can override

Recommended valid EMS cancellation:
- entitlement reservation released
- cancellation allowance consumed

Fitness:
- no entitlement exists

PROVISIONAL:
- Fitness uses same 24-hour self-cancel cutoff
- Fitness does not have EMS package cancellation allowance

## Couple Cancellation — OPEN DECISION

Architecture must support policy changes without schema changes.

Questions to confirm with owner:

1. If either partner cancels a couple appointment, is the entire couple appointment cancelled?
   Recommended current behavior: YES.

2. Does cancelling one couple appointment consume the self-cancellation allowance of BOTH EMS members or only the initiating member?
   Do NOT hardcode yet.

3. Can admin convert a couple appointment into a single EMS appointment if one partner cannot attend?
   Do NOT hardcode yet.

Until confirmed:
- model cancellation at appointment level
- model entitlement/cancellation accounting per participant
- keep policy configurable/testable

---

# 14. Couple Attendance — FLEXIBLE MODEL

Attendance should be tracked per participant, not only at appointment level.

Reason:
one partner may attend while the other is absent.

AppointmentParticipant should be able to record:

- SCHEDULED
- ATTENDED
- NO_SHOW
- MEMBER_CANCELLED
- LATE_CANCEL
- ADMIN_CANCELLED

This allows:

Ahmet = ATTENDED
Ayşe = NO_SHOW

without corrupting the appointment history.

Exact owner policy for partial couple attendance can be confirmed later.

---

# 15. Fitness Entitlement and Attendance

Fitness:
- does not consume EMS credits
- does not count toward EMS weekly usage
- still has attendance history
- can be marked attended/no-show
- appears in member appointments
- receives reminders

Fitness no-show must NOT alter EMS entitlement.

---

# 16. Booking Horizon and Booking Cutoff

PROVISIONAL:

- booking horizon = 14 days
- new booking closes 2 hours before session start

Both must be configurable business policies.

---

# 17. Member-Facing Capacity Language

Never expose raw operational capacity math to members.

Member sees simple states:

- Uygun
- Dolu
- Kapalı

For couple mode, an unavailable slot remains simple:
- Dolu / Uygun değil

Admin may see richer reasons.

Do not show to member:
- EMS 2/3
- Fitness 1/2
- Total 3/4
- internal exclusivity math

---

# 18. Old Orange Approval Flow

CURRENT WORKING DECISION:

Remove orange admin-approval behavior from normal member booking.

Normal booking:

eligibility + capacity available
→ direct booking

not available
→ unavailable

Admin keeps:
- manual booking
- override
- reason
- audit log

Do not preserve legacy orange flow as a hidden default.

---

# 19. Payments

No online payment gateway in v1.

Admin manual payment methods:

- CASH / Nakit
- CARD / Kart
- BANK_TRANSFER / Havale

Payment history and debt are tracked.

PROVISIONAL:
- overdue debt booking block is configurable
- default OFF

---

# 20. Admin Calendar

Core features remain:

- Day / Week
- appointment cards
- drag-and-drop reschedule
- right-click context menu
- internal Cut/Paste
- Ctrl/Cmd+X
- Ctrl/Cmd+V
- manual booking
- slot close/open
- attendance
- audit

## Couple Visual Treatment

Couple appointment should visually communicate:

- two linked member names
- EMS Couple
- exclusive session

Example:

`09:30`
`Ahmet + Ayşe`
`EMS · Çift`

The calendar engine must know that this appointment blocks all other service bookings during the overlapping time.

---

# 21. Rescheduling Rules

Moving an appointment must re-run full target-slot validation.

Single EMS:
- member entitlement/week rule
- EMS capacity
- total capacity

Fitness:
- Fitness capacity
- total capacity
- exclusive couple conflict

Couple EMS:
- both members' entitlement/week rules
- target must be completely empty
- target becomes exclusive

Cross-week or cross-package moves must re-evaluate entitlement.

Admin override:
- allowed only where product policy permits
- reason required
- audit log required

---

# 22. Concurrency Requirements

Capacity and entitlement decisions are shared state.

Never trust only client-side availability.

Final booking transaction must protect against:

- two users taking final EMS capacity
- two users taking final Fitness capacity
- normal booking racing with couple booking
- couple booking racing with Fitness booking
- two couple bookings racing for same slot
- same member duplicate booking
- repeated network request

Use:
- transaction
- locking/constraints
- idempotency key
- server-side revalidation

A couple booking must atomically:
- reserve slot exclusivity
- create appointment
- attach both participants
- reserve both EMS entitlements

Partial success is forbidden.

---

# 23. Rule Engine Design Requirement

Create policy functions/services instead of scattered conditionals.

Conceptual examples:

- `canBookSingleEMS(...)`
- `canBookCoupleEMS(...)`
- `canBookFitness(...)`
- `validateStudioCapacity(...)`
- `validateExclusiveCoupleSlot(...)`
- `validateMemberEntitlement(...)`
- `validateCancellation(...)`
- `validateReschedule(...)`

Prefer a shared result structure:

- allowed
- reasonCode
- internalReason
- memberMessage
- adminMessage
- overridable

UI must consume rule results, not recreate business logic.

---

# 24. Change-Safety Requirement

Tomorrow's owner feedback must be cheap to incorporate.

The following should be policy/config changes where possible:

- EMS 3 → another number
- Fitness 2 → another number
- total 4 → another number
- couple exclusive → non-exclusive
- couple requires empty slot → another rule
- 28-day → calendar month
- 2/week → another weekly limit
- 24-hour cancellation → another cutoff
- 14-day horizon → another horizon
- 2-hour booking cutoff → another cutoff

Changing these must not require:
- rewriting screens
- changing unrelated payment code
- changing auth
- destructive DB redesign

---

# 25. Current Confirmed / Working Decision Summary

CONFIRMED from latest business-owner feedback relayed by product owner:

- Normal EMS capacity = 3
- Fitness capacity = 2
- Normal total simultaneous occupancy = 4
- EMS 2 + Fitness 2 is allowed
- EMS couple booking is studio-exclusive
- Couple slot contains only that couple
- No third EMS member during couple slot
- No Fitness member during couple slot
- Couple members are explicitly linked in the system
- Either linked member may initiate couple booking
- Both members must pass EMS entitlement checks
- Both members consume/reserve their own EMS entitlement

WORKING / PROVISIONAL:

- 28-day package cycle
- four 7-day buckets
- 2 EMS sessions per bucket
- valid EMS cancellation returns entitlement
- one self-cancellation allowance per EMS package period
- 14-day booking horizon
- 2-hour new booking cutoff
- Fitness 24-hour cancellation cutoff
- username = member number
- first login password change
- debt booking restriction default OFF

OPEN DECISION:

- couple cancellation allowance accounting
- converting couple → single when one partner drops out
- precise partial-attendance business policy
- Fitness appointment duration/slot cadence if different from current shared schedule
- final owner confirmation of provisional rules

---

# 26. Phase 1 Boundary

Phase 1 should implement:

- domain model
- rule engine
- entitlement calculations
- capacity/exclusivity calculations
- partner relationship logic
- cancellation policy interfaces
- pure tests

Phase 1 should NOT yet implement:

- production database provisioning
- production authentication
- UI redesign
- admin calendar interaction
- Higgsfield design generation
- Google Sheets integration
- push notifications
- production deploy

The purpose is to make the business logic correct and change-friendly before infrastructure/UI.
