// Plain-language permission rationales, shown BEFORE the OS prompt so people
// understand why we're asking (SPEC §8 — privacy is a feature, not fine print).
export const PERMISSION_COPY = {
  appLock: {
    title: 'Lock Renewly',
    body: 'Use Face ID, Touch ID, or your device passcode to unlock the app. Your data stays on this device — we never upload it.',
  },
  vault: {
    title: 'Unlock your vault',
    body: 'The Document Vault holds your IDs and scans. It asks for Face ID, Touch ID, or your passcode every time you open it.',
  },
  reveal: {
    title: 'Show full number',
    body: 'Confirm it’s you to reveal the full number for a few seconds. It is shown on-screen only and never copied or sent anywhere.',
  },
  scan: {
    title: 'Attach a scan',
    body: 'Photos are stored on-device only and locked behind your biometric — never uploaded. Choose the camera or your photo library.',
  },
} as const;

export type PermissionTopic = keyof typeof PERMISSION_COPY;
