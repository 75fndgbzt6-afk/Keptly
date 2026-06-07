import React, { useCallback, useEffect, useState } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button } from '@/components/ui';
import { theme } from '@/constants/theme';
import { Item, ItemDetails, PaymentMethod } from '@/types';
import { CATEGORY_ICONS } from '@/lib/category';
import {
  BILLING_CYCLE_OPTIONS,
  STATUS_LABELS,
  INTENT_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/lib/options';
import { formatCurrency } from '@/lib/currency';
import { formatDate, relativeDateLabel } from '@/lib/date';
import { urgencyBadgeVariant, urgencyForDate } from '@/lib/urgency';
import { primaryTrackType, reminderTracksForItem } from '@/lib/reminders';
import { REMINDER_TYPE_LABELS } from '@/lib/notification-copy';
import { getItem, deleteItem } from '@/db/items';
import { scheduleTestNotification } from '@/services/notifications';
import { useItemsStore } from '@/stores/itemsStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';

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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useItemsStore((s) => s.refresh);
  const methods = usePaymentMethodsStore((s) => s.methods);
  const refreshMethods = usePaymentMethodsStore((s) => s.refresh);

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getItem(id);
    setItem(found);
    setLoading(false);
  }, [id]);

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
            await deleteItem(item.id);
            await refresh();
            router.back();
          },
        },
      ],
    );
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
              name={CATEGORY_ICONS[item.category]}
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
        </View>

        <Card style={styles.card}>
          <DetailRow label="Amount" value={formatCurrency(item.amount, item.currency)} />
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

        <Card style={styles.card}>
          <DetailRow label="Intent" value={INTENT_LABELS[item.intentFlag]} last={!item.notes} />
          {item.notes ? <DetailRow label="Notes" value={item.notes} last /> : null}
        </Card>

        <RemindersCard item={item} onEdit={() => router.push({ pathname: '/(modal)/edit-reminders', params: { id: item.id } })} />

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

function RemindersCard({ item, onEdit }: { item: Item; onEdit: () => void }) {
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

function DetailsCard({ details }: { details: ItemDetails }) {
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
      return [
        { label: 'Document type', value: details.docType || '—' },
        { label: 'Issuing authority', value: details.issuingAuthority || '—' },
        { label: 'ID number', value: details.maskedIdNumber || '—' },
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
  return (
    <Button label="Back" variant="ghost" onPress={onPress} style={styles.backButton} />
  );
}

const styles = StyleSheet.create({
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
});
