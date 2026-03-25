/**
 * GameTable
 *
 * Full-bleed Skia <Canvas> rendering:
 * - Static: wood surround, felt surface
 * - Dynamic (via effects prop): card shadow, felt ripple, sweep particles
 *
 * Usage:
 *   const effects = useSkiaEffects();
 *   <GameTable width={w} height={h} effects={effects} />
 */

import React, { useMemo } from 'react';
import {
  Canvas,
  Fill,
  Skia,
  Circle,
  RoundedRect,
  BlurMask,
  rect,
  rrect,
  Shader,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { DEFAULT_SURROUND_FRACTION } from './feltBounds.js';
import { FELT_SHADER_SOURCE, WOOD_SHADER_SOURCE } from './shaders.js';
import type { SkiaEffects } from './useSkiaEffects.js';

export interface GameTableProps {
  width: number;
  height: number;
  effects: SkiaEffects;
  surroundFraction?: number;
}

// Card dimensions (must match CardView defaults)
const CARD_W = 70;
const CARD_H = 105;
const CARD_CORNER_R = 6;
// Shadow: slight downward offset simulates overhead light source
const SHADOW_OFFSET_Y = 8;

// 6 particles evenly spaced around a circle
const PARTICLE_SCATTER = 45;
const A0 = 0;
const A1 = Math.PI / 3;
const A2 = (2 * Math.PI) / 3;
const A3 = Math.PI;
const A4 = (4 * Math.PI) / 3;
const A5 = (5 * Math.PI) / 3;

export function GameTable({
  width,
  height,
  effects,
  surroundFraction = DEFAULT_SURROUND_FRACTION,
}: GameTableProps) {
  const surround = Math.round(width * surroundFraction);
  const feltW = width - surround * 2;
  const feltH = height - surround * 2;

  // Compile shaders once
  const feltEffect = useMemo(() => Skia.RuntimeEffect.Make(FELT_SHADER_SOURCE)!, []);
  const woodEffect = useMemo(() => Skia.RuntimeEffect.Make(WOOD_SHADER_SOURCE)!, []);

  const feltUniforms = useMemo(() => ({ iResolution: [feltW, feltH] }), [feltW, feltH]);
  const woodUniforms = useMemo(() => ({ iResolution: [width, height] }), [width, height]);

  // Card-shaped shadow driven by shared values
  const shadowOpacity = useDerivedValue(() => effects.shadowElevation.value * 0.45);
  const shadowBlur = useDerivedValue(() => 6 + effects.shadowElevation.value * 8);
  const shadowX = useDerivedValue(() => effects.shadowX.value - CARD_W / 2);
  const shadowY = useDerivedValue(
    () => effects.shadowY.value - CARD_H / 2 + SHADOW_OFFSET_Y * effects.shadowElevation.value
  );

  // Ripple circle driven by shared values
  const rippleOpacity = useDerivedValue(() => (1 - effects.rippleProgress.value) * 0.25);
  const rippleRadius = useDerivedValue(() => effects.rippleProgress.value * 60);

  // Particle derived values — 6 circles scatter outward and fade
  const particleOpacity = useDerivedValue(() => (1 - effects.particleProgress.value) * 0.85);
  const p0cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A0) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p0cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A0) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p1cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A1) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p1cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A1) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p2cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A2) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p2cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A2) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p3cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A3) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p3cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A3) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p4cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A4) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p4cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A4) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p5cx = useDerivedValue(
    () => effects.particleX.value + Math.cos(A5) * effects.particleProgress.value * PARTICLE_SCATTER
  );
  const p5cy = useDerivedValue(
    () => effects.particleY.value + Math.sin(A5) * effects.particleProgress.value * PARTICLE_SCATTER
  );

  return (
    <Canvas
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width, height }}
      pointerEvents="none"
    >
      {/* Wood surround */}
      <Fill>
        <Shader source={woodEffect} uniforms={woodUniforms} />
      </Fill>

      {/* Felt surface */}
      <Fill clip={rrect(rect(surround, surround, feltW, feltH), 8, 8)}>
        <Shader source={feltEffect} uniforms={feltUniforms} />
      </Fill>

      {/* Flying card shadow */}
      <RoundedRect
        x={shadowX}
        y={shadowY}
        width={CARD_W}
        height={CARD_H}
        r={CARD_CORNER_R}
        color="rgba(0,0,0,1)"
        opacity={shadowOpacity}
        antiAlias
      >
        <BlurMask blur={shadowBlur} style="normal" />
      </RoundedRect>

      {/* Felt ripple on card land */}
      <Circle
        cx={effects.rippleX}
        cy={effects.rippleY}
        r={rippleRadius}
        color="rgba(255,255,255,1)"
        style="stroke"
        strokeWidth={1.5}
        opacity={rippleOpacity}
        antiAlias
      />

      {/* Trick sweep particles — 6 circles scatter from pile and fade out */}
      <Circle
        cx={p0cx}
        cy={p0cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
      <Circle
        cx={p1cx}
        cy={p1cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
      <Circle
        cx={p2cx}
        cy={p2cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
      <Circle
        cx={p3cx}
        cy={p3cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
      <Circle
        cx={p4cx}
        cy={p4cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
      <Circle
        cx={p5cx}
        cy={p5cy}
        r={3}
        color="rgba(255,220,80,1)"
        opacity={particleOpacity}
        antiAlias
      />
    </Canvas>
  );
}
