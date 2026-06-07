import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** A single pulsing placeholder block used while content loads. */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius ?? theme.radius.sm, opacity: pulse },
        style,
      ]}
    />
  );
}

/** A list of card-shaped skeleton rows. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.list} accessibilityElementsHidden accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={styles.cardBody}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    block: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    list: {
      padding: theme.spacing.base,
      gap: theme.spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cardBody: {
      flex: 1,
      gap: theme.spacing.sm,
    },
  });
