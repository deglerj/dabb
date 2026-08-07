/**
 * FlippableCard — a card that animates from back to face via a rotateY flip.
 *
 * When flipped transitions false→true (and instant=false), plays a 200ms 3D flip.
 * When instant=true, snaps immediately to face-up (cancels any in-progress animation).
 * When flipped is already true on mount, renders face immediately (no animation).
 */
import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import type { Card } from '@dabb/shared-types';
import { CardBack } from './CardBack.js';
import { CardFace } from './CardFace.js';

export interface FlippableCardProps {
  card: Card; // card.id is passed to CardFace internally
  flipped: boolean;
  instant: boolean; // when true, snaps to face without animation
  width: number;
  height: number;
}

const EASE_IN_CUBIC = 'cubic-bezier(0.55,0.055,0.675,0.19)';
const EASE_OUT_CUBIC = 'cubic-bezier(0.215,0.61,0.355,1)';

export function FlippableCard({ card, flipped, instant, width, height }: FlippableCardProps) {
  // showFace drives which side is rendered; starts true if already flipped on mount
  const [showFace, setShowFace] = useState(flipped);
  const containerRef = useRef<View>(null);
  // Prevent re-triggering animation if already fired
  const hasFlipped = useRef(flipped);

  useEffect(() => {
    const el = containerRef.current as unknown as HTMLElement | null;

    if (!flipped) {
      return;
    }

    if (instant) {
      if (el?.style) {
        el.style.transition = 'none';
        el.style.transform = 'perspective(800px) rotateY(0deg)';
      }
      setShowFace(true);
      hasFlipped.current = true;
      return;
    }

    if (hasFlipped.current) {
      return; // already animated or already face-up on mount
    }
    hasFlipped.current = true;

    if (!el?.style) {
      setShowFace(true);
      return;
    }

    // Phase 1: back rotates to edge-on (0deg -> 90deg)
    el.style.transition = `transform 100ms ${EASE_IN_CUBIC}`;
    el.style.transform = 'perspective(800px) rotateY(90deg)';

    const timeoutId = setTimeout(() => {
      const el2 = containerRef.current as unknown as HTMLElement | null;
      if (!el2?.style) {
        return;
      }
      // Instant jump to the start of the face-reveal phase, content swap happens while
      // edge-on (effectively invisible), then phase 2 rotates the face in from the other side.
      el2.style.transition = 'none';
      el2.style.transform = 'perspective(800px) rotateY(-90deg)';
      setShowFace(true);
      void el2.offsetHeight;
      el2.style.transition = `transform 100ms ${EASE_OUT_CUBIC}`;
      el2.style.transform = 'perspective(800px) rotateY(0deg)';
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [flipped, instant]);

  return (
    <View ref={containerRef} style={{ width, height }}>
      {/* Both children are position:absolute — wrapper provides the bounding box */}
      <View style={{ width, height }}>
        {/* Show CardBack if face isn't revealed yet, or if the card data is still hidden (placeholder) */}
        {(!showFace || card.id.startsWith('hidden-')) && <CardBack width={width} height={height} />}
        {showFace && !card.id.startsWith('hidden-') && (
          <CardFace card={card.id} width={width} height={height} />
        )}
      </View>
    </View>
  );
}
