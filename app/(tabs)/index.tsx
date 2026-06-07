import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, EmptyState } from '@/components/ui';
import { ReminderPermissionBanner } from '@/components/notifications/ReminderPermissionBanner';
import { theme } from '@/constants/theme';
import { useNotificationsStore } from '@/stores/notificationsStore';

export default function HomeScreen() {
  const router = useRouter();
  const permission = useNotificationsStore((s) => s.permission);
  const asked = useNotificationsStore((s) => s.asked);
  const refresh = useNotificationsStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Show the calm pre-prompt once, before the OS dialog, if we've never asked.
  useEffect(() => {
    if (permission === 'undetermined' && !asked) {
      router.push('/(modal)/enable-reminders');
    }
  }, [permission, asked, router]);

  const remindersOff = asked && permission !== 'granted';

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Renewly
        </AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() => {}}
          >
            <Ionicons name="settings-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {remindersOff ? <ReminderPermissionBanner /> : null}

      <EmptyState
        icon="home-outline"
        title="Nothing due yet"
        message="Add your subscriptions, bills, warranties, and documents to see them here."
        action={{
          label: 'Add your first item',
          onPress: () => router.push('/(modal)/add-item'),
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
