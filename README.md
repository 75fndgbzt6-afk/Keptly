# Renewly

A calm, minimal cross-platform app for tracking subscriptions, bills, warranties,
and government documents — with reminders, a calendar, and (later) usage-vs-cost
insights. Local-first: all data lives on-device in SQLite. See `SPEC.md` for the
full product spec and `CLAUDE.md` for engineering conventions.

## Run

```bash
npm install
npm start        # Expo dev server
npm run ios      # iOS simulator
npm run android  # Android emulator/device
```

## Reminders: what works where

Renewly schedules **on-device local notifications** (no server, no push tokens).
Behavior differs by how you run the app:

| Capability | Expo Go (iOS) | Expo Go (Android) | Dev build / standalone |
| --- | --- | --- | --- |
| Scheduled local notifications fire | ✅ | ✅ | ✅ |
| Permission prompt + Home banner | ✅ | ✅ | ✅ |
| Rich action buttons (Mark done / Snooze / Open) | ⚠️ may not show | ✅ | ✅ |
| Tap-to-open routing to item | ✅ | ✅ | ✅ |

- **iOS notification cap:** the OS keeps at most **64** pending local
  notifications. We schedule the soonest ~60 days of reminders and re-extend the
  window on every launch (`reconcile()` in `services/notifications.ts`). Every
  reminder is still persisted to the `reminders` table, so the Notifications
  Center stays complete even when OS scheduling is capped or permission is off.
- **Notification action categories** (the quick-action buttons) register reliably
  in a dev/standalone build. In Expo Go on iOS they may not appear — build a dev
  client to verify them end-to-end.
- **Testing:** open any item's detail screen and use **"Test reminder in 10s"**
  (visible in dev builds only) to fire a sample notification.

All notification scheduling/cancellation goes through `services/notifications.ts`;
components never call `expo-notifications` directly.
