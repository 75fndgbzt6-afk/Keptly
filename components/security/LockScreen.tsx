import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Button } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface LockScreenProps {
  /** 'loading' = determining lock state (no prompt); 'locked' = blocked, offer unlock. */
  mode: 'loading' | 'locked';
  onUnlock: () => void;
}

/**
 * Full-screen opaque cover that blocks everything beneath it. In 'locked' mode it
 * auto-prompts for authentication once on mount and offers a manual retry button.
 */
export function LockScreen({ mode, onUnlock }: LockScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const prompted = useRef(false);

  useEffect(() => {
    if (mode === 'locked' && !prompted.current) {
      prompted.current = true;
      onUnlock();
    }
  }, [mode, onUnlock]);

  return (
    <View style={styles.overlay}>
      <View style={styles.iconRing}>
        <Ionicons name="lock-closed" size={40} color={theme.colors.accent} />
      </View>
      <AppText size="xl" weight="bold" align="center">
        Renewly is locked
      </AppText>
      {mode === 'locked' ? (
        <>
          <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.sub}>
            Unlock with Face ID, Touch ID, or your device passcode to continue.
          </AppText>
          <Button label="Unlock" onPress={onUnlock} size="lg" style={styles.button} />
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
    zIndex: 1000,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  sub: {
    maxWidth: 300,
  },
  button: {
    marginTop: theme.spacing.md,
    minWidth: 200,
  },
});
