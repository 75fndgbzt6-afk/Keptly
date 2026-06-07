import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { AppText } from '@/components/ui';

interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export function ToggleField({ label, value, onChange, hint }: ToggleFieldProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <AppText weight="medium">{label}</AppText>
        {hint ? (
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
        thumbColor={theme.colors.surface}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.base,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
});
