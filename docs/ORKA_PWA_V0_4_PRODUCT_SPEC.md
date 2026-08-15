# Orka EMS Fitness — PWA & Studio Management System
# Product Specification v0.4

> Status: WORKING PRODUCT CONTRACT
> Target reader: Claude Code and future development agents
> Owner: Orka EMS Fitness
> Product direction: Member PWA + Admin Studio Management Panel
>
> IMPORTANT:
> - This document supersedes earlier PWA product assumptions where they conflict.
> - Existing website design is NOT being redesigned by this document.
> - Any item marked `OPEN DECISION` must not be guessed by the implementation agent.
> - Production deploys, destructive refactors, DB resets and source deletions require explicit user approval.

---

# 0. Core Product Principle

Orka EMS Fitness should feel simple to members and powerful to the studio owner.

Member experience:

> "Open app → see next session → book a new session in seconds."

Admin experience:

> "Open calendar → understand the studio day/week immediately → move, edit and manage appointments with minimal friction."

System principle:

> Complex capacity, package, payment, attendance and audit logic runs in the background. Members should not be exposed to operational complexity.

---

# 1. Product Surfaces

There are two main product surfaces.

## 1.1 Member PWA

Members can:

- sign in
- see next appointment
- book EMS appointments
- see weekly / package usage
- cancel appointments when allowed
- see package status
- see payment/debt status
- see attendance / no-show history
- receive reminders and transactional notifications
- change password
- install the PWA

## 1.2 Admin Studio Panel

Admin can:

- see day/week calendar
- see all appointments
- drag and drop appointments
- cut/paste appointments with mouse/keyboard
- manually add appointments
- open/close time slots
- manage members
- manage EMS packages
- record manual payments
- see debt / overdue status
- mark attended / no-show
- override business rules
- see audit logs
- see backup/sync health
- manage selected business settings

---

# 2. Website vs App Brand System

## 2.1 Website

The existing website remains a separate brand surface.

- Keep Orbitron on the website.
- Keep the current website visual identity unless a separate website redesign is requested.
- Website and PWA belong to the same brand but do not need identical typography.

## 2.2 Member PWA Typography

Orbitron is NOT the primary UI font for the PWA.

Use a modern, highly readable sans-serif.

Preferred:
- Inter

Fallback:
- `-apple-system`
- `BlinkMacSystemFont`
- `"Segoe UI"`
- `sans-serif`

Orbitron may be used sparingly for:
- logo/brand moments
- splash/marketing display detail
- never for dense body UI

---

# 3. PWA Visual Direction

Target design language:

- ultra modern 2026 startup aesthetic
- premium mobile design
- dark mode first
- minimalistic
- Apple-like hierarchy
- modern fitness / self-improvement feeling
- NOT bodybuilding style
- NOT cluttered
- high readability
- generous whitespace
- subtle motion
- refined micro-interactions
- rounded corners
- subtle gradients
- very light glassmorphism only when useful
- soft shadows
- clean icons
- clear primary CTA
- very limited badge/pill usage

## 3.1 Palette Direction

- dark charcoal backgrounds
- soft white text
- modern neutral greys
- subtle electric blue accents
- restrained cyan gradient accents
- premium dark cards
- high contrast
- accessible status colors

Do NOT turn every status into a saturated colored card.

## 3.2 Design Reference Philosophy

A provided Bulky AI mobile UI reference is liked for:

- spacing discipline
- hierarchy
- simplicity
- card restraint
- clear CTAs
- polished bottom navigation
- premium startup feeling

Do NOT clone the app.

Use it as visual quality and information-density inspiration.

---

# 4. Higgsfield MCP Design Protocol

The user's Claude environment has Higgsfield Pro available through MCP.

Higgsfield should be used as a DESIGN ACCELERATOR during the redesign phase, not as a source of business rules.

## Rules

Before using Higgsfield:

1. Claude must inspect the actually available Higgsfield MCP tools.
2. Do not assume a tool or capability exists without discovering it.
3. Product rules in this file override visual output.
4. Generated screens are inspiration / design exploration unless explicitly approved.
5. Do not blindly copy another product's UI.

## Required design workflow

When Phase 3 (Member PWA redesign) begins:

1. Read this full document.
2. Read the existing app UI/code.
3. Build a compact design brief.
4. Use Higgsfield MCP to explore several premium Orka-specific directions.
5. At minimum explore:
   - Home / Dashboard
   - Booking Calendar
   - Time Selection
   - Appointment Detail
   - My Appointments
   - Profile / Package
6. Prefer coherent system-level concepts over isolated pretty screens.
7. Bring visual concepts back into one consistent Orka design system.
8. Implement only after the design direction is approved.

Admin design can use Higgsfield for visual inspiration too, but the admin calendar must prioritize usability over visual spectacle.

---

# 5. Roles

## MEMBER

Can access only own data.

Capabilities:

- login
- view own appointments
- create eligible appointment
- cancel when allowed
- view package usage
- view payment status
- view attendance history
- receive notifications
- change password

## ADMIN

Capabilities:

- full studio calendar
- manage appointments
- reschedule
- manual booking
- slot close/open
- attendance management
- member management
- package management
- manual payment entry
- debt tracking
- user account creation
- reset member password
- rule override with reason
- view logs
- view sync/backup state

## STAFF / TRAINER

Not mandatory in v1.

Architecture should not make future staff roles impossible.

---

# 6. Authentication

Previous phone + OTP login is removed.

New authentication:

- username + password
- no self sign-up
- admin creates member account
- admin provides initial username/password

Recommended behavior:

- first login forces password change
- admin can reset password
- password reset does not require SMS in v1

Security:

- never store plaintext password
- password hash server-side
- secure session
- login rate limiting
- generic login errors
- role authorization server-side
- member cannot reach admin API/routes

`OPEN DECISION`
- Username = member number or custom username?

Recommended:
- default username based on member number or simple admin-assigned username

---

# 7. EMS Package Rule

Core package:

- 8 EMS sessions per package period
- maximum 2 sessions per week
- unused weekly allowance does NOT roll over
- member cannot use 3 sessions next week because they only used 1 this week

Member UI should show simply:

- `Bu hafta 1 / 2`
- `Paket 5 / 8`

Do not expose ledger math.

## 7.1 Entitlement state

Booking reserves entitlement.

Possible lifecycle:

- BOOKING_RESERVED
- ATTENDED_CONSUMED
- NO_SHOW_CONSUMED
- LATE_CANCEL_CONSUMED
- MEMBER_CANCEL_RELEASED
- ADMIN_CANCEL_RELEASED
- MANUAL_ADJUSTMENT

Never rely only on a mutable number like `remaining = 5`.

Maintain a usage ledger.

## 7.2 Package Period

`OPEN DECISION`

Need business confirmation:

### Option A
Calendar month + Monday-Sunday week

### Option B
4 x 7-day package windows = 28-day package cycle

Recommended if strict "2+2+2+2 = 8" policy:
- Option B

Do not hardcode until confirmed.

---

# 8. Booking Eligibility Engine

Booking must be validated SERVER-SIDE.

Check:

1. member active
2. login/session valid
3. package active
4. package date valid
5. payment booking restriction if configured
6. total entitlement available
7. weekly limit below 2
8. no overlapping member appointment
9. slot exists
10. slot open
11. capacity available
12. booking window valid
13. request idempotency / no duplicate booking

Final capacity decision must happen inside an atomic transaction.

Client UI is never source of truth.

---

# 9. Booking Horizon

`OPEN DECISION`

Recommended initial setting:

- members can book up to 14 days ahead

Admin configurable:
- `bookingOpenDaysAhead`

Also decide:

`OPEN DECISION`
- how close to session start can a NEW booking be created?

---

# 10. Member Booking UX

Target:

`Home → Randevu Al → Gün → Saat → Onay`

No unnecessary wizard.

## Calendar

- clean month calendar
- month title
- today indicator
- selected day
- disabled unavailable days
- premium dark design

After selecting a day:

- show times chronologically
- large touch targets
- smooth spacing
- minimal labels

Member-facing slot states:

- Uygun
- Dolu
- Kapalı

Do NOT show:

- EMS 1/3
- Fitness 0/1
- Total 2/3
- raw internal capacity
- internal approval codes
- algorithm explanation

## Confirmation

Show:

- service
- date
- time
- duration
- confirm CTA

If slot becomes unavailable during confirmation:
- friendly error
- nearest available alternatives

---

# 11. Existing Orange Approval Flow

The previous demo contains:
- green = direct
- orange = admin approval
- red = unavailable

This should be reconsidered.

Recommended simpler member behavior:

- capacity + eligibility available → direct booking
- full/closed → unavailable
- admin handles exceptional override manually

`OPEN DECISION`
- Does the special orange approval flow still need to exist?
- Does partner/couple booking remain in v1?

Do not delete existing behavior until decision is confirmed.

---

# 12. Member Home Dashboard

Keep simple.

Priority:

1. greeting
2. next appointment
3. large Book Appointment CTA
4. weekly use `1 / 2`
5. package use `5 / 8`
6. upcoming appointments
7. payment/debt warning only if relevant

Do NOT make home look like an admin dashboard.

Suggested next appointment card:

- day
- date
- time
- EMS
- status

---

# 13. Member Navigation

Recommended bottom nav:

1. Ana Sayfa
2. Randevu Al
3. Randevularım
4. Profil

Notification center can be a header icon.

---

# 14. Cancellation Policy

Business rule:

- member can cancel until 24 hours before session
- member has only 1 self-service cancellation allowance per package period
- unused cancellation allowance does not roll over
- admin can override

Recommended valid cancellation behavior:

- appointment cancelled
- reservation released
- package entitlement returned
- weekly reservation released
- cancellation allowance consumed

If less than 24h:
- member cannot cancel in app
- admin may mark LATE_CANCEL if necessary
- entitlement normally consumed

If cancellation allowance already used:
- member cannot self-cancel again
- show contact studio message

Admin cancellation:
- does not consume member cancellation allowance
- returns entitlement
- member notified
- logged

Admin reschedule:
- does not count as cancellation
- does not consume entitlement
- member notified
- logged

---

# 15. Attendance / No-show

Appointment attendance states:

- SCHEDULED
- ATTENDED
- NO_SHOW
- MEMBER_CANCELLED
- LATE_CANCEL
- ADMIN_CANCELLED

Admin can mark:

- Geldi
- Gelmedi

No-show:

- consumes session entitlement
- increases no-show count
- visible in member history
- logged

Member history:

- Katıldı
- Kaçırdı
- İptal
- Stüdyo iptal etti

`OPEN DECISION`
- automatic penalty after N no-shows?

Recommended v1:
- log only
- no automatic lock

---

# 16. Notifications

Core reminder:

- 6 hours before EMS session

Example:

`Bugün 18:30'da EMS seansın var. Seni bekliyoruz.`

Transactional notifications:

- booking created
- booking cancelled
- admin rescheduled
- admin cancelled
- reminder
- optional package expiry
- optional overdue payment

Notification delivery must be logged:

- QUEUED
- SENT
- FAILED

PWA install UX:

- Android install path
- iOS Add to Home Screen guidance
- request push permission only after meaningful context

---

# 17. My Appointments

Two sections:

## Upcoming
- nearest first
- date
- time
- service
- status

## History
- attendance status
- cancellations
- no-shows

Keep visual density low.

---

# 18. Manual Payment System — v1 MUST

NO online payment gateway in v1.

Admin manually records payments.

Supported payment methods:

- CASH / Nakit
- CARD / Kart
- BANK_TRANSFER / Havale

Payment record:

- id
- memberId
- memberPackageId
- amount
- currency
- method
- paidAt
- dueDate
- status
- note
- createdBy
- createdAt

Payment status:

- PAID
- PARTIAL
- DUE
- OVERDUE
- WAIVED

Admin flow:

`Üye → Ödeme Ekle`

Fields:

- Tutar
- Yöntem
- Tarih
- Not
- Pakete bağla

Member can see:

- paid
- due
- overdue
- debt amount

Do not expose internal accounting complexity.

`OPEN DECISION`
- Should overdue debt block booking?

Recommended:
- configurable admin setting:
  `blockBookingWhenOverdue`

---

# 19. Admin Dashboard

Show useful operational summary only:

- today's appointments
- today's occupancy
- next session
- unmarked attendance
- overdue members
- packages expiring soon
- quick actions

Avoid decorative analytics overload.

---

# 20. Admin Calendar

This is a core product screen.

Desktop-first, responsive.

Views:

- Day
- Week
- optional Month overview

Default:
- Week

Layout:

- 7 day columns
- time axis
- today highlighted
- current time indicator
- appointment cards in time cells

Appointment card:

`09:30`
`Hasan Babadağ`
`EMS`

Admin-only metadata can be shown carefully.

---

# 21. Drag-and-Drop Reschedule — v1 MUST

Admin can drag appointment card from one slot/day to another.

During drag:

Target cells indicate:

- valid
- full
- closed
- conflict

On drop show confirmation:

`Hasan Babadağ`
`16 Ağustos 09:30 → 16 Ağustos 16:30`

Actions:

- Vazgeç
- Taşı ve Bildir

Before saving:
- re-check server capacity
- re-check member collision
- re-check package/week rule
- allow admin override if designed
- override requires reason
- update booking
- audit log
- notification

---

# 22. Cut / Paste Appointment Calendar — v1 MUST

In addition to drag-and-drop, admin can move an appointment using an INTERNAL APPLICATION CLIPBOARD.

IMPORTANT:
Do not depend on the operating system clipboard to store appointment data.

## 22.1 Cut methods

Appointment card:

- right click → Kes
- Windows/Linux: Ctrl+X
- macOS: Cmd+X

When cut:

- appointment is NOT deleted from DB
- store selected appointment ID in internal admin clipboard state
- card becomes visually dimmed
- show subtle `Taşınmayı bekliyor` state

Escape:
- cancel cut state

Navigating between days/weeks:
- cut state should remain until cancelled or pasted

## 22.2 Paste methods

Target empty calendar cell:

- right click → Yapıştır
- Windows/Linux: Ctrl+V
- macOS: Cmd+V

Show confirmation:

`Hasan Babadağ`
`16 Ağustos 09:30`
`→`
`21 Ağustos 10:00`

Actions:

- Vazgeç
- Taşı ve Bildir

## 22.3 Context Menus

Appointment right-click menu:

- Detay
- Kes
- Taşı…
- Geldi
- Gelmedi
- İptal Et

Empty slot right-click menu:

- Yapıştır (if clipboard contains appointment)
- Manuel Randevu Ekle
- Seansı Kapat

## 22.4 Keyboard Safety

Do not override normal text editing.

Ctrl/Cmd+X/V appointment shortcuts must be ignored if focus is inside:

- input
- textarea
- contenteditable
- form field where normal clipboard behavior is expected

## 22.5 Validation

Paste validates same rules as drag-and-drop.

If invalid:
- explain why
- do not mutate booking

Admin override:
- only where allowed
- reason mandatory
- audit logged

Mobile/tablet:
- long press / action sheet should provide equivalent move behavior

---

# 23. Admin Session Detail

Opening a time slot shows:

- date
- time
- capacity
- booked members
- attendance
- package/payment warning where useful

Member quick actions:

- Üyeyi Aç
- Geldi
- Gelmedi
- Taşı
- İptal

Slot actions:

- Seansı Kapat
- Seansı Aç
- Manuel Randevu Ekle

---

# 24. Member Management

Admin member list:

- member no
- name
- username
- phone
- active
- package
- remaining entitlement
- weekly usage
- payment status
- debt
- no-show count
- next appointment

Search:

- name
- phone
- member no
- username

Member detail:

## Identity
- name
- member no
- username
- phone
- active

## Package
- plan
- period
- total
- reserved
- consumed
- remaining
- weekly usage
- cancellation allowance

## Payments
- paid
- debt
- payment history
- add payment

## Attendance
- attended
- no-show
- late cancel
- history

## Notes
- internal admin notes

## Actions
- add/renew package
- add payment
- reset password
- deactivate
- manual appointment
- entitlement adjustment with reason

---

# 25. Audit Log — v1 MUST

Critical actions must be traceable.

Events:

- LOGIN_ADMIN
- BOOKING_CREATED
- BOOKING_CANCELLED
- BOOKING_RESCHEDULED
- BOOKING_CUT_STARTED (optional UI log, not required as permanent DB event)
- ATTENDANCE_CHANGED
- PACKAGE_ASSIGNED
- PACKAGE_UPDATED
- ENTITLEMENT_ADJUSTED
- PAYMENT_ADDED
- PAYMENT_UPDATED
- MEMBER_DEACTIVATED
- PASSWORD_RESET
- SLOT_CLOSED
- SLOT_OPENED
- ADMIN_OVERRIDE

Fields:

- eventId
- actorId
- actorRole
- entityType
- entityId
- action
- oldValue
- newValue
- reason
- timestamp
- requestId

Audit log should be append-oriented.

---

# 26. Data Storage — Source of Truth

Production source of truth must be a real server-side database.

Recommended category:

- PostgreSQL-compatible relational database

Do NOT use:

- localStorage as production source of truth
- Google Sheets as source of truth
- a single Excel file as operational database

Requirements:

- transactions
- constraints
- migrations
- backup
- restore procedure
- authorization
- indexes
- concurrency safety

---

# 27. Backup Architecture — v1 MUST

Use THREE layers.

## Layer 1 — Production Database Backup

Primary recovery mechanism.

Requirements:

- automatic database backups
- retention
- restore test/procedure
- preferably point-in-time recovery if provider supports it

## Layer 2 — Google Sheets Near-Real-Time Mirror

Google Sheets is a HUMAN-READABLE OPERATIONS MIRROR, not the database.

Suggested spreadsheet:

`Orka EMS Fitness — Operasyon Aynası`

Sheets:

### Appointments_Current
- date
- time
- member
- service
- status
- updatedAt

### Appointment_Log
Append-only:
- timestamp
- action
- member
- old date/time
- new date/time
- actor

### Payments
- member
- package
- amount
- method
- date
- payment status

### Packages
- member
- package period
- weekly use
- total use
- remaining
- status

### Attendance
- member
- appointment
- attended/no-show/etc
- timestamp

### Sync_Status
- lastSuccessfulSync
- lastFailure
- pendingOutboxCount

Do NOT sync:
- password
- password hash
- auth token
- session token
- API keys
- secrets

## 27.1 Sync Pattern

Use an event/outbox model.

Example:

1. DB transaction succeeds.
2. Audit/outbox event is created.
3. background worker processes event.
4. Google Sheets updated.
5. event marked SYNCED.
6. failure retries with backoff.

Google failure must NEVER block member booking.

Statuses:

- PENDING
- SYNCED
- FAILED
- RETRYING

Appointment_Log remains append-only.

## Layer 3 — Daily Export Snapshot

Generate daily export archives.

Preferred:

- CSV files

Optional:
- XLSX bundle

Export:

- Members
- Appointments
- AppointmentLogs
- Packages
- PackageLedger
- Payments
- Attendance

File example:

`orka-backup-2026-08-16.zip`

Contains separate CSVs.

---

# 28. Backup Health UI

Admin Settings → Sistem

Show:

## Veri Yedekleme

- Database Backup ✓
- Google Sheets ✓
- Son senkronizasyon: timestamp
- Bekleyen senkronizasyon: count
- Günlük arşiv ✓
- Son günlük arşiv: date

State:

- Healthy
- Warning
- Failed

Do not expose secrets or credentials.

---

# 29. Offline PWA Policy

PWA shell may work offline.

Allowed offline:

- app opens
- cached UI
- previously fetched own appointments can be viewed

Do NOT allow offline mutations:

- create booking
- cancel
- admin reschedule
- payment
- attendance
- package update

Reason:
shared capacity and entitlement state require authoritative server state.

Show clear reconnect message.

---

# 30. Suggested v1 Scope — MUST

## Member

- username/password
- password change
- dark-first redesign
- home dashboard
- booking calendar
- appointment confirmation
- appointments list/history
- EMS 8/package period
- max 2/week
- no weekly rollover
- 24h cancellation
- 1 cancellation allowance
- 6h reminder
- package status
- payment/debt status
- attendance/no-show history
- install guidance
- push notifications

## Admin

- dashboard
- day/week calendar
- drag-and-drop reschedule
- right-click menus
- internal cut/paste
- Ctrl/Cmd+X / Ctrl/Cmd+V
- manual appointment
- close/open slot
- attendance
- no-show
- member management
- package management
- manual payment
- debt tracking
- password reset
- rule override + reason
- audit log
- backup health

## Platform

- real server database
- transactions
- role authorization
- migrations
- DB backup
- Google Sheets mirror
- retry/outbox sync
- daily CSV snapshot
- notification log

---

# 31. v1.1 — SHOULD

- waitlist
- preferred member training times
- "gelecek hafta aynı saati bul"
- CSV export on demand
- package expiry reminders
- overdue reminders
- staff/trainer role
- bulk attendance
- member tags
- richer operational reports

---

# 32. Later / Not Now

Do NOT expand v1 into a generic fitness super-app.

Later:

- online payment gateway
- nutrition
- body measurement tracking
- workout programming
- advanced gamification
- referrals
- multi-location
- trainer payroll
- native Flutter app if later chosen

---

# 33. Current Known Legacy Conflicts

Existing v0.2 / demo assumptions may include:

- phone + OTP login
- light UI + Orbitron app UI
- localStorage data
- 4h cancellation suggestion
- package/payment out of v1
- orange admin approval flow
- partner/couple booking
- demo admin accessible from member UI

These are NOT automatically authoritative anymore.

Claude must identify all conflicts before editing.

---

# 34. Open Decisions Before Implementation

Do not invent answers.

1. Package period:
   - calendar month
   - or fixed 28-day / 4-week cycle

2. Week definition:
   - Monday-Sunday
   - or package-based 7-day buckets

3. Valid member cancellation returns entitlement?
   - recommended YES

4. Second self-cancellation in same package period:
   - recommended blocked, admin override only

5. Overdue payment blocks booking?
   - configurable recommended

6. Booking horizon:
   - recommended 14 days

7. How close to session start can a new booking be created?

8. Fitness booking/package rules:
   - define before production

9. Does partner/couple session remain in v1?

10. Does orange admin approval flow remain?

11. Automatic no-show penalty?
   - recommended no in v1

12. Force password change on first login?
   - recommended yes

13. Username format?
   - member no or custom

---

# 35. Engineering Protocol for Claude Code

Claude Code is the implementation engine, not the product owner.

Every phase:

1. Read this document first.
2. Inspect current code.
3. Compare current behavior with spec.
4. List impacted files.
5. List risks.
6. Make implementation plan.
7. Ask before destructive changes.
8. Do not production deploy unless explicitly asked.
9. Do not silently change business rules.
10. Add tests for business rule changes.
11. Report changed files and test results.
12. Keep source control recoverable.

If Higgsfield is available:
- use only in approved design phase
- inspect MCP capabilities first
- do not change source code based on an unapproved visual generation

---

# 36. Source Control Recovery Priority

Known risk:

Live Vercel production may contain `/uygulama` files not present in GitHub main.

FIRST priority before feature development:

- identify local production-equivalent PWA source
- compare against GitHub
- preserve all production files
- get source of truth under version control
- create a baseline commit/branch

Do NOT overwrite production source with older GitHub state.

---

# 37. Recommended Implementation Phases

## Phase 0 — Audit & Source Recovery

NO feature coding.

- git audit
- project tree
- local vs GitHub
- production source comparison
- architecture review
- spec gap analysis
- backup plan
- open decisions
- proposed branch strategy

## Phase 1 — Rule & Domain Model

- package entitlement
- cancellation
- attendance
- manual payments
- audit events
- unit tests

## Phase 2 — Backend

- database
- migrations
- auth
- roles
- APIs
- booking transactions
- outbox

## Phase 3 — Member Design & PWA

- Higgsfield MCP design exploration
- design system
- dark-first app shell
- home
- booking calendar
- appointments
- profile/package/payment
- accessibility
- iOS safe areas

## Phase 4 — Admin Calendar

- day/week
- appointment chips
- drag/drop
- context menu
- internal clipboard
- keyboard shortcuts
- manual booking
- reschedule notification

## Phase 5 — Studio Operations

- members
- package admin
- manual payments
- debt
- attendance
- no-show
- password reset
- audit viewer

## Phase 6 — Notifications & Sync

- push subscription
- 6h reminder
- transactional messages
- notification log
- Google Sheets outbox mirror
- retry
- daily CSV backup

## Phase 7 — QA

- concurrency
- capacity
- package quota
- week boundaries
- cancellation
- payment/debt
- keyboard shortcuts
- drag/drop
- PWA install
- iOS
- Android
- desktop admin
- backup/sync failure
- accessibility
- offline

---

# 38. Acceptance Principles

Member:

> Booking should feel possible in roughly 15 seconds, not like filling out a management form.

Admin:

> The studio's day/week should be understandable at a glance.

Calendar:

> Moving an appointment should feel as easy as dragging it or cut/pasting it.

Data:

> Every entitlement, payment, cancellation, attendance and admin override must be explainable from logs.

Reliability:

> Google Sheets can fail without breaking Orka. The database remains authoritative.

Design:

> Premium, modern and minimal beats visually busy or technically impressive.

