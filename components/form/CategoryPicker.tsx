import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Input } from '@/components/ui';
import { CATEGORIES, iconForCategory } from '@/lib/category';

const OTHER = 'Other';

interface CategoryPickerProps {
  label?: string;
  value: string;
  onChange: (category: string) => void;
  /** Saved custom categories, shown as reusable tiles. */
  customCategories: string[];
}

/** Icon-grid category picker. The "Other" tile reveals a free-text custom field. */
export function CategoryPicker({ label, value, onChange, customCategories }: CategoryPickerProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const builtIns = CATEGORIES.filter((c) => c !== OTHER);
  const tiles = [...builtIns, ...customCategories];
  // "Other" is active when the value is the sentinel or a not-yet-saved custom name.
  const isKnown = tiles.includes(value);
  const otherActive = !isKnown;

  const tile = (name: string, icon: React.ComponentProps<typeof Ionicons>['name'], active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={name}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.tile, active && styles.tileActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={name}
    >
      <Ionicons name={icon} size={22} color={active ? theme.colors.accent : theme.colors.text.secondary} />
      <AppText
        size="xs"
        weight={active ? 'semibold' : 'regular'}
        color={active ? theme.colors.accent : theme.colors.text.secondary}
        align="center"
        numberOfLines={1}
      >
        {name}
      </AppText>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label ? (
        <AppText size="sm" weight="medium" color={theme.colors.text.secondary}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.grid}>
        {tiles.map((c) => tile(c, iconForCategory(c), value === c, () => onChange(c)))}
        {tile(OTHER, 'add-circle-outline', otherActive, () => onChange(OTHER))}
      </View>
      {otherActive ? (
        <Input
          placeholder="Custom category name"
          value={value === OTHER ? '' : value}
          onChangeText={(t) => onChange(t.trim() === '' ? OTHER : t)}
          autoCapitalize="words"
          hint="Saved for reuse next time."
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    tile: {
      width: '23%',
      minWidth: 72,
      flexGrow: 1,
      aspectRatio: 1.1,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: 4,
    },
    tileActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentLight,
    },
  });
