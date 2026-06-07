import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Button } from '@/components/ui';
import { formatDate, fromISODate, toISODate } from '@/lib/date';

interface DateFieldProps {
  label?: string;
  value: string | null; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
}: DateFieldProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState<Date>(value ? fromISODate(value) : new Date());

  const open = () => {
    setTemp(value ? fromISODate(value) : new Date());
    setShow(true);
  };

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (event.type === 'set' && selected) {
      onChange(toISODate(selected));
    }
  };

  return (
    <View style={styles.container}>
      {label ? (
        <AppText size="sm" weight="medium" color={theme.colors.text.secondary}>
          {label}
        </AppText>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={open}
        style={[styles.field, !!error && styles.fieldError]}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
      >
        <AppText color={value ? theme.colors.text.primary : theme.colors.text.tertiary}>
          {value ? formatDate(value) : placeholder}
        </AppText>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.text.tertiary} />
      </TouchableOpacity>

      {error ? (
        <AppText size="xs" color={theme.colors.status.danger}>
          {error}
        </AppText>
      ) : null}

      {Platform.OS === 'android' && show ? (
        <DateTimePicker value={temp} mode="date" onChange={onAndroidChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <View style={styles.sheet}>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                onChange={(_e, selected) => selected && setTemp(selected)}
              />
              <Button
                label="Done"
                onPress={() => {
                  onChange(toISODate(temp));
                  setShow(false);
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
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
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
});
