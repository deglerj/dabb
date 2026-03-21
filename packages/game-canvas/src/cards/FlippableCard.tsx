/**
 * FlippableCard — a card that animates from back to face via a rotateY flip.
 *
 * When flipped transitions false→true (and instant=false), plays a 200ms 3D flip.
 * When instant=true, snaps immediately to face-up (cancels any in-progress animation).
 * When flipped is already true on mount, renders face immediately (no animation).
 */
import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import type { Card } from '@dabb/shared-types';
import { CardBack } from './CardBack.js';
import { CardFace } from './CardFace.js';

const AnimatedView = Animated.createAnimatedComponent(View);

export interface FlippableCardProps {
  card: Card; // card.id is passed to CardFace internally
  flipped: boolean;
  instant: boolean; // when true, snaps to face without animation
  width: number;
  height: number;
}

export function FlippableCard({ card, flipped, instant, width, height }: FlippableCardProps) {
  // showFace drives which canvas is rendered; starts true if already flipped on mount
  const [showFace, setShowFace] = useState(flipped);
  const rotateY = useSharedValue(0);
  // Prevent re-triggering animation if already fired
  const hasFlipped = useRef(flipped);

  // Swap content at the midpoint of the flip (card edge-on at 90°)
  useAnimatedReaction(
    () => rotateY.value,
    (current, previous) => {
      if (previous !== null && previous < 90 && current >= 90) {
        runOnJS(setShowFace)(true);
      }
    }
  );

  useEffect(() => {
    if (!flipped) {
      return;
    }

    if (instant) {
      // Cancel any in-progress flip and reveal face immediately
      cancelAnimation(rotateY);
      rotateY.value = 0;
      setShowFace(true);
      hasFlipped.current = true;
      return;
    }

    if (hasFlipped.current) {
      return;
    } // already animated or already face-up on mount
    hasFlipped.current = true;

    // Phase 1: back rotates to edge (0° → 90°, 100ms)
    // Instant jump to -90° (zero-duration timing)
    // Phase 2: face rotates in from the other side (-90° → 0°, 100ms)
    // Content swap happens via useAnimatedReaction when rotateY passes through 90°.
    rotateY.value = withSequence(
      withTiming(90, { duration: 100, easing: Easing.in(Easing.cubic) }),
      withTiming(-90, { duration: 0 }), // instant jump to start of face-reveal phase
      withTiming(0, { duration: 100, easing: Easing.out(Easing.cubic) })
    );
  }, [flipped, instant, rotateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <AnimatedView style={[{ width, height }, animatedStyle]}>
      {/* Both children are position:absolute — wrapper provides the bounding box */}
      <View style={{ width, height }}>
        {!showFace && <CardBack width={width} height={height} />}
        {showFace && <CardFace card={card.id} width={width} height={height} />}
      </View>
    </AnimatedView>
  );
}
