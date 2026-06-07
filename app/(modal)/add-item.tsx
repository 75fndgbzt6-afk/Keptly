import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Button, Input } from '@/components/ui';
import { SelectField, DateField, ToggleField, PaymentMethodPicker } from '@/components/form';
import { theme } from '@/constants/theme';
import {
  BillingCycle,
  Category,
  DocumentDetails,
  InsuranceDetails,
  IntentFlag,
  ItemDetails,
  ItemStatus,
  Option,
  UtilityDetails,
  WarrantyDetails,
} from '@/types';
import { CATEGORIES, emptyDetailsFor } from '@/lib/category';
import {
  BILLING_CYCLE_OPTIONS,
  INTENT_OPTIONS,
  STATUS_OPTIONS,
  DOC_TYPES,
  maskIdNumber,
} from '@/lib/options';
import { todayISO } from '@/lib/date';
import { createItem, getItem, updateItem } from '@/db/items';
import { useItemsStore } from '@/stores/itemsStore';

const CATEGORY_OPTIONS: Option<Category>[] = CATEGORIES.map((c) => ({ label: c, value: c }));
const DOC_TYPE_OPTIONS: Option<string>[] = DOC_TYPES.map((d) => ({ label: d, value: d }));

interface FormState {
  name: string;
  category: Category;
  holderName: string;
  paymentMethodId: string | null;
  amount: string;
  billingCycle: BillingCycle;
  startDate: string;
  autoRenew: boolean;
  isFreeTrial: boolean;
  trialEndDate: string | null;
  status: ItemStatus;
  intentFlag: IntentFlag;
  notes: string;
  details: ItemDetails;
}

function initialForm(): FormState {
  const category: Category = 'Streaming/OTT';
  return {
    name: '',
    category,
    holderName: '',
    paymentMethodId: null,
    amount: '',
    billingCycle: 'monthly',
    startDate: todayISO(),
    autoRenew: true,
    isFreeTrial: false,
    trialEndDate: null,
    status: 'active',
    intentFlag: 'neutral',
    notes: '',
    details: emptyDetailsFor(category),
  };
}

type Errors = Partial<Record<'name' | 'amount' | 'trialEndDate', string>>;

export default function AddEditItemModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const refresh = useItemsStore((s) => s.refresh);

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const item = await getItem(id);
      if (!active || !item) {
        setLoading(false);
        return;
      }
      setForm({
        name: item.name,
        category: item.category,
        holderName: item.holderName ?? '',
        paymentMethodId: item.paymentMethodId,
        amount: item.amount === null ? '' : String(item.amount),
        billingCycle: item.billingCycle,
        startDate: item.startDate,
        autoRenew: item.autoRenew,
        isFreeTrial: item.isFreeTrial,
        trialEndDate: item.trialEndDate,
        status: item.status,
        intentFlag: item.intentFlag,
        notes: item.notes ?? '',
        details: item.details,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onCategoryChange = (category: Category) =>
    setForm((prev) => ({ ...prev, category, details: emptyDetailsFor(category) }));

  // Type-safe detail setters (only used when details.kind matches).
  const setWarranty = (patch: Partial<Omit<WarrantyDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as WarrantyDetails), ...patch } }));
  const setDocument = (patch: Partial<Omit<DocumentDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as DocumentDetails), ...patch } }));
  const setUtility = (patch: Partial<Omit<UtilityDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as UtilityDetails), ...patch } }));
  const setInsurance = (patch: Partial<Omit<InsuranceDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as InsuranceDetails), ...patch } }));

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.amount.trim()) {
      const n = Number(form.amount);
      if (Number.isNaN(n) || n < 0) next.amount = 'Enter a valid amount';
    }
    if (form.isFreeTrial && !form.trialEndDate) {
      next.trialEndDate = 'Set the trial end date';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const amountValue = form.amount.trim() === '' ? null : Number(form.amount);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      holderName: form.holderName.trim() || null,
      paymentMethodId: form.paymentMethodId,
      amount: amountValue,
      currency: 'INR',
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      autoRenew: form.autoRenew,
      isFreeTrial: form.isFreeTrial,
      trialEndDate: form.isFreeTrial ? form.trialEndDate : null,
      status: form.status,
      intentFlag: form.intentFlag,
      notes: form.notes.trim() || null,
      attachmentUri: null,
      details: form.details,
    };

    if (isEdit && id) {
      await updateItem(id, payload);
    } else {
      await createItem(payload);
    }
    await refresh();
    setSaving(false);
    router.back();
  };

  if (loading) {
    return (
      <Screen padded={false} edges={[]}>
        <ModalHeader title="Edit Item" onClose={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]} scroll>
      <ModalHeader title={isEdit ? 'Edit Item' : 'Add Item'} onClose={() => router.back()} />

      <View style={styles.body}>
        <Section title="Basics">
          <Input
            label="Name"
            placeholder="e.g. Netflix"
            value={form.name}
            onChangeText={(t) => update('name', t)}
            error={errors.name}
          />
          <SelectField<Category>
            label="Category"
            value={form.category}
            options={CATEGORY_OPTIONS}
            onChange={onCategoryChange}
          />
          <Input
            label="Account holder (optional)"
            placeholder="Whose account is this?"
            value={form.holderName}
            onChangeText={(t) => update('holderName', t)}
          />
        </Section>

        <Section title="Billing">
          <Input
            label="Amount (₹)"
            placeholder="0"
            keyboardType="decimal-pad"
            value={form.amount}
            onChangeText={(t) => update('amount', t)}
            error={errors.amount}
          />
          <SelectField<BillingCycle>
            label="Billing cycle"
            value={form.billingCycle}
            options={BILLING_CYCLE_OPTIONS}
            onChange={(v) => update('billingCycle', v)}
          />
          <DateField
            label="Start date"
            value={form.startDate}
            onChange={(iso) => update('startDate', iso)}
          />
          <PaymentMethodPicker
            value={form.paymentMethodId}
            onChange={(v) => update('paymentMethodId', v)}
          />
          <ToggleField
            label="Auto-renews"
            value={form.autoRenew}
            onChange={(v) => update('autoRenew', v)}
          />
        </Section>

        <Section title="Free trial">
          <ToggleField
            label="This is a free trial"
            hint="We'll flag it before it converts to paid."
            value={form.isFreeTrial}
            onChange={(v) => update('isFreeTrial', v)}
          />
          {form.isFreeTrial ? (
            <DateField
              label="Trial ends"
              value={form.trialEndDate}
              onChange={(iso) => update('trialEndDate', iso)}
              error={errors.trialEndDate}
            />
          ) : null}
        </Section>

        {form.details.kind !== 'none' ? (
          <Section title="Details">
            {form.details.kind === 'warranty' ? (
              <WarrantyFields details={form.details} onChange={setWarranty} />
            ) : null}
            {form.details.kind === 'document' ? (
              <DocumentFields details={form.details} onChange={setDocument} />
            ) : null}
            {form.details.kind === 'utility' ? (
              <UtilityFields details={form.details} onChange={setUtility} />
            ) : null}
            {form.details.kind === 'insurance' ? (
              <InsuranceFields details={form.details} onChange={setInsurance} />
            ) : null}
          </Section>
        ) : null}

        <Section title="Status & intent">
          <SelectField<ItemStatus>
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
            onChange={(v) => update('status', v)}
          />
          <SelectField<IntentFlag>
            label="Intent"
            value={form.intentFlag}
            options={INTENT_OPTIONS}
            onChange={(v) => update('intentFlag', v)}
          />
          <Input
            label="Notes (optional)"
            placeholder="Anything worth remembering"
            value={form.notes}
            onChangeText={(t) => update('notes', t)}
            multiline
          />
        </Section>

        <Button
          label={isEdit ? 'Save changes' : 'Add item'}
          onPress={handleSave}
          loading={saving}
          size="lg"
          fullWidth
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

// --- Category-specific field groups ---

function WarrantyFields({
  details,
  onChange,
}: {
  details: WarrantyDetails;
  onChange: (patch: Partial<Omit<WarrantyDetails, 'kind'>>) => void;
}) {
  return (
    <>
      <Input
        label="Product"
        placeholder="e.g. Refrigerator"
        value={details.product ?? ''}
        onChangeText={(t) => onChange({ product: t })}
      />
      <Input
        label="Brand"
        placeholder="e.g. Samsung"
        value={details.brand ?? ''}
        onChangeText={(t) => onChange({ brand: t })}
      />
      <DateField
        label="Purchase date"
        value={details.purchaseDate ?? null}
        onChange={(iso) => onChange({ purchaseDate: iso })}
      />
      <Input
        label="Warranty length (months)"
        placeholder="e.g. 24"
        keyboardType="number-pad"
        value={details.warrantyMonths !== undefined ? String(details.warrantyMonths) : ''}
        onChangeText={(t) => onChange({ warrantyMonths: t ? Number(t.replace(/\D/g, '')) : undefined })}
      />
    </>
  );
}

function DocumentFields({
  details,
  onChange,
}: {
  details: DocumentDetails;
  onChange: (patch: Partial<Omit<DocumentDetails, 'kind'>>) => void;
}) {
  return (
    <>
      <SelectField<string>
        label="Document type"
        value={details.docType ?? null}
        options={DOC_TYPE_OPTIONS}
        onChange={(v) => onChange({ docType: v })}
        placeholder="Select type"
      />
      <Input
        label="Issuing authority"
        placeholder="e.g. RTO, Passport Seva"
        value={details.issuingAuthority ?? ''}
        onChangeText={(t) => onChange({ issuingAuthority: t })}
      />
      <Input
        label="ID number (masked)"
        placeholder="Last 4 digits only"
        value={details.maskedIdNumber ?? ''}
        onChangeText={(t) => onChange({ maskedIdNumber: t })}
        onBlur={() =>
          details.maskedIdNumber
            ? onChange({ maskedIdNumber: maskIdNumber(details.maskedIdNumber) })
            : undefined
        }
        hint="For your safety, only a masked value is stored."
      />
      <DateField
        label="Issue date"
        value={details.issueDate ?? null}
        onChange={(iso) => onChange({ issueDate: iso })}
      />
      <DateField
        label="Expiry date"
        value={details.expiryDate ?? null}
        onChange={(iso) => onChange({ expiryDate: iso })}
      />
    </>
  );
}

function UtilityFields({
  details,
  onChange,
}: {
  details: UtilityDetails;
  onChange: (patch: Partial<Omit<UtilityDetails, 'kind'>>) => void;
}) {
  return (
    <>
      <Input
        label="Biller"
        placeholder="e.g. BESCOM, Airtel"
        value={details.biller ?? ''}
        onChangeText={(t) => onChange({ biller: t })}
      />
      <Input
        label="Account number"
        placeholder="Consumer / account no."
        value={details.accountNumber ?? ''}
        onChangeText={(t) => onChange({ accountNumber: t })}
      />
      <DateField
        label="Due date"
        value={details.dueDate ?? null}
        onChange={(iso) => onChange({ dueDate: iso })}
      />
    </>
  );
}

function InsuranceFields({
  details,
  onChange,
}: {
  details: InsuranceDetails;
  onChange: (patch: Partial<Omit<InsuranceDetails, 'kind'>>) => void;
}) {
  return (
    <>
      <Input
        label="Provider"
        placeholder="e.g. LIC, HDFC Ergo"
        value={details.provider ?? ''}
        onChangeText={(t) => onChange({ provider: t })}
      />
      <Input
        label="Policy number"
        placeholder="Policy no."
        value={details.policyNumber ?? ''}
        onChangeText={(t) => onChange({ policyNumber: t })}
      />
      <Input
        label="Premium (₹)"
        placeholder="0"
        keyboardType="decimal-pad"
        value={details.premium !== undefined ? String(details.premium) : ''}
        onChangeText={(t) => onChange({ premium: t ? Number(t) : undefined })}
      />
      <DateField
        label="Coverage ends"
        value={details.coverageEndDate ?? null}
        onChange={(iso) => onChange({ coverageEndDate: iso })}
      />
      <DateField
        label="Renewal date"
        value={details.renewalDate ?? null}
        onChange={(iso) => onChange({ renewalDate: iso })}
      />
    </>
  );
}

// --- Layout helpers ---

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <>
      <View style={styles.handle} />
      <View style={styles.header}>
        <AppText size="lg" weight="semibold">
          {title}
        </AppText>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionBody: {
    gap: theme.spacing.md,
  },
  submit: {
    marginTop: theme.spacing.sm,
  },
});
