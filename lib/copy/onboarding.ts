// Centralized onboarding copy (lib/copy/*). No inline English strings in the
// onboarding flow — all user-facing text lives here.
export const ONBOARDING_COPY = {
  skip: 'Skip',
  back: 'Back',
  next: 'Next',

  welcome: {
    title: 'Welcome to Renewly',
    body: 'The calm home for your subscriptions, bills, warranties, and documents — all on your device.',
    cta: 'Get started',
  },

  features: {
    title: 'What Renewly does',
    cta: 'Continue',
    cards: [
      {
        icon: 'albums-outline',
        title: 'Everything in one place',
        body: 'Track every subscription, bill, warranty, and ID together — no more scattered notes.',
      },
      {
        icon: 'notifications-outline',
        title: 'Never miss a renewal',
        body: 'Gentle reminders before charges, trials, and expiries — entirely on-device.',
      },
      {
        icon: 'trending-down-outline',
        title: "See what's worth keeping",
        body: 'Cost-per-use and savings tips help you cut what you don’t really use.',
      },
    ] as const,
  },

  currency: {
    title: 'Pick your currency',
    body: 'We’ll use this for amounts across the app. You can change it later in Settings.',
    cta: 'Continue',
  },

  notifications: {
    title: 'Stay ahead of deadlines',
    body: 'Allow reminders so nothing slips through. They stay on your device — we never send anything anywhere.',
    allow: 'Allow reminders',
    later: 'Maybe later',
  },

  security: {
    title: 'Lock it down',
    body: 'Add a Face ID / passcode lock to open Renewly and your document vault. You can change this anytime in Settings.',
    enable: 'Enable app lock',
    later: 'Not now',
  },

  done: {
    title: 'You’re all set',
    body: 'Add your first item and Renewly takes it from there.',
    cta: 'Add your first item',
    finish: 'Go to Renewly',
  },
} as const;
