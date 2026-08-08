import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { View } from '@dabb/rn-compat';
import type { CardId } from '@dabb/shared-types';
import { CardFace } from './CardFace.js';
import { CardBack } from './CardBack.js';
import { attachCardDrag } from './dragGesture.js';
import type { TableEffects } from '../table/useTableEffects.js';

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
  effects?: TableEffects;
  /** If provided, card snaps to this position on mount before animating to targetX. */
  initialX?: number;
  /** If provided, card arcs from this Y position on mount. */
  initialY?: number;
  dimmed?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  isTrump?: boolean;
}

const DEFAULT_W = 70;
const DEFAULT_H = 105;
const ARC_LIFT_PX = 60;

const EASE_OUT_CUBIC = 'cubic-bezier(0.215,0.61,0.355,1)';
const EASE_IN_CUBIC = 'cubic-bezier(0.55,0.055,0.675,0.19)';
const EASE_OUT_QUAD = 'cubic-bezier(0.25,0.46,0.45,0.94)';
// Approximates the old withSpring(damping, stiffness) calls with a CSS curve that overshoots
// slightly then settles — a spring "feel" without a physics/animation dependency.
const SPRING_EASE = 'cubic-bezier(0.34,1.56,0.64,1)';
const HOVER_MS = 150;
const SPRING_MS = 300;

interface StyleOptions {
  leftMs?: number;
  leftEasing?: string;
  topMs?: number;
  topEasing?: string;
  transformMs?: number;
  transformEasing?: string;
}

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
  isTrump = false,
}: CardViewProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(initialX ?? targetX);
  const yRef = useRef(initialY ?? targetY);
  const rotationRef = useRef(targetRotation);
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const hoverLiftYRef = useRef(0);
  const hoverScaleMultRef = useRef(1);
  const hoverRotDeltaRef = useRef(0);
  const isHovered = useRef(false);
  const isFirstRender = useRef(true);

  // left/top/transform are driven entirely imperatively (never part of the RN `style` prop) —
  // matches the outline/will-change escape hatch below: RN Web's style system silently drops
  // CSS properties it doesn't know about (e.g. `transition`), so anything that needs to
  // transition has to be set directly on the DOM node.
  const applyStyle = useCallback((el: HTMLElement, opts: StyleOptions = {}) => {
    const lMs = opts.leftMs ?? 0;
    const lEase = opts.leftEasing ?? 'linear';
    const tMs = opts.topMs ?? 0;
    const tEase = opts.topEasing ?? 'linear';
    const trMs = opts.transformMs ?? 0;
    const trEase = opts.transformEasing ?? 'linear';
    el.style.transition = `left ${lMs}ms ${lEase}, top ${tMs}ms ${tEase}, transform ${trMs}ms ${trEase}`;
    el.style.left = `${xRef.current + translateXRef.current}px`;
    el.style.top = `${yRef.current + translateYRef.current + hoverLiftYRef.current}px`;
    el.style.transform = `perspective(1000px) rotate(${rotationRef.current - hoverRotDeltaRef.current}deg) scale(${scaleRef.current * hoverScaleMultRef.current})`;
  }, []);

  // Mount: paint instantly at the starting position, no transition, plus the outline/will-change
  // hack (outline:transparent + will-change:transform forces Firefox into its AA compositing path).
  useLayoutEffect(() => {
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el?.style) {
      return;
    }
    el.style.position = 'absolute';
    el.style.outline = '1px solid transparent';
    el.style.willChange = 'transform';
    el.style.backfaceVisibility = 'hidden';
    applyStyle(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate toward the target position/rotation whenever it changes (also fires once on mount,
  // immediately after the instant paint above).
  useLayoutEffect(() => {
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el?.style) {
      return;
    }
    const firstRender = isFirstRender.current;
    isFirstRender.current = false;

    if (firstRender) {
      // Force the browser to commit the instant mount-state before enabling a transition,
      // otherwise the two style writes can get coalesced into one with no visible animation.
      void el.offsetHeight;
    }

    if (firstRender && initialY !== undefined) {
      // Arc: rise to peak then drop to target, split evenly across animationDuration.
      const peakY = (initialY + targetY) / 2 - ARC_LIFT_PX;
      const half = Math.round(animationDuration / 2);
      xRef.current = targetX;
      rotationRef.current = targetRotation;
      yRef.current = peakY;
      applyStyle(el, {
        leftMs: half,
        leftEasing: EASE_OUT_CUBIC,
        topMs: half,
        topEasing: EASE_OUT_CUBIC,
        transformMs: half,
        transformEasing: EASE_OUT_CUBIC,
      });
      const timeoutId = setTimeout(() => {
        const el2 = viewRef.current as unknown as HTMLElement | null;
        if (!el2?.style) {
          return;
        }
        yRef.current = targetY;
        applyStyle(el2, {
          leftMs: half,
          leftEasing: EASE_IN_CUBIC,
          topMs: half,
          topEasing: EASE_IN_CUBIC,
          transformMs: half,
          transformEasing: EASE_IN_CUBIC,
        });
      }, half);
      return () => clearTimeout(timeoutId);
    }

    xRef.current = targetX;
    rotationRef.current = targetRotation;
    yRef.current = targetY;
    applyStyle(el, {
      leftMs: animationDuration,
      leftEasing: EASE_OUT_CUBIC,
      topMs: animationDuration,
      topEasing: EASE_OUT_CUBIC,
      transformMs: animationDuration,
      transformEasing: EASE_OUT_CUBIC,
    });
  }, [targetX, targetY, targetRotation, animationDuration, initialY, applyStyle]);

  // Mouse hover: lift + scale up slightly.
  useEffect(() => {
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el?.style) {
      return;
    }

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        return;
      }
      isHovered.current = true;
      hoverLiftYRef.current = -18;
      hoverScaleMultRef.current = 1.05;
      hoverRotDeltaRef.current = targetRotation;
      applyStyle(el, {
        topMs: HOVER_MS,
        topEasing: EASE_OUT_QUAD,
        transformMs: HOVER_MS,
        transformEasing: EASE_OUT_QUAD,
      });
    };

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        return;
      }
      isHovered.current = false;
      hoverLiftYRef.current = 0;
      hoverScaleMultRef.current = 1;
      hoverRotDeltaRef.current = 0;
      applyStyle(el, {
        topMs: HOVER_MS,
        topEasing: EASE_OUT_QUAD,
        transformMs: HOVER_MS,
        transformEasing: EASE_OUT_QUAD,
      });
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);

    // targetRotation changed while the cursor is still over this card — snap the delta
    // immediately (no transition) so the card stays at 0° rotation.
    if (isHovered.current) {
      const prevTransition = el.style.transition;
      el.style.transition = 'none';
      hoverRotDeltaRef.current = targetRotation;
      applyStyle(el);
      void el.offsetHeight;
      el.style.transition = prevTransition;
    }

    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [targetRotation, applyStyle]);

  // Drag-to-play.
  useEffect(() => {
    const el = viewRef.current as unknown as HTMLElement | null;
    if (!el) {
      return;
    }
    return attachCardDrag(el, {
      draggable,
      onTap,
      onDrop,
      effects,
      onDragStart: () => {
        scaleRef.current = 1.08;
        applyStyle(el, { transformMs: SPRING_MS, transformEasing: SPRING_EASE });
      },
      onDragMove: (dx, dy) => {
        translateXRef.current = dx;
        translateYRef.current = dy;
        applyStyle(el); // instant, no transition — 1:1 pointer follow
      },
      onDragEnd: () => {
        translateXRef.current = 0;
        translateYRef.current = 0;
        scaleRef.current = 1;
        applyStyle(el, {
          leftMs: SPRING_MS,
          leftEasing: SPRING_EASE,
          topMs: SPRING_MS,
          topEasing: SPRING_EASE,
          transformMs: SPRING_MS,
          transformEasing: SPRING_EASE,
        });
      },
    });
  }, [draggable, onTap, onDrop, effects, applyStyle]);

  return (
    <View ref={viewRef} style={{ position: 'absolute', zIndex }}>
      {card !== null ? (
        <CardFace card={card} width={width} height={height} dimmed={dimmed} isTrump={isTrump} />
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
    </View>
  );
}
