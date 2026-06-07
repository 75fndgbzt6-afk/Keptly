import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, LayoutChangeEvent, StyleSheet, Easing } from 'react-native';
import { AppText } from './AppText';

interface MarqueeProps {
  text: string;
  color?: string;
  weight?: React.ComponentProps<typeof AppText>['weight'];
  /** Only animate when active (e.g. the selected tile); otherwise it stays put. */
  active?: boolean;
}

/**
 * One-line label that gently scrolls left→right to reveal the full text when it
 * overflows. Static (and centered) when it fits, or when not active.
 */
export function Marquee({ text, color, weight = 'regular', active = false }: MarqueeProps) {
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  const overflow = textW > containerW + 1;

  useEffect(() => {
    x.stopAnimation();
    x.setValue(0);
    if (!overflow || !active) return;
    const distance = textW - containerW;
    const duration = Math.max(1200, distance * 40);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(x, { toValue: -distance, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(x, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [overflow, active, textW, containerW, x]);

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={{ transform: [{ translateX: x }] }}>
        <View onLayout={(e) => setTextW(e.nativeEvent.layout.width)} style={styles.inner}>
          <AppText size="xs" weight={weight} color={color} numberOfLines={1}>
            {text}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
  },
  inner: {
    alignSelf: 'flex-start',
  },
});
