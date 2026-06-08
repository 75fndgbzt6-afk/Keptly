import React, { useEffect, useRef } from 'react';
import { Modal, Animated, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';

interface ChartModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Centered, scrim-backed modal that scales in smoothly for an enlarged chart. */
export function ChartModal({ visible, title, onClose, children }: ChartModalProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.96);
      Animated.spring(scale, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }).start();
    }
  }, [visible, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close">
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Pressable onPress={() => {}}>
            {/* Drag handle */}
            <View style={styles.handle} />
            {/* Header: centered title + X close */}
            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
              </Pressable>
              <AppText size="lg" weight="bold" align="center" accessibilityRole="header">
                {title}
              </AppText>
              {/* Spacer to balance the close button */}
              <View style={styles.closeBtn} />
            </View>
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.base,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: 'center',
      marginBottom: theme.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
