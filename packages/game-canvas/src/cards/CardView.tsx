import React, { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

const AnimatedView = Animated.createAnimatedComponent(View);
import type { CardId } from '@dabb/shared-types';
import { CardFace } from './CardFace.js';
import { CardBack } from './CardBack.js';
import { createCardGesture } from './dragGesture.js';

export interface CardViewProps {
  card: CardId | null; // null = show back
  targetX: number;
  targetY: number;
  targetRotation: number; // degrees
  zIndex: number;
  width?: number;
  height?: number;
  draggable?: boolean;
  onTap?: () => void;
  onDrop?: (x: number, y: number) => void;
  animationDuration?: number;
  /** If provided, card snaps to this position on mount before animating to targetX. */
  initialX?: number;
  /** If provided, card arcs from this Y position on mount. */
  initialY?: number;
}

const DEFAULT_W = 70;
const DEFAULT_H = 105;
const ARC_LIFT_PX = 60;

export function CardView({
  card,
  targetX,
  targetY,
  targetRotation,
  zIndex,
  width = DEFAULT_W,
  height = DEFAULT_H,
  draggable = false,
  onTap,
  onDrop,
  animationDuration = 400,
  initialX,
  initialY,
}: CardViewProps) {
  // Snap to initial position on mount (or target if no initial given)
  const x = useSharedValue(initialX ?? targetX);
  const y = useSharedValue(initialY ?? targetY);
  const rotation = useSharedValue(targetRotation);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const cfg = { duration: animationDuration, easing: Easing.out(Easing.cubic) };
    const firstRender = isFirstRender.current;
    isFirstRender.current = false;

    x.value = withTiming(targetX, cfg);
    rotation.value = withTiming(targetRotation, { duration: animationDuration });

    if (firstRender && initialY !== undefined) {
      // Arc: rise to peak then drop to target
      const peakY = (initialY + targetY) / 2 - ARC_LIFT_PX;
      const half = Math.round(animationDuration / 2);
      y.value = withSequence(
        withTiming(peakY, { duration: half, easing: Easing.out(Easing.cubic) }),
        withTiming(targetY, { duration: half, easing: Easing.in(Easing.cubic) })
      );
    } else {
      y.value = withTiming(targetY, cfg);
    }
  }, [targetX, targetY, targetRotation, animationDuration, initialY]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + translateX.value,
    top: y.value + translateY.value,
    zIndex,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  const gesture = createCardGesture({ draggable, onTap, onDrop, translateX, translateY, scale });

  return (
    <GestureDetector gesture={gesture}>
      <AnimatedView style={animatedStyle}>
        {card !== null ? (
          <CardFace card={card} width={width} height={height} />
        ) : (
          <CardBack width={width} height={height} />
        )}
      </AnimatedView>
    </GestureDetector>
  );
}
