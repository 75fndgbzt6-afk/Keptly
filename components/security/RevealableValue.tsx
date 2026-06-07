import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { requireUnlock } from '@/services/app-lock';

const REVEAL_SECONDS = 30;

interface RevealableValueProps {
  /** Masked display shown when not revealed. */
  masked: string;
  /** Biometric prompt reason. */
  reason: string;
  /** Loads the full value from secure store. Only called after a successful unlock. */
  getFull: () => Promise<string | null>;
  /** When false, the value can't be revealed (no secret stored) — masked only. */
  canReveal?: boolean;
}

/**
 * Shows a masked value with a Reveal button. Revealing requires biometric/passcode
 * (the ONLY path), shows the full value for 30 seconds, then auto-remasks. The
 * revealed value is held in local state only — never logged, copied, or sent.
 */
export function RevealableValue({ masked, reason, getFull, canReveal = true }: RevealableValueProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [full, setFull] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const remask = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setFull(null);
    setSecondsLeft(0);
  }, []);

  useEffect(() => remask, [remask]);

  const reveal = useCallback(async () => {
    const ok = await requireUnlock(reason);
    if (!ok) return;
    const value = await getFull();
    if (!value) return;
    setFull(value);
    setSecondsLeft(REVEAL_SECONDS);
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          remask();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [getFull, reason, remask]);

  const revealed = full !== null;

  return (
    <View style={styles.row}>
      <AppText weight="medium" align="right" style={styles.value}>
        {revealed ? full : masked}
      </AppText>
      {canReveal ? (
        <TouchableOpacity
          onPress={revealed ? remask : reveal}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide full number' : 'Reveal full number'}
          style={styles.action}
          hitSlop={8}
        >
          <Ionicons
            name={revealed ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={theme.colors.accent}
          />
          <AppText size="xs" weight="medium" color={theme.colors.accent}>
            {revealed ? `Hide (${secondsLeft}s)` : 'Reveal'}
          </AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  row: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  value: {
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
