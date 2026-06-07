import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from './AppText';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  hint,
  rightElement,
  containerStyle,
  ...textInputProps
}: InputProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText
          size="sm"
          weight="medium"
          color={theme.colors.text.secondary}
          style={styles.label}
        >
          {label}
        </AppText>
      ) : null}

      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!error && styles.inputRowError,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={theme.colors.text.tertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...textInputProps}
        />
        {rightElement ?? null}
      </View>

      {error ? (
        <AppText size="xs" color={theme.colors.status.danger} style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText size="xs" color={theme.colors.text.tertiary} style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  label: {
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  inputRowFocused: {
    borderColor: theme.colors.accent,
  },
  inputRowError: {
    borderColor: theme.colors.status.danger,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: theme.fontSize.md,
    lineHeight: theme.lineHeight.md,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.md,
  },
  helper: {
    marginTop: 2,
  },
});
