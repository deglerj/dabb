/**
 * PhaseOverlay — animated wrapper that slides/fades content in and out.
 *
 * visible=true  → fade in + slide up from -40px + scale from 0.92
 * visible=false → fade out + slide to -20px + scale to 0.95
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from '@dabb/rn-compat';

export interface PhaseOverlayProps {
  visible: boolean;
  rotation?: number;
  children: React.ReactNode;
}

const EASE_OUT_CUBIC = 'cubic-bezier(0.215,0.61,0.355,1)';
const EASE_IN_CUBIC = 'cubic-bezier(0.55,0.055,0.675,0.19)';
// Approximates the old withSpring(damping:18, stiffness:200) with a slight overshoot.
const SPRING_EASE = 'cubic-bezier(0.34,1.56,0.64,1)';

export function PhaseOverlay({ visible, rotation = -2, children }: PhaseOverlayProps) {
  const { height: screenHeight } = useWindowDimensions();
  const containerRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0);
  const [translateY, setTranslateY] = useState(-40);
  const [scale, setScale] = useState(0.92);

  useEffect(() => {
    // transition isn't a recognized RN style prop, so RN Web would silently drop it if set
    // via the `style` prop — set it directly on the DOM node instead.
    const el = containerRef.current as unknown as HTMLElement | null;
    if (el?.style) {
      el.style.transition = visible
        ? `opacity 220ms ${EASE_OUT_CUBIC}, transform 220ms ${SPRING_EASE}`
        : `opacity 180ms ${EASE_IN_CUBIC}, transform 180ms ${EASE_IN_CUBIC}`;
    }
    if (visible) {
      setOpacity(1);
      setTranslateY(0);
      setScale(1);
    } else {
      setOpacity(0);
      setTranslateY(-20);
      setScale(0.95);
    }
  }, [visible]);

  const maxPaperHeight = screenHeight * 0.7;

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        { opacity, transform: [{ translateY }, { scale }, { rotate: `${rotation}deg` }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={[styles.paper, { maxHeight: maxPaperHeight }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      </View>
    </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 240,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
});
