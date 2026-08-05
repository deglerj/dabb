/**
 * GameTable
 *
 * Full-bleed table background and drag/trick effects, rendered onto plain
 * <canvas> elements (created imperatively via a View ref, matching the
 * CardFace/CardBack DOM-escape-hatch pattern used elsewhere in this package):
 * - Static: wood surround + felt surface, each a WebGL1 fragment shader
 *   (ported from the original Skia SkSL), redrawn only on resize.
 * - Dynamic (via effects prop): card shadow, felt ripple, sweep particles,
 *   drawn on a 2D canvas via a requestAnimationFrame loop.
 *
 * Usage:
 *   const effects = useSkiaEffects();
 *   <GameTable width={w} height={h} effects={effects} />
 */

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { DEFAULT_SURROUND_FRACTION } from './feltBounds.js';
import { FELT_SHADER_SOURCE, WOOD_SHADER_SOURCE, SHADER_VERTEX_SOURCE } from './shaders.js';
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
const PARTICLE_ANGLES = [
  0,
  Math.PI / 3,
  (2 * Math.PI) / 3,
  Math.PI,
  (4 * Math.PI) / 3,
  (5 * Math.PI) / 3,
];

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

/** Renders a static (no time uniform) full-bleed fragment shader, redrawn only when its size changes. */
function ShaderLayer({
  width,
  height,
  source,
  style,
}: {
  width: number;
  height: number;
  source: string;
  style: ViewStyle;
}) {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container || width <= 0 || height <= 0) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl');
    if (!gl) {
      return () => container.removeChild(canvas);
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, SHADER_VERTEX_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, source);
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create WebGL program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);

    // Full-screen triangle (covers clip space in one draw call, no center seam)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, 'iResolution');
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      container.removeChild(canvas);
    };
  }, [width, height, source]);

  return <View ref={containerRef} style={style} pointerEvents="none" />;
}

/** Drag shadow, felt landing ripple, and trick-win sweep particles — drawn on a 2D canvas each frame. */
function EffectsLayer({
  width,
  height,
  effects,
}: {
  width: number;
  height: number;
  effects: SkiaEffects;
}) {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container || width <= 0 || height <= 0) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return () => container.removeChild(canvas);
    }
    ctx.scale(dpr, dpr);

    let rafId: number;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const shadowElevation = effects.shadowElevation.value;
      if (shadowElevation > 0) {
        const x = effects.shadowX.value - CARD_W / 2;
        const y = effects.shadowY.value - CARD_H / 2 + SHADOW_OFFSET_Y * shadowElevation;
        ctx.save();
        ctx.filter = `blur(${6 + shadowElevation * 8}px)`;
        ctx.fillStyle = `rgba(0,0,0,${shadowElevation * 0.45})`;
        ctx.beginPath();
        ctx.roundRect(x, y, CARD_W, CARD_H, CARD_CORNER_R);
        ctx.fill();
        ctx.restore();
      }

      const rippleProgress = effects.rippleProgress.value;
      if (rippleProgress < 1) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${(1 - rippleProgress) * 0.25})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(effects.rippleX.value, effects.rippleY.value, rippleProgress * 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const particleProgress = effects.particleProgress.value;
      if (particleProgress < 1) {
        ctx.save();
        ctx.fillStyle = `rgba(255,220,80,${(1 - particleProgress) * 0.85})`;
        for (const angle of PARTICLE_ANGLES) {
          const cx =
            effects.particleX.value + Math.cos(angle) * particleProgress * PARTICLE_SCATTER;
          const cy =
            effects.particleY.value + Math.sin(angle) * particleProgress * PARTICLE_SCATTER;
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeChild(canvas);
    };
  }, [width, height, effects]);

  return (
    <View
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width, height }}
      pointerEvents="none"
    />
  );
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

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width, height }}
      pointerEvents="none"
    >
      <ShaderLayer
        width={width}
        height={height}
        source={WOOD_SHADER_SOURCE}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
      />
      <View
        style={{
          position: 'absolute',
          top: surround,
          left: surround,
          width: feltW,
          height: feltH,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <ShaderLayer
          width={feltW}
          height={feltH}
          source={FELT_SHADER_SOURCE}
          style={{ width: feltW, height: feltH }}
        />
      </View>
      <EffectsLayer width={width} height={height} effects={effects} />
    </View>
  );
}
