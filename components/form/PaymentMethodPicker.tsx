import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Button, Input } from '@/components/ui';
import { SelectField } from './SelectField';
import { PaymentMethod, PaymentMethodType } from '@/types';
import { PAYMENT_TYPE_OPTIONS, PAYMENT_TYPE_LABELS, sanitizeLast4 } from '@/lib/options';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';
import { createPaymentMethod } from '@/db/paymentMethods';

interface PaymentMethodPickerProps {
  label?: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

function methodSummary(m: PaymentMethod): string {
  const typeLabel = PAYMENT_TYPE_LABELS[m.type];
  return m.last4 ? `${typeLabel} •••• ${m.last4}` : typeLabel;
}

export function PaymentMethodPicker({
  label = 'Payment method',
  value,
  onChange,
}: PaymentMethodPickerProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const methods = usePaymentMethodsStore((s) => s.methods);
  const refresh = usePaymentMethodsStore((s) => s.refresh);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<PaymentMethodType>('card');
  const [newLast4, setNewLast4] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = methods.find((m) => m.id === value) ?? null;

  const resetAddForm = () => {
    setAdding(false);
    setNewLabel('');
    setNewType('card');
    setNewLast4('');
  };

  const handleSaveNew = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const created = await createPaymentMethod({
      label: newLabel.trim(),
      type: newType,
      last4: newLast4 ? newLast4 : null,
      holderName: null,
    });
    await refresh();
    setSaving(false);
    onChange(created.id);
    resetAddForm();
    setPickerOpen(false);
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
        onPress={() => setPickerOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <AppText color={selected ? theme.colors.text.primary : theme.colors.text.tertiary}>
          {selected ? `${selected.label} · ${methodSummary(selected)}` : 'None'}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={theme.colors.text.tertiary} />
      </TouchableOpacity>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            resetAddForm();
            setPickerOpen(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <AppText size="lg" weight="semibold" style={styles.sheetTitle}>
              Payment method
            </AppText>

            {!adding ? (
              <ScrollView style={styles.list}>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onChange(null);
                    setPickerOpen(false);
                  }}
                >
                  <AppText color={theme.colors.text.secondary}>None</AppText>
                  {value === null ? (
                    <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                  ) : null}
                </TouchableOpacity>

                {methods.map((m) => {
                  const isSelected = m.id === value;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.optionRow}
                      onPress={() => {
                        onChange(m.id);
                        setPickerOpen(false);
                      }}
                    >
                      <View>
                        <AppText
                          weight={isSelected ? 'semibold' : 'regular'}
                          color={isSelected ? theme.colors.accent : theme.colors.text.primary}
                        >
                          {m.label}
                        </AppText>
                        <AppText size="xs" color={theme.colors.text.tertiary}>
                          {methodSummary(m)}
                        </AppText>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}

                <Button
                  label="+ Add new method"
                  variant="secondary"
                  onPress={() => setAdding(true)}
                  style={styles.addButton}
                />
              </ScrollView>
            ) : (
              <View style={styles.addForm}>
                <Input
                  label="Label"
                  placeholder="e.g. HDFC Credit Card"
                  value={newLabel}
                  onChangeText={setNewLabel}
                />
                <SelectField<PaymentMethodType>
                  label="Type"
                  value={newType}
                  options={PAYMENT_TYPE_OPTIONS}
                  onChange={setNewType}
                />
                <Input
                  label="Last 4 digits (optional)"
                  placeholder="1234"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={newLast4}
                  onChangeText={(t) => setNewLast4(sanitizeLast4(t))}
                  hint="Never enter the full card number or CVV."
                />
                <View style={styles.addActions}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={resetAddForm}
                    style={styles.flex1}
                  />
                  <Button
                    label="Save"
                    onPress={handleSaveNew}
                    loading={saving}
                    disabled={!newLabel.trim()}
                    style={styles.flex1}
                  />
                </View>
              </View>
            )}
          </TouchableOpacity>
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
    maxHeight: '70%',
  },
  sheetTitle: {
    marginBottom: theme.spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  addButton: {
    marginTop: theme.spacing.base,
  },
  addForm: {
    gap: theme.spacing.md,
  },
  addActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
