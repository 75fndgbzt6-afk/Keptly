import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Button, Input } from '@/components/ui';
import { SelectField, DateField, ToggleField, PaymentMethodPicker, CategoryPicker } from '@/components/form';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
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
import { emptyDetailsFor, detailKindForCategory, isBuiltInCategory } from '@/lib/category';
import {
  BILLING_CYCLE_OPTIONS,
  INTENT_OPTIONS,
  STATUS_OPTIONS,
  DOC_TYPES,
  OTHER_DOC_TYPE,
} from '@/lib/options';
import { documentMask } from '@/lib/masking';
import { todayISO, addDays, fromISODate, toISODate } from '@/lib/date';
import { createItem, getItem, updateItem } from '@/db/items';
import { getFullId, setFullId, clearFullId } from '@/services/vault';
import { useItemsStore } from '@/stores/itemsStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useAiStore } from '@/stores/aiStore';
import { parseEntry as aiParseEntry, parseImage as aiParseImage, AiError } from '@/services/ai';
import { pickImageBase64, ScanSource } from '@/services/scan';
import { startVoice, stopVoice, isVoiceAvailable } from '@/services/voice';
import { ParsedEntry } from '@/lib/ai-types';
import { AI_COPY } from '@/lib/copy/ai';
import { CURRENCY_SYMBOLS } from '@/constants/config';

const DOC_TYPE_OPTIONS: Option<string>[] = DOC_TYPES.map((d) => ({ label: d, value: d }));

/** Empty details for any category string (custom categories carry no details). */
function detailsForCategory(category: string): ItemDetails {
  return isBuiltInCategory(category) ? emptyDetailsFor(category) : { kind: 'none' };
}

/**
 * Infer how long a free trial runs from the parsed text, then return the trial
 * END date as ISO. Reads any explicit duration the user wrote ("14-day trial",
 * "one month free", "trial for 2 weeks"); falls back to the most common 7-day
 * trial when nothing is stated. Counts from the start date (or today).
 */
function inferTrialEndDate(entry: ParsedEntry): string {
  const haystack = `${entry.name ?? ''} ${entry.notes ?? ''}`.toLowerCase();
  let days = 7; // sensible default — the overwhelmingly common free-trial length

  const num = (m: RegExpMatchArray | null) => (m ? parseInt(m[1], 10) : NaN);
  const dayM = haystack.match(/(\d+)\s*[- ]?\s*day/);
  const weekM = haystack.match(/(\d+)\s*[- ]?\s*week/);
  const monthM = haystack.match(/(\d+)\s*[- ]?\s*month/);

  if (!Number.isNaN(num(dayM))) days = num(dayM);
  else if (!Number.isNaN(num(weekM))) days = num(weekM) * 7;
  else if (!Number.isNaN(num(monthM))) days = num(monthM) * 30;
  else if (/\bweek\b/.test(haystack)) days = 7;
  else if (/\bmonth\b/.test(haystack)) days = 30;

  const base = entry.startDate ? fromISODate(entry.startDate) : new Date();
  return toISODate(addDays(base, days));
}

interface FormState {
  name: string;
  category: string; // built-in Category or a custom category name
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
  /** Full government-ID input (document items only). Stored in secure store, never the table. */
  fullId: string;
  /** Existing scan path, round-tripped untouched (scans are managed on the detail screen). */
  attachmentUri: string | null;
}

function initialForm(initialCategory?: string): FormState {
  const category: string = initialCategory ?? 'Streaming/OTT';
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
    details: detailsForCategory(category),
    fullId: '',
    attachmentUri: null,
  };
}

type Errors = Partial<Record<'name' | 'amount' | 'trialEndDate', string>>;

export default function AddEditItemModal() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id, category: initialCategory } = useLocalSearchParams<{ id?: string; category?: string }>();
  const isEdit = !!id;
  const refresh = useItemsStore((s) => s.refresh);
  const customCategories = useCategoriesStore((s) => s.custom);
  const refreshCategories = useCategoriesStore((s) => s.refresh);
  const addCustomCategory = useCategoriesStore((s) => s.add);
  const defaultCurrency = usePreferencesStore((s) => s.defaultCurrency);
  const currencySymbol = CURRENCY_SYMBOLS[defaultCurrency] ?? defaultCurrency;
  const aiEnabled = useAiStore((s) => s.enabled);

  const [form, setForm] = useState<FormState>(() => initialForm(initialCategory));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Quick-add (AI) state.
  const [quickText, setQuickText] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const voiceOk = useRef(false);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const item = await getItem(id);
      if (!active || !item) {
        setLoading(false);
        return;
      }
      // The full ID lives only in secure store; load it for editing.
      const fullId = item.details.kind === 'document' ? (await getFullId(item.id)) ?? '' : '';
      if (!active) return;
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
        fullId,
        attachmentUri: item.attachmentUri,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onCategoryChange = (category: string) =>
    setForm((prev) => ({
      ...prev,
      category,
      // Keep details when only the custom name is being typed (stays kind 'none').
      details:
        detailKindForCategory(isBuiltInCategory(category) ? category : 'Other') ===
        prev.details.kind
          ? prev.details
          : detailsForCategory(category),
    }));

  // Type-safe detail setters (only used when details.kind matches).
  const setWarranty = (patch: Partial<Omit<WarrantyDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as WarrantyDetails), ...patch } }));
  const setDocument = (patch: Partial<Omit<DocumentDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as DocumentDetails), ...patch } }));
  const setUtility = (patch: Partial<Omit<UtilityDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as UtilityDetails), ...patch } }));
  const setInsurance = (patch: Partial<Omit<InsuranceDetails, 'kind'>>) =>
    setForm((p) => ({ ...p, details: { ...(p.details as InsuranceDetails), ...patch } }));

  // --- Quick add (AI): fill the form from a parsed entry for confirm-and-save ---
  const applyParsed = useCallback((entry: ParsedEntry) => {
    setForm((prev) => {
      const category = entry.category || prev.category;
      // When the AI flags a free trial, auto-fill the trial end date (inferred
      // from any stated duration, else 7 days) so the user can confirm-and-save
      // without hunting for a date. Keep an existing date if one is already set.
      const trialEndDate = entry.isFreeTrial
        ? prev.trialEndDate ?? inferTrialEndDate(entry)
        : null;
      return {
        ...prev,
        name: entry.name || prev.name,
        category,
        amount: entry.amount != null ? String(entry.amount) : prev.amount,
        billingCycle: entry.billingCycle,
        isFreeTrial: entry.isFreeTrial,
        trialEndDate,
        // A trial that auto-renews is the norm — surface the reminder by default.
        autoRenew: entry.isFreeTrial ? true : prev.autoRenew,
        startDate: entry.startDate || prev.startDate,
        notes: entry.notes || prev.notes,
        details: detailsForCategory(category),
      };
    });
    setQuickError(null);
  }, []);

  // Assistant "add …" intent pre-fills via the store (create flow only).
  useEffect(() => {
    if (isEdit) return;
    const pending = useAiStore.getState().consumePrefill();
    if (pending) applyParsed(pending);
  }, [isEdit, applyParsed]);

  useEffect(() => {
    isVoiceAvailable().then((ok) => {
      voiceOk.current = ok;
    });
    return () => {
      void stopVoice();
    };
  }, []);

  const onParseText = async () => {
    const text = quickText.trim();
    if (!text || quickBusy) return;
    setQuickBusy(true);
    setQuickError(null);
    try {
      applyParsed(await aiParseEntry(text));
    } catch (err) {
      setQuickError(err instanceof AiError ? err.message : 'Could not parse that.');
    } finally {
      setQuickBusy(false);
    }
  };

  const runPhotoParse = async (source: ScanSource) => {
    setQuickBusy(true);
    setQuickError(null);
    try {
      const base64 = await pickImageBase64(source);
      if (!base64) return;
      applyParsed(await aiParseImage(base64));
    } catch (err) {
      setQuickError(err instanceof AiError ? err.message : 'Could not read that image.');
    } finally {
      setQuickBusy(false);
    }
  };

  const onParsePhoto = () => {
    Alert.alert(AI_COPY.quickAdd.fromPhoto, AI_COPY.voice.rationaleBody, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => runPhotoParse('camera') },
      { text: 'Choose from library', onPress: () => runPhotoParse('library') },
    ]);
  };

  const onQuickMic = () => {
    if (listening) {
      void stopVoice();
      setListening(false);
      return;
    }
    if (!voiceOk.current) {
      Alert.alert(AI_COPY.voice.rationaleTitle, AI_COPY.assistant.micHint);
      return;
    }
    Alert.alert(AI_COPY.voice.rationaleTitle, AI_COPY.voice.rationaleBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          const ok = await startVoice({
            onPartial: setQuickText,
            onResult: setQuickText,
            onError: () => setListening(false),
            onEnd: () => setListening(false),
          });
          setListening(ok);
        },
      },
    ]);
  };

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

    // Persist a user-created custom category so it reappears in the picker.
    const category = form.category.trim() || 'Other';
    if (!isBuiltInCategory(category)) await addCustomCategory(category);

    // For documents, persist only the MASKED id in the table; the full value goes
    // to secure store after we know the item's id (SPEC §8).
    const trimmedFullId = form.fullId.trim();
    let details = form.details;
    if (details.kind === 'document') {
      details = {
        ...details,
        maskedIdNumber: trimmedFullId ? documentMask(details.docType, trimmedFullId) : undefined,
      };
    }

    const payload = {
      name: form.name.trim(),
      category: category as Category,
      holderName: form.holderName.trim() || null,
      paymentMethodId: form.paymentMethodId,
      amount: amountValue,
      currency: defaultCurrency,
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      autoRenew: form.autoRenew,
      isFreeTrial: form.isFreeTrial,
      trialEndDate: form.isFreeTrial ? form.trialEndDate : null,
      status: form.status,
      intentFlag: form.intentFlag,
      notes: form.notes.trim() || null,
      // Round-trip any existing scan untouched (managed on the detail screen).
      attachmentUri: form.attachmentUri,
      details,
    };

    const savedId = isEdit && id ? id : (await createItem(payload)).id;
    if (isEdit && id) {
      await updateItem(id, payload);
    }

    // Mirror the full ID into secure store (or clear it when removed / non-document).
    if (details.kind === 'document' && trimmedFullId) {
      await setFullId(savedId, trimmedFullId);
    } else {
      await clearFullId(savedId);
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
        {aiEnabled && !isEdit ? (
          <Section title={AI_COPY.quickAdd.toggle}>
            <View style={styles.quickRow}>
              <TouchableOpacity
                onPress={onQuickMic}
                style={[styles.quickMic, listening && styles.quickMicActive]}
                accessibilityRole="button"
                accessibilityLabel="Voice input"
              >
                <Ionicons
                  name={listening ? 'mic' : 'mic-outline'}
                  size={20}
                  color={listening ? theme.colors.text.inverse : theme.colors.accent}
                />
              </TouchableOpacity>
              <View style={styles.quickInput}>
                <Input
                  placeholder={AI_COPY.quickAdd.textPlaceholder}
                  value={quickText}
                  onChangeText={setQuickText}
                  onSubmitEditing={onParseText}
                />
              </View>
              <Button
                label={quickBusy ? AI_COPY.quickAdd.parsing : AI_COPY.quickAdd.parse}
                onPress={onParseText}
                loading={quickBusy}
                size="sm"
              />
            </View>
            <Button
              label={AI_COPY.quickAdd.fromPhoto}
              variant="ghost"
              size="sm"
              onPress={onParsePhoto}
            />
            {quickError ? (
              <AppText size="xs" color={theme.colors.status.danger}>
                {quickError}
              </AppText>
            ) : (
              <AppText size="xs" color={theme.colors.text.tertiary}>
                {AI_COPY.quickAdd.filledNote}
              </AppText>
            )}
          </Section>
        ) : null}

        <Section title="Basics">
          <Input
            label="Name"
            placeholder="e.g. Netflix"
            value={form.name}
            onChangeText={(t) => update('name', t)}
            error={errors.name}
          />
          <CategoryPicker
            label="Category"
            value={form.category}
            onChange={onCategoryChange}
            customCategories={customCategories}
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
            label={`Amount (${currencySymbol})`}
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
              <DocumentFields
                details={form.details}
                fullId={form.fullId}
                onChange={setDocument}
                onFullIdChange={(t) => update('fullId', t)}
              />
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
  fullId,
  onChange,
  onFullIdChange,
}: {
  details: DocumentDetails;
  fullId: string;
  onChange: (patch: Partial<Omit<DocumentDetails, 'kind'>>) => void;
  onFullIdChange: (value: string) => void;
}) {
  const preview = fullId.trim() ? documentMask(details.docType, fullId.trim()) : null;
  const isOther =
    details.docType === OTHER_DOC_TYPE ||
    (!!details.docType && !DOC_TYPES.includes(details.docType));
  const selectValue = isOther
    ? OTHER_DOC_TYPE
    : details.docType && DOC_TYPES.includes(details.docType)
      ? details.docType
      : null;
  return (
    <>
      <SelectField<string>
        label="Document type"
        value={selectValue}
        options={DOC_TYPE_OPTIONS}
        onChange={(v) => onChange({ docType: v })}
        placeholder="Select type"
      />
      {isOther ? (
        <Input
          label="Custom document type"
          placeholder="e.g. Library card"
          value={details.docType === OTHER_DOC_TYPE ? '' : details.docType ?? ''}
          onChangeText={(t) => onChange({ docType: t.trim() === '' ? OTHER_DOC_TYPE : t })}
          autoCapitalize="words"
        />
      ) : null}
      <Input
        label="Issuing authority"
        placeholder="e.g. RTO, Passport Seva"
        value={details.issuingAuthority ?? ''}
        onChangeText={(t) => onChange({ issuingAuthority: t })}
      />
      <Input
        label="ID number"
        placeholder="Enter the full number"
        value={fullId}
        onChangeText={onFullIdChange}
        autoCapitalize="characters"
        autoCorrect={false}
        secureTextEntry
        hint={
          preview
            ? `Stored encrypted on this device. Shown as ${preview}.`
            : 'Stored encrypted on this device — only a masked form is shown elsewhere.'
        }
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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quickInput: {
    flex: 1,
  },
  quickMic: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMicActive: {
    backgroundColor: theme.colors.accent,
  },
});
