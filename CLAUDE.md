# Renewly — Project Context

A clean, minimal cross-platform mobile app (mass-market audience) for tracking
subscriptions, bills, warranties, and government documents — with reminders,
usage-vs-cost tracking, and savings recommendations. Full spec in ./SPEC.md.

## Stack
- Expo (React Native) + TypeScript, expo-router, zustand
- Local-first: expo-sqlite (no backend for MVP)
- Reminders: expo-notifications (on-device local notifications)
- Security: expo-local-authentication + expo-secure-store
- Files: expo-image-picker + expo-file-system
- Styling: custom design tokens + StyleSheet (no heavy UI kit)
- Charts: react-native-svg. Fonts: Inter. Icons: @expo/vector-icons

## Design rules (do not violate)
- Whitespace-first, 8pt spacing scale, one accent color (#4F46E5) + green/amber/red for urgency
- One typeface (Inter); hierarchy via size/weight, not color
- Soft rounded cards (radius 12–16), max 4 bottom tabs, large tap targets (≥44px), light mode first
- Calm and simple — appeals to non-technical users
- All tokens live in constants/theme.ts — never hard-code colors or spacing

## Security rules (do not violate)
- Never store full card numbers, CVVs, or full government ID numbers
- Encrypt sensitive values with expo-secure-store; lock the app + document vault behind biometric/PIN

## Architecture
- `constants/theme.ts` — all design tokens (colors, spacing, fontSize, radius, shadow)
- `components/ui/` — Screen, Card, AppText, Button, Input, Badge, EmptyState + barrel index.ts
- `components/navigation/CustomTabBar.tsx` — custom 4-tab bar with floating center "+" button
- `app/_layout.tsx` — root Stack, font loading (Inter), splash screen
- `app/(tabs)/` — Home, Items, Calendar, Insights screens
- `app/(modal)/` — Add-item and future modals

## How we work
- Build one phase at a time (see SPEC.md §9). Run, review, commit, then continue.
- Keep components small; centralize design tokens; business logic in pure helpers.
- Use `@/` path alias for all imports from project root.

## Commands
- Start: `npm start` or `npx expo start`
- iOS simulator: `npm run ios`
- Android: `npm run android`
