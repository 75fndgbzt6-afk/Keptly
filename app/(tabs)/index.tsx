import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, EmptyState } from '@/components/ui';
import { theme } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Renewly
        </AppText>
        <TouchableOpacity
          style={styles.headerButton}
          accessibilityLabel="Settings"
          onPress={() => {}}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

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
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
