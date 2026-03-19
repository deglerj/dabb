# Felt Texture Improvement — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Problem

The current felt shader (`packages/game-canvas/src/table/shaders.ts`) uses only two low-frequency value-noise octaves (scales 0.08 and 0.2). This produces large ~12px blobs that look like a blurry, heavily compressed image rather than real fabric.

## Solution

Replace the noise calculation in `FELT_SHADER_SOURCE` with a combined fBm + anisotropic fiber approach:

### 1. fBm base (4 octaves)

Add an `fbm(p)` helper that sums 4 octaves of the existing `noise()` function. Parameters: starting frequency 0.04, lacunarity 2.0 (frequency doubles each octave), starting amplitude 0.5, gain 0.5 (amplitude halves each octave). Sum = 0.5 + 0.25 + 0.125 + 0.0625 = 0.9375; normalize by dividing by this sum so the output is in [0, 1]. This adds fine fractal detail and eliminates the blocky look.

### 2. Anisotropic fiber layer (2 noise calls)

Sample noise at stretched coordinates — frequency 0.10 in X, 0.022 in Y (anisotropy ratio ~4.5:1, simulating fine linen rather than coarse burlap). Apply a Y-warp first: `warp = noise(fragCoord * 0.018) * 5.0` (warp magnitude ~5 px keeps fibers subtly irregular without blobbiness). Then sample fiber: `noise(vec2(fragCoord.x * 0.10, (fragCoord.y + warp) * 0.022))`. The fiber sample is already in [0, 1].

### 3. Blend

`n = base * 0.45 + fiber * 0.55` — both `base` and `fiber` are in [0, 1] before blending, so `n` is also in [0, 1]. Fibers slightly dominant for woven character, fBm prevents mechanical repetition.

### 4. Total noise evaluations: 6

Within the "balanced" budget (4 fBm + 1 warp + 1 fiber), safe for low-end Android via Skia RuntimeEffect.

## Scope

- **One file changed:** `packages/game-canvas/src/table/shaders.ts`
- `WOOD_SHADER_SOURCE` untouched
- No new files, no API changes, no uniform changes (`iResolution` stays the same)
- Verify visually in the running app (no unit tests for shader output, per existing comment)
