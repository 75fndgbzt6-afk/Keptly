# Renewly — Build Spec & Phased Plan

## 1. Product in one line
The household command center for recurring life admin: store everything, get reminded before deadlines, see usage-vs-cost, and act on clear savings suggestions. The experience must feel simple, calm, and trustworthy — appealing to non-technical people, not just power users.

## 2. Tech stack (decided — build with these)

- Framework: Expo (React Native) + TypeScript
- Navigation: `expo-router` (file-based)
- State: `zustand` (minimal, no boilerplate)
- Local database (MVP, no backend): `expo-sqlite` with a thin typed data-access layer
- Reminders: `expo-notifications` (on-device local scheduled notifications)
- Security: `expo-local-authentication` (biometric/PIN lock) + `expo-secure-store`
- Files: `expo-image-picker` + `expo-file-system`
- Styling: custom design-token system with `StyleSheet` (no heavy UI kit)
- Charts: `react-native-svg` (simple hand-built bars/rings)
- Icons: `@expo/vector-icons`. Fonts: Inter via `@expo-google-fonts/inter`

## 3. Design language

- Whitespace first. Generous padding, 8-pt spacing scale (4/8/12/16/24/32).
- Restrained palette. Off-white background (#F7F6F3), near-black text (#1C1B18), one accent (#4F46E5), plus green/amber/red for urgency.
- One typeface (Inter). Hierarchy via size and weight, not color. ~4 text sizes.
- Soft, simple surfaces. Rounded cards (12–16px radius), a single hairline border or subtle shadow — not both.
- Thumb-friendly. Large tap targets (≥44px), primary actions at the bottom, bottom tab bar with 4 tabs.
- One screen that matters. Home answers "what do I owe, what's due, is it worth it?" at a glance.
- Calm motion. Subtle transitions only. Friendly empty states.
- Accessibility: strong contrast, scalable text, clear labels.
- Light mode first, dark mode as a later phase.

## 4. Information architecture

Bottom tab bar (4 tabs) + a prominent center "+" Add button:

- **Home** — spend summary, what's due soon, alerts, savings figure
- **Items** — searchable, filterable list (category chips)
- **Calendar** — month view of renewals, due dates, expiries
- **Insights** — spend-by-category, value leaderboard, recommendations

Settings lives in the Home header. Add-Item opens as a modal from the center button.

## 5. Core data model (SQLite tables)

- **items** — id, name, category, holderName, paymentMethodId, amount, currency, billingCycle (`weekly|monthly|quarterly|yearly|one_time|variable`), startDate, nextDate, autoRenew, isFreeTrial, trialEndDate, status (`active|paused|cancelled|expired`), intentFlag (`more|less|neutral`), notes, attachmentUri, plus category-specific JSON fields.
- **payment_methods** — id, label, type (`card|upi|netbanking|wallet|cash`), last4, holderName.
- **usage_logs** — id, itemId, date, value, source (`auto|manual`).
- **reminders** — id, itemId, triggerDate, leadTimeDays, type, status, notificationId.
- **recommendations** — id, itemId, type, reason, estimatedSavings, status.

## 6. Categories & category-specific fields

Categories: `Streaming/OTT · Music · AI tools · Cloud/Software · Gym/Fitness · Utilities · Telecom · Insurance · Warranty · Government document · Membership · Other`

- **Warranty**: product, brand, purchaseDate, warrantyMonths → auto expiry, receipt scan.
- **Government document**: docType, issuingAuthority, masked idNumber, issueDate, expiryDate, scan.
- **Utilities/Telecom**: biller, accountNumber, variable amount, dueDate.
- **Insurance**: provider, policyNumber, premium, coverageEndDate, renewalDate.

## 7. Feature detail

- Add/edit any item in under a minute via a dynamic form revealing only the fields its category needs.
- Smart reminders: configurable lead times per item/category (default 30/14/7/1 days; documents 90/30/7).
- Usage tracking — three models: digital (screen time / one-tap log), physical check-in, consumption units.
- Value engine: cost-per-use, utilization score + trend per item.
- Intent flag: `Want less` / `Want more` / `Neutral` drives nudge direction.
- Money dashboard: monthly/yearly totals, upcoming renewals, savings figure.
- Recommendations: cancel candidates, duplicates, trial-ending warnings, cycle optimization.
- Document vault: secured section for IDs/docs, locked behind biometric/PIN.

## 8. Privacy & security (non-negotiable)

- Biometric/PIN lock to open the app; extra lock on the Document Vault.
- Encrypt sensitive values at rest (`expo-secure-store`).
- Never store full card numbers, CVVs, or full government ID numbers.
- Clear export and delete-all-data options.

## 9. Phased build plan

**Phase 0 — Scaffold & design system** ✅
Init Expo + TS with expo-router; install core deps; create theme tokens; build base components (Screen, Card, AppText, Button, Input, Badge, EmptyState); 4-tab bottom navigation shell with center "+" button.
Checkpoint: app runs on device/simulator, tabs navigate, tokens and base components render.

**Phase 1 — Data layer & item CRUD**
SQLite schema + typed data-access layer; zustand store; dynamic Add/Edit Item form; Items list (search + chips); Item Detail screen; auto-calc nextDate.
Checkpoint: add/edit/delete items of every category; persist and list correctly.

**Phase 2 — Reminders & calendar**
expo-notifications + permissions; schedule local notifications; Notifications Center; Calendar month view; quick actions on notifications.
Checkpoint: a scheduled reminder fires; calendar shows upcoming dates.

**Phase 3 — Usage tracking & value engine**
Three usage-logging UIs; intent flag; cost-per-use, utilization score + trend; SVG chart on Item Detail.
Checkpoint: log usage three ways; cost-per-use and utilization appear correctly.

**Phase 4 — Money dashboard & recommendations**
Home dashboard (totals, upcoming, alerts, savings); spend-by-category + value leaderboard; recommendation engine.
Checkpoint: dashboard numbers accurate; at least one real recommendation shows.

**Phase 5 — Security & document vault**
Biometric/PIN app lock; secure storage + masking; Document Vault (scan capture, expiry reminders, locked access).
Checkpoint: app locks on launch; vault is protected; card/ID numbers are masked.

**Phase 6 — Polish**
Onboarding flow, settings screen, refined empty/loading/error states, app icon + splash, accessibility pass, optional dark mode.
Checkpoint: the app feels finished and ships-ready.

## 10. Conventions

- Small, focused components; centralize all design tokens in `constants/theme.ts`.
- Strict TypeScript types for the data model and store.
- Business logic (date math, cost-per-use, recommendations) in pure, testable helper functions.
- Commit at each phase checkpoint with a clear message.
- Prefer the standard Expo libraries listed in §2 over alternatives.
