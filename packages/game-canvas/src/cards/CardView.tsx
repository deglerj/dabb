import React, { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Platform, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

const AnimatedView = Animated.createAnimatedComponent(View);
import type { CardId } from '@dabb/shared-types';
import { CardFace } from './CardFace.js';
import { CardBack } from './CardBack.js';
import { createCardGesture } from './dragGesture.js';
import type { SkiaEffects } from '../table/useSkiaEffects.js';

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
  effects?: SkiaEffects;
  /** If provided, card snaps to this position on mount before animating to targetX. */
  initialX?: number;
  /** If provided, card arcs from this Y position on mount. */
  initialY?: number;
  dimmed?: boolean;
  selected?: boolean;
  highlighted?: boolean;
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
  effects,
  dimmed = false,
  selected = false,
  highlighted = false,
}: CardViewProps) {
  // Snap to initial position on mount (or target if no initial given)
  const x = useSharedValue(initialX ?? targetX);
  const y = useSharedValue(initialY ?? targetY);
  const rotation = useSharedValue(targetRotation);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hoverLiftY = useSharedValue(0);
  const hoverScaleMult = useSharedValue(1);
  const hoverRotDelta = useSharedValue(0);
  const isHovered = useRef(false);
  const isFirstRender = useRef(true);
  // On web, RN Web's style system silently drops CSS properties it doesn't know about
  // (e.g. outline, will-change). Setting them directly on the DOM element bypasses this.
  // outline:transparent + will-change:transform forces Firefox into its AA compositing path.
  const viewRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const el = viewRef.current as unknown as HTMLElement | null;
    if (el?.style) {
      el.style.outline = '1px solid transparent';
      el.style.willChange = 'transform';
    }
  }, []);

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

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el?.style) {
      return;
    }

    const cfg = { duration: 150, easing: Easing.out(Easing.quad) };

    const onEnter = () => {
      isHovered.current = true;
      hoverLiftY.value = withTiming(-18, cfg);
      hoverScaleMult.value = withTiming(1.05, cfg);
      hoverRotDelta.value = withTiming(targetRotation, cfg);
    };

    const onLeave = () => {
      isHovered.current = false;
      hoverLiftY.value = withTiming(0, cfg);
      hoverScaleMult.value = withTiming(1, cfg);
      hoverRotDelta.value = withTiming(0, cfg);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    // targetRotation changed while cursor is still over this card — snap delta immediately
    // so the card stays at 0° rotation. Known: rotation.value is mid-animation at this point,
    // so a brief (~150 ms) non-zero net rotation is possible before it catches up. Accepted.
    if (isHovered.current) {
      hoverRotDelta.value = targetRotation; // snap, no animation
    }

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      // isHovered is intentionally NOT reset: the cleanup + re-run is synchronous,
      // so no mouseleave fires between them, and the ref stays accurate.
    };
  }, [targetRotation, hoverLiftY, hoverScaleMult, hoverRotDelta]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: x.value + translateX.value,
    top: y.value + translateY.value + hoverLiftY.value,
    zIndex,
    // perspective forces Firefox into its 3D compositing path, which applies DEAA
    // (distance-to-edge anti-aliasing) on rotated elements — the key fix for Firefox aliasing.
    transform: [
      { perspective: 1000 },
      { rotate: `${rotation.value - hoverRotDelta.value}deg` },
      { scale: scale.value * hoverScaleMult.value },
    ],
    backfaceVisibility: 'hidden' as const,
  }));

  const gesture = createCardGesture({
    draggable,
    onTap,
    onDrop,
    translateX,
    translateY,
    scale,
    effects,
  });

  return (
    <GestureDetector gesture={gesture}>
      <AnimatedView
        ref={viewRef}
        style={animatedStyle}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        {card !== null ? (
          <CardFace card={card} width={width} height={height} dimmed={dimmed} />
        ) : (
          <CardBack width={width} height={height} />
        )}
        {selected && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height,
              borderRadius: width * 0.06,
              borderWidth: 3,
              borderColor: '#f39c12',
            }}
            pointerEvents="none"
          />
        )}
        {highlighted && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height,
              borderRadius: width * 0.06,
              borderWidth: 2,
              borderColor: '#ffd700',
            }}
            pointerEvents="none"
          />
        )}
      </AnimatedView>
    </GestureDetector>
  );
}
