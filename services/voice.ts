// On-device speech-to-text wrapper. Audio never leaves the device — the native
// recognizer returns a transcript string which fills the text field.
//
// The native module (@react-native-voice/voice) is only present in a development
// build, not Expo Go. We lazy-require it and degrade gracefully: when it's absent,
// isVoiceAvailable() is false and the UI shows a "needs a dev build" hint.

interface VoiceResultEvent {
  value?: string[];
}
interface VoiceErrorEvent {
  error?: { message?: string };
}
interface VoiceModule {
  isAvailable(): Promise<number | boolean>;
  start(locale: string): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  removeAllListeners(): void;
  onSpeechResults?: (e: VoiceResultEvent) => void;
  onSpeechPartialResults?: (e: VoiceResultEvent) => void;
  onSpeechError?: (e: VoiceErrorEvent) => void;
  onSpeechEnd?: () => void;
}

let cached: VoiceModule | null | undefined;

function loadVoice(): VoiceModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-voice/voice') as { default: VoiceModule };
    cached = mod.default ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function isVoiceAvailable(): Promise<boolean> {
  const v = loadVoice();
  if (!v) return false;
  try {
    return !!(await v.isAvailable());
  } catch {
    return false;
  }
}

export interface VoiceHandlers {
  onPartial?: (text: string) => void;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

/** Begin listening. Returns false if voice isn't available (Expo Go / no permission). */
export async function startVoice(handlers: VoiceHandlers): Promise<boolean> {
  const v = loadVoice();
  if (!v) return false;
  v.onSpeechPartialResults = (e) => handlers.onPartial?.(e.value?.[0] ?? '');
  v.onSpeechResults = (e) => handlers.onResult(e.value?.[0] ?? '');
  v.onSpeechError = (e) => handlers.onError?.(e.error?.message ?? 'Voice error');
  v.onSpeechEnd = () => handlers.onEnd?.();
  try {
    await v.start('en-US');
    return true;
  } catch {
    return false;
  }
}

export async function stopVoice(): Promise<void> {
  const v = loadVoice();
  if (!v) return;
  try {
    await v.stop();
  } catch {
    // ignore
  }
}

export async function destroyVoice(): Promise<void> {
  const v = loadVoice();
  if (!v) return;
  try {
    await v.destroy();
    v.removeAllListeners();
  } catch {
    // ignore
  }
}
