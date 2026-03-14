import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
}

const DEFAULT_W = 70;
const DEFAULT_H = 105;

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
}: CardViewProps) {
  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);
  const rotation = useSharedValue(targetRotation);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const cfg = { duration: animationDuration, easing: Easing.out(Easing.cubic) };
    x.value = withTiming(targetX, cfg);
    y.value = withTiming(targetY, cfg);
    rotation.value = withTiming(targetRotation, { duration: animationDuration });
  }, [targetX, targetY, targetRotation, animationDuration]);

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
