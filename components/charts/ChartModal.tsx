import React, { useEffect, useRef } from 'react';
import { Modal, Animated, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ChartModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Icon for the dismiss control (e.g. an arrow to shrink). */
  closeIcon?: IoniconName;
  children: React.ReactNode;
}

/** Centered, scrim-backed modal that scales in smoothly for an enlarged chart. */
export function ChartModal({ visible, title, onClose, closeIcon = 'close', children }: ChartModalProps) {
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
            <View style={styles.header}>
              <AppText size="lg" weight="bold" accessibilityRole="header">
                {title}
              </AppText>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Shrink">
                <Ionicons name={closeIcon} size={22} color={theme.colors.text.secondary} />
              </Pressable>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
