// Centralized AI copy (lib/copy/*).
export const AI_COPY = {
  settings: {
    title: 'AI Assist',
    toggle: 'Enable AI Assist',
    subtitle:
      'Add items by typing or speaking, get warmer recommendations, and ask questions about your money. Anonymized data is sent to Anthropic. Free for 200 actions a month.',
    quotaLabel: 'AI actions this month',
    resetDev: 'Reset quota cache',
  },
  enablePrompt: {
    title: 'Enable AI Assist?',
    body: "Turn on AI to add items by voice or text, get warmer recommendations, and ask about your spending. It’s free for 200 actions a month, and only anonymized data is sent.",
    cta: 'Open Settings',
    cancel: 'Not now',
  },
  assistant: {
    title: 'Money assistant',
    scope: 'I can only answer about your tracked subscriptions, bills, and spending.',
    placeholder: 'Ask about your money, or say “add …”',
    quotaExhausted: "You’ve used all 200 free AI actions this month. Resets next month.",
    micHint: 'Voice needs a development build.',
    suggestions: [
      'What can I cancel to save money?',
      'How much do I spend on streaming?',
      "What's renewing this week?",
    ],
    thinking: 'Thinking…',
    addedIntent: "I’ll open the Add form pre-filled — review and save.",
  },
  quickAdd: {
    toggle: 'Quick add with AI',
    textPlaceholder: 'e.g. Netflix 649 a month',
    parse: 'Parse',
    fromPhoto: 'Quick add from photo',
    parsing: 'Reading…',
    filledNote: 'Review the details below, then save.',
  },
  voice: {
    rationaleTitle: 'Use your microphone',
    rationaleBody:
      'Speech is transcribed on your device to fill the text field. No audio is recorded or sent anywhere.',
  },
} as const;
