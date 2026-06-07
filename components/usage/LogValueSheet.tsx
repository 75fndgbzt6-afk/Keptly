import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { AppText, Button, Input } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface LogValueSheetProps {
  visible: boolean;
  title: string;
  valueLabel: string;
  valuePlaceholder?: string;
  /** When set, a unit field is shown, prefilled with this value. */
  defaultUnit?: string;
  onClose: () => void;
  onSubmit: (value: number, unit?: string) => void;
}

/** A small bottom sheet for entering a numeric usage value (+ optional unit). */
export function LogValueSheet({
  visible,
  title,
  valueLabel,
  valuePlaceholder,
  defaultUnit,
  onClose,
  onSubmit,
}: LogValueSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(defaultUnit ?? '');

  useEffect(() => {
    if (visible) {
      setValue('');
      setUnit(defaultUnit ?? '');
    }
  }, [visible, defaultUnit]);

  const parsed = Number.parseFloat(value);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit(parsed, defaultUnit !== undefined ? unit.trim() : undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText size="lg" weight="semibold" style={styles.title}>
            {title}
          </AppText>

          <Input
            label={valueLabel}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={valuePlaceholder}
            autoFocus
          />

          {defaultUnit !== undefined ? (
            <Input label="Unit" value={unit} onChangeText={setUnit} autoCapitalize="none" />
          ) : null}

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={styles.flex1} />
            <Button label="Save" onPress={submit} disabled={!valid} style={styles.flex1} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  title: {
    marginBottom: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
