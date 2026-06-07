import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  canAuthenticate,
  requireUnlock,
  markUnlocked,
  isExpired,
} from '@/services/app-lock';
import { useSecurityStore } from '@/stores/securityStore';
import { PERMISSION_COPY } from '@/lib/permission-copy';
import { LockScreen } from './LockScreen';

interface AppLockValue {
  locked: boolean;
  /** Lock immediately (e.g. user taps "Lock now"). */
  lockNow: () => void;
  /** Prompt to unlock; resolves true on success. */
  unlock: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockValue>({
  locked: false,
  lockNow: () => {},
  unlock: async () => true,
});

export function useAppLock(): AppLockValue {
  return useContext(AppLockContext);
}

/**
 * Gates the entire app behind a biometric/passcode lock. On launch (and on
 * returning to the foreground after the inactivity window) it shows a full-screen
 * cover until the user authenticates. When the device has no enrolled auth, or the
 * lock is disabled in Settings, it stays open.
 */
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const unlock = useCallback(async (): Promise<boolean> => {
    const ok = await requireUnlock(PERMISSION_COPY.appLock.title);
    if (ok) {
      await markUnlocked();
      setLocked(false);
    }
    return ok;
  }, []);

  const lockNow = useCallback(() => setLocked(true), []);

  // Decide the initial lock state once settings + device capability are known.
  useEffect(() => {
    let active = true;
    (async () => {
      await useSecurityStore.getState().refresh();
      const { appLockEnabled } = useSecurityStore.getState();
      const enforceable = appLockEnabled && (await canAuthenticate());
      if (!active) return;
      if (enforceable) {
        setLocked(true);
      } else {
        await markUnlocked();
        setLocked(false);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Stamp the time we leave; re-lock on return if the inactivity window elapsed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;
      const { appLockEnabled, inactivityTimeoutMin } = useSecurityStore.getState();

      if (next === 'active' && /inactive|background/.test(prev)) {
        if (!appLockEnabled) return;
        if (!(await canAuthenticate())) return;
        if (await isExpired(inactivityTimeoutMin * 60_000)) setLocked(true);
      } else if (next === 'background' || next === 'inactive') {
        await markUnlocked();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AppLockContext.Provider value={{ locked, lockNow, unlock }}>
      {children}
      {!ready ? (
        <LockScreen mode="loading" onUnlock={unlock} />
      ) : locked ? (
        <LockScreen mode="locked" onUnlock={unlock} />
      ) : null}
    </AppLockContext.Provider>
  );
}
