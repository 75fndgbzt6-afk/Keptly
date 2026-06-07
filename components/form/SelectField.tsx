import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Option } from '@/types';
import { AppText } from '@/components/ui';

interface SelectFieldProps<T extends string> {
  label?: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      {label ? (
        <AppText size="sm" weight="medium" color={theme.colors.text.secondary}>
          {label}
        </AppText>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        style={[styles.field, !!error && styles.fieldError]}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
      >
        <AppText
          color={selected ? theme.colors.text.primary : theme.colors.text.tertiary}
        >
          {selected ? selected.label : placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={theme.colors.text.tertiary} />
      </TouchableOpacity>

      {error ? (
        <AppText size="xs" color={theme.colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            {label ? (
              <AppText size="sm" weight="semibold" color={theme.colors.text.secondary} style={styles.sheetTitle}>
                {label}
              </AppText>
            ) : null}
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <AppText
                      color={isSelected ? theme.colors.accent : theme.colors.text.primary}
                      weight={isSelected ? 'semibold' : 'regular'}
                    >
                      {item.label}
                    </AppText>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  fieldError: {
    borderColor: theme.colors.status.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    maxHeight: '60%',
  },
  sheetTitle: {
    marginBottom: theme.spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
});
