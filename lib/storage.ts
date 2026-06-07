// Small persistent key/value flags backed by expo-secure-store.
// Used for non-sensitive UX state (e.g. "have we shown the notifications pre-prompt").
import * as SecureStore from 'expo-secure-store';

const ASKED_KEY = 'renewly.notifications.asked';

export async function getNotificationsAsked(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ASKED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setNotificationsAsked(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(ASKED_KEY, value ? '1' : '0');
  } catch {
    // best-effort; ignore storage failures
  }
}
