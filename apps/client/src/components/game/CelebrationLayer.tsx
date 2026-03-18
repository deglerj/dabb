/**
 * CelebrationLayer — full-screen Skia particle overlay for round/game wins.
 * Always mounted; visibility controlled via opacity per CLAUDE.md rule 2.
 *
 * - showConfetti: local player won the round bid (confetti + "You won the round!")
 * - showFireworks: local player won the game (fireworks + "You won the game!")
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';

export interface CelebrationLayerProps {
  showConfetti: boolean;
  showFireworks: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  color: string;
  w: number;
  h: number;
  opacity: number;
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f40'];
const FIREWORK_COLORS = ['#ffd93d', '#ff6b6b', '#4d96ff', '#c77dff', '#6bcb77', '#ffffff'];
const PARTICLE_LIFETIME_MS = 3000;

function createConfetti(width: number, _height: number): Particle[] {
  return Array.from({ length: 60 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.15,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: 7 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    opacity: 1,
  }));
}

function createFireworks(width: number, height: number): Particle[] {
  const origins = [
    { x: width * 0.25, y: height * 0.35 },
    { x: width * 0.75, y: height * 0.25 },
    { x: width * 0.5, y: height * 0.45 },
  ];
  const particles: Particle[] = [];
  for (const origin of origins) {
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        vr: 0,
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        w: 4,
        h: 4,
        opacity: 1,
      });
    }
  }
  return particles;
}

function stepParticles(particles: Particle[], gravity: number): void {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += gravity;
    p.rotation += p.vr;
    p.opacity = Math.max(0, p.opacity - 0.008);
  }
}

export function CelebrationLayer({ showConfetti, showFireworks }: CelebrationLayerProps) {
  const { width, height } = useWindowDimensions();
  const particles = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [_tick, setTick] = useState(0);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    particles.current = [];
    setTick((t) => t + 1);
  }, []);

  const startAnimation = useCallback(
    (isConfetti: boolean) => {
      stopAnimation();
      particles.current = isConfetti
        ? createConfetti(width, height)
        : createFireworks(width, height);
      const gravity = isConfetti ? 0.12 : 0.05;

      const animate = () => {
        stepParticles(particles.current, gravity);
        setTick((t) => t + 1);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      timerRef.current = setTimeout(stopAnimation, PARTICLE_LIFETIME_MS);
    },
    [width, height, stopAnimation]
  );

  useEffect(() => {
    if (showConfetti) {
      startAnimation(true);
    } else if (showFireworks) {
      startAnimation(false);
    } else {
      stopAnimation();
    }
    return stopAnimation;
  }, [showConfetti, showFireworks]);

  const visible = showConfetti || showFireworks || particles.current.length > 0;
  const message = showFireworks ? 'You won the game!' : showConfetti ? 'You won the round!' : '';

  return (
    <View style={[styles.overlay, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {particles.current.map((p, i) => (
          // Use translate-based pivot for rotation (origin prop not reliable across Skia v2 versions)
          <Group
            key={i}
            transform={[
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rotation },
              { translateX: -p.x },
              { translateY: -p.y },
            ]}
          >
            <Rect
              x={p.x - p.w / 2}
              y={p.y - p.h / 2}
              width={p.w}
              height={p.h}
              color={p.color}
              opacity={p.opacity}
            />
          </Group>
        ))}
      </Canvas>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    pointerEvents: 'none',
  },
  message: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
});
