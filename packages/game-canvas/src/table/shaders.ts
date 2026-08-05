/**
 * WebGL1 (GLSL ES 1.00) fragment shader source strings, rendered once per
 * resize onto their own <canvas> (see GameTable.tsx). Direct mechanical port
 * of the original Skia SkSL runtime effects — same math, same uniform name,
 * fragCoord is `gl_FragCoord.xy` instead of a function parameter.
 * Verify visually in the running app — no unit tests for shader output.
 */

export const SHADER_VERTEX_SOURCE = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/** Felt fabric noise shader. Uniforms: vec2 iResolution */
export const FELT_SHADER_SOURCE = `
precision highp float;
uniform vec2 iResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    v += noise(p * freq) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return v / 0.9375;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec3 feltGreen = vec3(0.176, 0.353, 0.149);
  float base = fbm(fragCoord * 0.04);
  float warp = noise(fragCoord * 0.018) * 5.0;
  float fiber = noise(vec2(fragCoord.x * 0.10, (fragCoord.y + warp) * 0.022));
  float n = base * 0.45 + fiber * 0.55;
  vec2 c = uv - 0.5;
  float vignette = clamp(1.0 - dot(c, c) * 1.2, 0.0, 1.0);
  vec3 color = feltGreen * (0.85 + n * 0.18) * vignette;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Wood grain shader. Uniforms: vec2 iResolution */
export const WOOD_SHADER_SOURCE = `
precision highp float;
uniform vec2 iResolution;

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise1d(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  float warp = noise1d(fragCoord.y * 0.02) * 20.0;
  float grain = noise1d((fragCoord.y + warp) * 0.15) + noise1d((fragCoord.y + warp) * 0.4) * 0.4;
  grain /= 1.4;
  vec3 woodBase = vec3(0.60, 0.36, 0.18);
  vec3 woodDark = vec3(0.38, 0.20, 0.08);
  vec3 color = mix(woodDark, woodBase, grain);
  vec2 uv = fragCoord / iResolution;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  color *= (0.75 + smoothstep(0.0, 0.12, edge) * 0.25);
  gl_FragColor = vec4(color, 1.0);
}
`;
