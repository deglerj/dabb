/**
 * GameTable
 *
 * Full-bleed Skia <Canvas> rendering:
 * - Static: wood surround, felt surface, trick zone border
 * - Dynamic (via effects prop): card shadow, felt ripple, sweep particles
 *
 * Usage:
 *   const effects = useSkiaEffects();
 *   <GameTable width={w} height={h} effects={effects} />
 */

import React, { useMemo } from 'react';
import { Canvas, Fill, Path, Skia, Circle, rect, rrect, Shader } from '@shopify/react-native-skia';
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

  // Trick zone oval
  const trickPath = useMemo(() => {
    const path = Skia.Path.Make();
    const cx = width / 2;
    const cy = height / 2;
    path.addOval(Skia.XYWHRect(cx - width * 0.22, cy - height * 0.18, width * 0.44, height * 0.36));
    return path;
  }, [width, height]);

  // Shadow circle driven by shared value
  const shadowOpacity = useDerivedValue(() => effects.shadow.value.elevation * 0.4);
  const shadowRadius = useDerivedValue(() => 20 + effects.shadow.value.elevation * 30);
  const shadowX = useDerivedValue(() => effects.shadow.value.x);
  const shadowY = useDerivedValue(() => effects.shadow.value.y);

  // Ripple circle driven by shared value
  const rippleOpacity = useDerivedValue(() => (1 - effects.ripple.value.progress) * 0.25);
  const rippleRadius = useDerivedValue(() => effects.ripple.value.progress * 60);
  const rippleX = useDerivedValue(() => effects.ripple.value.x);
  const rippleY = useDerivedValue(() => effects.ripple.value.y);

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

      {/* Trick zone border */}
      <Path path={trickPath} color="rgba(255,255,255,0.10)" style="stroke" strokeWidth={1.5} />

      {/* Flying card shadow */}
      <Circle
        cx={shadowX}
        cy={shadowY}
        r={shadowRadius}
        color="rgba(0,0,0,1)"
        opacity={shadowOpacity}
      />

      {/* Felt ripple on card land */}
      <Circle
        cx={rippleX}
        cy={rippleY}
        r={rippleRadius}
        color="rgba(255,255,255,1)"
        style="stroke"
        strokeWidth={1.5}
        opacity={rippleOpacity}
      />
    </Canvas>
  );
}
