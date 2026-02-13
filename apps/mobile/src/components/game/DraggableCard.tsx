/**
 * Card wrapper that adds drag-to-play via Pan gesture.
 * When draggable, the card can be dragged upward onto the TrickArea to play it.
 * Falls back to plain Card when draggable=false.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { Card as CardType } from '@dabb/shared-types';
import Card from './Card';
import { useDropZone } from '../../contexts/DropZoneContext';

interface DraggableCardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  draggable?: boolean;
  onPress?: () => void;
  onPlayCard?: (cardId: string) => void;
}

function DraggableCard({
  card,
  selected = false,
  valid = true,
  draggable = false,
  onPress,
  onPlayCard,
}: DraggableCardProps) {
  const { bounds, isDragActive } = useDropZone();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const canDrag = draggable && valid && !!onPlayCard;

  const playCard = (cardId: string) => {
    onPlayCard?.(cardId);
  };

  const panGesture = Gesture.Pan()
    .enabled(canDrag)
    .activeOffsetY(-10)
    .failOffsetX([-20, 20])
    .failOffsetY(20)
    .onStart((event) => {
      startX.value = event.absoluteX;
      startY.value = event.absoluteY;
      zIndex.value = 1000;
      scale.value = withSpring(1.1);
      isDragActive.value = true;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const dropX = startX.value + event.translationX;
      const dropY = startY.value + event.translationY;

      const zone = bounds.value;
      const isOverDropZone =
        zone !== null &&
        dropX >= zone.x &&
        dropX <= zone.x + zone.width &&
        dropY >= zone.y &&
        dropY <= zone.y + zone.height;

      if (isOverDropZone) {
        runOnJS(playCard)(card.id);
      }

      // Animate back to original position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      isDragActive.value = false;
    })
    .onFinalize(() => {
      // Safety reset in case gesture is cancelled
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      isDragActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  if (!canDrag) {
    return <Card card={card} selected={selected} valid={valid} onPress={onPress} />;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.wrapper, animatedStyle]}>
        <Card card={card} selected={selected} valid={valid} onPress={onPress} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Ensure the animated wrapper doesn't clip the card's shadow
  },
});

export default DraggableCard;
