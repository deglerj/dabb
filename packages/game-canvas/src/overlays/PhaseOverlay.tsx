/**
 * PhaseOverlay — animated wrapper that slides/fades content in and out.
 *
 * visible=true  → fade in + slide up from -40px + scale from 0.92
 * visible=false → fade out + slide to -20px + scale to 0.95
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

export interface PhaseOverlayProps {
  visible: boolean;
  rotation?: number;
  children: React.ReactNode;
}

export function PhaseOverlay({ visible, rotation = 0, children }: PhaseOverlayProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-20, { duration: 180 });
      scale.value = withTiming(0.95, { duration: 180 });
    }
  }, [visible]);

  const outerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  return (
    <AnimatedView style={[styles.container, outerStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.paper}>{children}</View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    zIndex: 100,
  },
  paper: {
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    padding: 16,
  },
});
