/**
 * Skia RuntimeEffect shader source strings.
 * Compiled at runtime via Skia.RuntimeEffect.Make(source).
 * Verify visually in the running app — no unit tests for shader output.
 */

/** Felt fabric noise shader. Uniforms: vec2 iResolution */
export const FELT_SHADER_SOURCE = `
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

half4 main(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution;
  vec3 feltGreen = vec3(0.176, 0.353, 0.149);
  float n = noise(fragCoord * 0.08) + noise(fragCoord * 0.2) * 0.4;
  n /= 1.4;
  vec2 c = uv - 0.5;
  float vignette = clamp(1.0 - dot(c, c) * 1.2, 0.0, 1.0);
  vec3 color = feltGreen * (0.88 + n * 0.12) * vignette;
  return half4(color, 1.0);
}
`;

/** Wood grain shader. Uniforms: vec2 iResolution */
export const WOOD_SHADER_SOURCE = `
uniform vec2 iResolution;

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise1d(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

half4 main(vec2 fragCoord) {
  float warp = noise1d(fragCoord.y * 0.02) * 20.0;
  float grain = noise1d((fragCoord.y + warp) * 0.15) + noise1d((fragCoord.y + warp) * 0.4) * 0.4;
  grain /= 1.4;
  vec3 woodBase = vec3(0.60, 0.36, 0.18);
  vec3 woodDark = vec3(0.38, 0.20, 0.08);
  vec3 color = mix(woodDark, woodBase, grain);
  vec2 uv = fragCoord / iResolution;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  color *= (0.75 + smoothstep(0.0, 0.12, edge) * 0.25);
  return half4(color, 1.0);
}
`;
