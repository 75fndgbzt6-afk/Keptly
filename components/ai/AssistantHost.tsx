import React, { useState } from 'react';
import { TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AI_COPY } from '@/lib/copy/ai';
import { useAiStore } from '@/stores/aiStore';
import { AssistantSheet } from './AssistantSheet';

/**
 * Persistent bottom-left AI button (above the tab bar, clear of the center "+").
 * Tapping opens the assistant sheet, or — when AI is off — an enable prompt.
 */
export function AssistantHost() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enabled = useAiStore((s) => s.enabled);
  const [open, setOpen] = useState(false);

  const onPress = () => {
    if (enabled) {
      setOpen(true);
      return;
    }
    Alert.alert(AI_COPY.enablePrompt.title, AI_COPY.enablePrompt.body, [
      { text: AI_COPY.enablePrompt.cancel, style: 'cancel' },
      { text: AI_COPY.enablePrompt.cta, onPress: () => router.push('/settings') },
    ]);
  };

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.button, { bottom: insets.bottom + 74 }]}
        accessibilityRole="button"
        accessibilityLabel="AI assistant"
      >
        <Ionicons name="sparkles" size={24} color={theme.colors.text.inverse} />
      </TouchableOpacity>
      <AssistantSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      left: theme.spacing.base,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 50,
    },
  });
