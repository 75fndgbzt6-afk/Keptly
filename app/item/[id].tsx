import React, { useCallback, useEffect, useState } from 'react';
import { View, Image, Alert, ActivityIndicator, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button } from '@/components/ui';
import { RevealableValue } from '@/components/security';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item, ItemDetails, IntentFlag, PaymentMethod } from '@/types';
import { iconForCategory } from '@/lib/category';
import {
  BILLING_CYCLE_OPTIONS,
  STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/lib/options';
import { hasUsageModel } from '@/lib/usage-models';
import { documentDisplayId } from '@/lib/masking';
import { PERMISSION_COPY } from '@/lib/permission-copy';
import { formatCurrency } from '@/lib/currency';
import { formatDate, relativeDateLabel } from '@/lib/date';
import { urgencyBadgeVariant, urgencyForDate } from '@/lib/urgency';
import { primaryTrackType, reminderTracksForItem } from '@/lib/reminders';
import { REMINDER_TYPE_LABELS } from '@/lib/notification-copy';
import { getItem, deleteItem, updateItem } from '@/db/items';
import { scheduleTestNotification } from '@/services/notifications';
import { getValueVerdict, ValueVerdict } from '@/services/value-engine';
import { resolvePayUrl, resolveCancelUrl } from '@/lib/service-links';
import { getFullId, purgeItemSecrets } from '@/services/vault';
import { captureScan, deleteScan, ScanSource } from '@/services/scan';
import { UsageSection, UsageHistoryCard } from '@/components/usage';
import { useItemsStore } from '@/stores/itemsStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';

const INTENT_SEGMENTS: { value: IntentFlag; label: string }[] = [
  { value: 'more', label: 'Want more' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'less', label: 'Want less' },
];

function billingCycleLabel(item: Item): string {
  return BILLING_CYCLE_OPTIONS.find((o) => o.value === item.billingCycle)?.label ?? item.billingCycle;
}

function leadSummary(leadDays: number[]): string {
  if (leadDays.length === 0) return 'No reminders';
  if (leadDays.every((d) => d > 0)) return `${leadDays.join(' / ')} days before`;
  return leadDays.map((d) => (d === 0 ? 'on the day' : `${d}d before`)).join(' · ');
}

function paymentSummary(method: PaymentMethod): string {
  const typeLabel = PAYMENT_TYPE_LABELS[method.type];
  const tail = method.last4 ? ` •••• ${method.last4}` : '';
  return `${method.label} · ${typeLabel}${tail}`;
}

export default function ItemDetailScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useItemsStore((s) => s.refresh);
  const methods = usePaymentMethodsStore((s) => s.methods);
  const refreshMethods = usePaymentMethodsStore((s) => s.refresh);

  const [item, setItem] = useState<Item | null>(null);
  const [verdict, setVerdict] = useState<ValueVerdict | null>(null);
  const [canReveal, setCanReveal] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshVerdict = useCallback(async () => {
    if (!id) return;
    setVerdict(await getValueVerdict(id));
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getItem(id);
    setItem(found);
    // A full ID only exists for documents that have one stored in secure store.
    setCanReveal(found?.details.kind === 'document' ? !!(await getFullId(found.id)) : false);
    await refreshVerdict();
    setLoading(false);
  }, [id, refreshVerdict]);

  const onIntentChange = useCallback(
    async (flag: IntentFlag) => {
      if (!item || flag === item.intentFlag) return;
      const updated = await updateItem(item.id, { intentFlag: flag });
      if (updated) setItem(updated);
      await refreshVerdict();
      await refresh();
    },
    [item, refreshVerdict, refresh],
  );

  useEffect(() => {
    refreshMethods();
  }, [refreshMethods]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleTestReminder = () => {
    if (!item) return;
    Alert.alert(
      'Test reminder',
      'Send a sample notification in 10 seconds? Leave the app to see it on the lock screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            await scheduleTestNotification(item);
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      'Delete item',
      `Delete "${item.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Erase on-device secrets (full ID + scan) before removing the row.
            await purgeItemSecrets(item.id);
            await deleteItem(item.id);
            await refresh();
            router.back();
          },
        },
      ],
    );
  };

  const runScan = useCallback(
    async (source: ScanSource) => {
      if (!item) return;
      const path = await captureScan(item.id, source);
      if (!path) return;
      await updateItem(item.id, { attachmentUri: path });
      await load();
      await refresh();
    },
    [item, load, refresh],
  );

  const handleAttachScan = () => {
    // Plain-language rationale before any OS permission prompt.
    Alert.alert(PERMISSION_COPY.scan.title, PERMISSION_COPY.scan.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => runScan('camera') },
      { text: 'Choose from library', onPress: () => runScan('library') },
    ]);
  };

  const handleRemoveScan = () => {
    if (!item) return;
    Alert.alert('Remove scan', 'Delete the attached scan from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteScan(item.id);
          await updateItem(item.id, { attachmentUri: null });
          await load();
          await refresh();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.center}>
          <AppText color={theme.colors.text.secondary}>Item not found.</AppText>
        </View>
      </Screen>
    );
  }

  const method = item.paymentMethodId
    ? methods.find((m) => m.id === item.paymentMethodId) ?? null
    : null;
  const nextLevel = urgencyForDate(item.nextDate);

  return (
    <Screen scroll padded={false}>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.body}>
        <View style={styles.heading}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={iconForCategory(item.category)}
              size={26}
              color={theme.colors.accent}
            />
          </View>
          <AppText size="xl" weight="bold" align="center">
            {item.name}
          </AppText>
          <View style={styles.headingBadges}>
            <Badge label={item.category} variant="accent" />
            <Badge label={STATUS_LABELS[item.status]} variant="neutral" />
          </View>

          {verdict && verdict.signal !== 'no_data' && verdict.headline ? (
            <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.verdict}>
              {verdict.headline}
            </AppText>
          ) : null}

          <IntentControl value={item.intentFlag} onChange={onIntentChange} />
        </View>

        <Card style={styles.card}>
          <DetailRow label="Amount" value={formatCurrency(item.amount)} />
          <DetailRow label="Billing cycle" value={billingCycleLabel(item)} />
          <DetailRow
            label="Next date"
            value={item.nextDate ? formatDate(item.nextDate) : 'No set date'}
            badge={
              item.nextDate
                ? { label: relativeDateLabel(item.nextDate), variant: urgencyBadgeVariant(nextLevel) }
                : undefined
            }
          />
          <DetailRow label="Start date" value={formatDate(item.startDate)} />
          <DetailRow label="Payment method" value={method ? paymentSummary(method) : 'None'} />
          <DetailRow label="Account holder" value={item.holderName || '—'} />
          <DetailRow label="Auto-renews" value={item.autoRenew ? 'Yes' : 'No'} last />
        </Card>

        {hasUsageModel(item.category) ? (
          <UsageSection item={item} onChanged={refreshVerdict} />
        ) : null}

        {hasUsageModel(item.category) ? <UsageHistoryCard item={item} /> : null}

        {item.isFreeTrial ? (
          <Card style={styles.card}>
            <DetailRow label="Free trial" value="Yes" />
            <DetailRow
              label="Trial ends"
              value={item.trialEndDate ? formatDate(item.trialEndDate) : '—'}
              last
            />
          </Card>
        ) : null}

        <DetailsCard details={item.details} />

        {item.category === 'Government document' || item.category === 'Insurance' ? (
          <SecuredCard
            item={item}
            canReveal={canReveal}
            onAttachScan={handleAttachScan}
            onRemoveScan={handleRemoveScan}
          />
        ) : null}

        {item.notes ? (
          <Card style={styles.card}>
            <DetailRow label="Notes" value={item.notes} last />
          </Card>
        ) : null}

        <RemindersCard item={item} onEdit={() => router.push({ pathname: '/(modal)/edit-reminders', params: { id: item.id } })} />

        {QUICK_ACTION_CATEGORIES.includes(item.category) ? (
          <QuickActionsCard item={item} />
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Edit"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(modal)/add-item', params: { id: item.id } })}
            fullWidth
          />
          <Button label="Delete" variant="danger" onPress={handleDelete} fullWidth />
          {__DEV__ ? (
            <Button label="Test reminder in 10s" variant="ghost" onPress={handleTestReminder} fullWidth />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function IntentControl({
  value,
  onChange,
}: {
  value: IntentFlag;
  onChange: (flag: IntentFlag) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.intentControl}>
      {INTENT_SEGMENTS.map((seg) => {
        const active = seg.value === value;
        return (
          <TouchableOpacity
            key={seg.value}
            activeOpacity={0.7}
            onPress={() => onChange(seg.value)}
            style={[styles.intentSegment, active && styles.intentSegmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <AppText
              size="sm"
              weight={active ? 'semibold' : 'regular'}
              color={active ? theme.colors.text.inverse : theme.colors.text.secondary}
            >
              {seg.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RemindersCard({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tracks = reminderTracksForItem(item);
  const editable = primaryTrackType(item) !== null;

  return (
    <Card style={styles.card}>
      <View style={[styles.row, tracks.length > 0 && styles.rowBorder]}>
        <AppText weight="semibold">Reminders</AppText>
        {editable ? (
          <TouchableOpacity onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit reminder timing">
            <AppText size="sm" color={theme.colors.accent} weight="medium">
              Edit
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {tracks.length === 0 ? (
        <View style={styles.row}>
          <AppText size="sm" color={theme.colors.text.secondary}>
            No date-based reminders for this item.
          </AppText>
        </View>
      ) : (
        tracks.map((track, i) => (
          <DetailRow
            key={track.type}
            label={REMINDER_TYPE_LABELS[track.type]}
            value={leadSummary(track.leadDays)}
            last={i === tracks.length - 1}
          />
        ))
      )}
    </Card>
  );
}

function SecuredCard({
  item,
  canReveal,
  onAttachScan,
  onRemoveScan,
}: {
  item: Item;
  canReveal: boolean;
  onAttachScan: () => void;
  onRemoveScan: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isDocument = item.details.kind === 'document';
  const masked = isDocument ? documentDisplayId(item) : null;
  const hasScan = !!item.attachmentUri;

  return (
    <Card style={styles.card}>
      <View style={[styles.row, styles.rowBorder]}>
        <View style={styles.securedHeading}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.colors.text.secondary} />
          <AppText weight="semibold">Secured</AppText>
        </View>
      </View>

      {isDocument ? (
        <View style={[styles.row, styles.rowBorder]}>
          <AppText size="sm" color={theme.colors.text.secondary}>
            ID number
          </AppText>
          {masked ? (
            <RevealableValue
              masked={masked}
              reason={PERMISSION_COPY.reveal.title}
              getFull={() => getFullId(item.id)}
              canReveal={canReveal}
            />
          ) : (
            <AppText weight="medium" align="right">
              —
            </AppText>
          )}
        </View>
      ) : null}

      <View style={styles.scanSection}>
        <AppText size="sm" color={theme.colors.text.secondary}>
          Scan
        </AppText>
        {hasScan ? (
          <>
            <Image source={{ uri: item.attachmentUri ?? undefined }} style={styles.scanThumb} resizeMode="cover" />
            <View style={styles.scanActions}>
              <Button label="Replace" variant="secondary" size="sm" onPress={onAttachScan} style={styles.flex1} />
              <Button label="Remove" variant="ghost" size="sm" onPress={onRemoveScan} style={styles.flex1} />
            </View>
          </>
        ) : (
          <Button label="Attach scan" variant="secondary" size="sm" onPress={onAttachScan} />
        )}
        <AppText size="xs" color={theme.colors.text.tertiary}>
          Stored on-device only and locked behind your biometric — never uploaded.
        </AppText>
      </View>
    </Card>
  );
}

function DetailsCard({ details }: { details: ItemDetails }) {
  const styles = useThemedStyles(makeStyles);
  const rows = detailRows(details);
  if (rows.length === 0) return null;
  return (
    <Card style={styles.card}>
      {rows.map((r, i) => (
        <DetailRow key={r.label} label={r.label} value={r.value} last={i === rows.length - 1} />
      ))}
    </Card>
  );
}

function detailRows(details: ItemDetails): { label: string; value: string }[] {
  switch (details.kind) {
    case 'warranty':
      return [
        { label: 'Product', value: details.product || '—' },
        { label: 'Brand', value: details.brand || '—' },
        { label: 'Purchase date', value: details.purchaseDate ? formatDate(details.purchaseDate) : '—' },
        {
          label: 'Warranty length',
          value: details.warrantyMonths !== undefined ? `${details.warrantyMonths} months` : '—',
        },
      ];
    case 'document':
      // ID number is shown in the secured card (with Reveal), not here.
      return [
        { label: 'Document type', value: details.docType || '—' },
        { label: 'Issuing authority', value: details.issuingAuthority || '—' },
        { label: 'Issue date', value: details.issueDate ? formatDate(details.issueDate) : '—' },
        { label: 'Expiry date', value: details.expiryDate ? formatDate(details.expiryDate) : '—' },
      ];
    case 'utility':
      return [
        { label: 'Biller', value: details.biller || '—' },
        { label: 'Account number', value: details.accountNumber || '—' },
        { label: 'Due date', value: details.dueDate ? formatDate(details.dueDate) : '—' },
      ];
    case 'insurance':
      return [
        { label: 'Provider', value: details.provider || '—' },
        { label: 'Policy number', value: details.policyNumber || '—' },
        {
          label: 'Premium',
          value: details.premium !== undefined ? formatCurrency(details.premium) : '—',
        },
        {
          label: 'Coverage ends',
          value: details.coverageEndDate ? formatDate(details.coverageEndDate) : '—',
        },
        { label: 'Renewal date', value: details.renewalDate ? formatDate(details.renewalDate) : '—' },
      ];
    case 'none':
    default:
      return [];
  }
}

// Categories where cancel/pay actions make sense (not Warranty or documents).
const QUICK_ACTION_CATEGORIES = [
  'Streaming/OTT', 'Music', 'AI tools', 'Cloud/Software',
  'Gym/Fitness', 'Utilities', 'Telecom', 'Insurance', 'Membership', 'Other',
];

function openUrl(url: string) {
  // Normalise bare domains → full URL so Linking doesn't reject them.
  const full = url.startsWith('http') ? url : `https://${url}`;
  Linking.openURL(full).catch(() =>
    Alert.alert('Could not open link', 'Check that the URL is correct in Edit.'),
  );
}

function QuickActionsCard({ item }: { item: Item }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const handleCancel = () => openUrl(resolveCancelUrl(item));
  const handlePay    = () => openUrl(resolvePayUrl(item));

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        style={[styles.quickAction, styles.rowBorder]}
        activeOpacity={0.7}
        onPress={handleCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel subscription"
      >
        <View style={styles.quickActionLeft}>
          <Ionicons name="close-circle-outline" size={20} color={theme.colors.status.danger} />
          <AppText size="sm" weight="medium" color={theme.colors.status.danger}>
            Cancel subscription
          </AppText>
        </View>
        <Ionicons name="open-outline" size={16} color={theme.colors.text.tertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAction}
        activeOpacity={0.7}
        onPress={handlePay}
        accessibilityRole="button"
        accessibilityLabel="Pay now"
      >
        <View style={styles.quickActionLeft}>
          <Ionicons name="card-outline" size={20} color={theme.colors.accent} />
          <AppText size="sm" weight="medium" color={theme.colors.accent}>
            Pay now
          </AppText>
        </View>
        <Ionicons name="open-outline" size={16} color={theme.colors.text.tertiary} />
      </TouchableOpacity>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  badge,
  last = false,
}: {
  label: string;
  value: string;
  badge?: { label: string; variant: 'good' | 'warning' | 'danger' | 'neutral' };
  last?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <AppText size="sm" color={theme.colors.text.secondary}>
        {label}
      </AppText>
      <View style={styles.rowValue}>
        <AppText weight="medium" align="right">
          {value}
        </AppText>
        {badge ? <Badge label={badge.label} variant={badge.variant} /> : null}
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Button label="Back" variant="ghost" onPress={onPress} style={styles.backButton} />
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
  },
  body: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.base,
  },
  heading: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingBadges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  verdict: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  intentControl: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.full,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  intentSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
  },
  intentSegmentActive: {
    backgroundColor: theme.colors.accent,
  },
  card: {
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.base,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowValue: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  securedHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  scanSection: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  scanThumb: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  scanActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
