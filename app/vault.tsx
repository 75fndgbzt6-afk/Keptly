import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button, EmptyState } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item } from '@/types';
import { iconForCategory } from '@/lib/category';
import { iconForDocType } from '@/lib/documents';
import { documentDisplayId } from '@/lib/masking';
import { PERMISSION_COPY } from '@/lib/permission-copy';
import { relativeDateLabel } from '@/lib/date';
import { urgencyBadgeVariant, urgencyForDate } from '@/lib/urgency';
import { requireUnlock } from '@/services/app-lock';
import { vaultItems } from '@/services/vault';
import { useItemContextMenu } from '@/components/items';
import { useItemsStore } from '@/stores/itemsStore';
import { useSecurityStore } from '@/stores/securityStore';

/** Expiry date that matters for a vault item (doc expiry or insurance coverage end). */
function expiryFor(item: Item): string | null {
  if (item.details.kind === 'document') return item.details.expiryDate ?? null;
  if (item.details.kind === 'insurance') return item.details.coverageEndDate ?? null;
  return null;
}

export default function VaultScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const refresh = useItemsStore((s) => s.refresh);
  const vaultLockEnabled = useSecurityStore((s) => s.vaultLockEnabled);
  const onLongPress = useItemContextMenu();
  const addDocument = () =>
    router.push({ pathname: '/(modal)/add-item', params: { category: 'Government document' } });

  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  // Always re-prompt on entry — no inactivity grace for the vault (SPEC §8).
  const attempt = useCallback(async () => {
    if (!vaultLockEnabled) {
      setUnlocked(true);
      return;
    }
    setChecking(true);
    const ok = await requireUnlock(PERMISSION_COPY.vault.title);
    setChecking(false);
    setUnlocked(ok);
  }, [vaultLockEnabled]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  useFocusEffect(
    useCallback(() => {
      if (unlocked) refresh();
    }, [unlocked, refresh]),
  );

  const vault = useMemo(() => vaultItems(items), [items]);

  // Locked gate — vault content is never rendered until authenticated.
  if (!unlocked) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Button label="Back" variant="ghost" onPress={() => router.back()} style={styles.backButton} />
        </View>
        <View style={styles.gate}>
          <View style={styles.iconRing}>
            <Ionicons name="shield-checkmark-outline" size={40} color={theme.colors.accent} />
          </View>
          <AppText size="xl" weight="bold" align="center">
            Vault locked
          </AppText>
          <AppText size="sm" color={theme.colors.text.secondary} align="center" style={styles.gateSub}>
            {PERMISSION_COPY.vault.body}
          </AppText>
          <Button label="Unlock vault" onPress={attempt} loading={checking} size="lg" style={styles.gateButton} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Button label="Back" variant="ghost" onPress={() => router.back()} style={styles.backButton} />
          <TouchableOpacity
            onPress={addDocument}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Add document"
            hitSlop={8}
          >
            <Ionicons name="add" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
        <AppText size="xl" weight="bold" style={styles.title} accessibilityRole="header">
          Vault
        </AppText>
      </View>

      {vault.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Your vault is empty"
          message="Government documents — and insurance policies with a scan — appear here, locked behind your biometric."
          action={{ label: 'Add a document', onPress: addDocument }}
        />
      ) : (
        <FlatList
          data={vault}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VaultRow
              item={item}
              onPress={() => router.push(`/item/${item.id}`)}
              onLongPress={() => onLongPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function VaultRow({
  item,
  onPress,
  onLongPress,
}: {
  item: Item;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const masked = documentDisplayId(item);
  const expiry = expiryFor(item);
  const level = urgencyForDate(expiry);
  const icon =
    item.details.kind === 'document'
      ? iconForDocType(item.details.docType)
      : iconForCategory(item.category);

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.row}>
      {item.attachmentUri ? (
        <Image source={{ uri: item.attachmentUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={20} color={theme.colors.accent} />
        </View>
      )}
      <View style={styles.middle}>
        <AppText weight="semibold" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText size="xs" color={theme.colors.text.tertiary}>
          {masked ?? (item.details.kind === 'document' ? 'No ID stored' : item.category)}
        </AppText>
      </View>
      {expiry ? (
        <Badge label={relativeDateLabel(expiry)} variant={urgencyBadgeVariant(level)} />
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  title: {
    paddingHorizontal: theme.spacing.sm,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  gateSub: {
    maxWidth: 300,
  },
  gateButton: {
    marginTop: theme.spacing.md,
    minWidth: 200,
  },
  listContent: {
    padding: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: theme.spacing.xs,
  },
});
