/**
 * CelebrationLayer — full-screen particle overlay for round/game wins.
 * Always mounted; visibility controlled via opacity per CLAUDE.md rule 2.
 *
 * - showConfetti: local player won the round bid (confetti + "You won the round!")
 * - showFireworks: local player won the game (fireworks + "You won the game!")
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';

export interface CelebrationLayerProps {
  confettiRound: number; // 0 = no confetti, >0 = round that triggered it
  showFireworks: boolean;
  isTeamGame?: boolean;
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

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

export function CelebrationLayer({
  confettiRound,
  showFireworks,
  isTeamGame,
}: CelebrationLayerProps) {
  const { width, height } = useGameDimensions();
  const { t } = useTranslation();
  const containerRef = useRef<View>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const particles = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');

  // Create the backing canvas once and keep it sized to the game dimensions.
  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
    ctxRef.current = ctx;

    return () => {
      ctxRef.current = null;
      container.removeChild(canvas);
    };
  }, [width, height]);

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
    ctxRef.current?.clearRect(0, 0, width, height);
    setMessage('');
  }, [width, height]);

  const startAnimation = useCallback(
    (isConfetti: boolean) => {
      stopAnimation();
      particles.current = isConfetti
        ? createConfetti(width, height)
        : createFireworks(width, height);
      const gravity = isConfetti ? 0.12 : 0.05;

      let msg: string;
      if (isConfetti) {
        msg = isTeamGame ? t('game.teamWonRound') : t('game.youWonRound');
      } else {
        msg = isTeamGame ? t('game.teamWonGame') : t('game.youWonGame');
      }
      setMessage(msg);

      const animate = () => {
        stepParticles(particles.current, gravity);
        const ctx = ctxRef.current;
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          drawParticles(ctx, particles.current);
        }
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      timerRef.current = setTimeout(stopAnimation, PARTICLE_LIFETIME_MS);
    },
    [width, height, stopAnimation, t, isTeamGame]
  );

  useEffect(() => {
    if (confettiRound > 0) {
      startAnimation(true);
    } else if (showFireworks) {
      startAnimation(false);
    } else {
      stopAnimation();
    }
    return stopAnimation;
  }, [confettiRound, showFireworks, startAnimation, stopAnimation]);

  const visible = message !== '';

  return (
    <View style={[styles.overlay, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      <View ref={containerRef} style={StyleSheet.absoluteFill} />
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
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
});
