import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Apply horizontal padding to content */
  padded?: boolean;
  /** Wrap in a ScrollView */
  scroll?: boolean;
  /** Pull-to-refresh callback (only used when scroll=true) */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Safe area edges to inset. Defaults to ['top'] */
  edges?: Edge[];
}

export function Screen({
  children,
  style,
  padded = true,
  scroll = false,
  onRefresh,
  refreshing = false,
  edges = ['top'],
}: ScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const inner = (
    <View style={[styles.inner, padded && styles.padded, style]}>
      {children}
    </View>
  );

  if (scroll) {
    return (
      <SafeAreaView style={styles.container} edges={edges}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={edges}>
      {inner}
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: theme.spacing.base,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
