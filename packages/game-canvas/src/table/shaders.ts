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

// Macro color variation, used both as color blend and as a height field for
// fake normals below (no derivative extension in WebGL1).
float feltHeight(vec2 p) {
  return fbm(p * 0.031);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;

  float h = feltHeight(fragCoord);

  // Central-difference bump normal, for soft ambient shading across the weave.
  float e = 1.0;
  float hx = feltHeight(fragCoord + vec2(e, 0.0)) - feltHeight(fragCoord - vec2(e, 0.0));
  float hy = feltHeight(fragCoord + vec2(0.0, e)) - feltHeight(fragCoord - vec2(0.0, e));
  vec3 normal = normalize(vec3(-hx * 3.0, -hy * 3.0, 1.0));

  vec3 lightDir = normalize(vec3(-0.35, -0.55, 0.75));
  float diffuse = max(dot(normal, lightDir), 0.0);

  // Kajiya-Kay anisotropic sheen along a fixed fiber direction: felt/velvet catches
  // light differently along vs across the weave, unlike wood's isotropic highlight.
  vec3 tangent = normalize(vec3(0.899, -0.438, 0.0));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float tDotH = dot(tangent, halfDir);
  float sheen = pow(sqrt(max(0.0, 1.0 - tDotH * tDotH)), 8.0);

  vec3 feltDeep = vec3(0.062, 0.154, 0.062);
  vec3 feltLit = vec3(0.141, 0.264, 0.122);
  vec3 base = mix(feltDeep, feltLit, h);

  vec3 color = base * (0.61 + diffuse * 0.43) + sheen * vec3(0.55, 0.75, 0.55) * 0.24;

  vec2 c = uv - 0.5;
  float vignette = clamp(1.0 - dot(c, c) * 0.9, 0.0, 1.0);
  color *= (0.85 + vignette * 0.15);

  gl_FragColor = vec4(color, 1.0);
}
`;

/** Wood grain shader. Uniforms: vec2 iResolution */
export const WOOD_SHADER_SOURCE = `
precision highp float;
uniform vec2 iResolution;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise1d(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Grain lines (1D) plus fine pore noise (2D), used both as color blend and
// as a height field for fake normals below (no derivative extension in WebGL1).
float woodHeight(vec2 p) {
  float warp = noise1d(p.y * 0.02) * 20.0;
  float grain = noise1d((p.y + warp) * 0.15) + noise1d((p.y + warp) * 0.4) * 0.4;
  grain /= 1.4;
  float pore = noise2d(p * 0.9) * 0.15;
  return grain * 0.85 + pore;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;

  float h = woodHeight(fragCoord);

  // Central-difference bump normal, lit for a matte satin finish (not varnish-glossy).
  float e = 1.0;
  float hx = woodHeight(fragCoord + vec2(e, 0.0)) - woodHeight(fragCoord - vec2(e, 0.0));
  float hy = woodHeight(fragCoord + vec2(0.0, e)) - woodHeight(fragCoord - vec2(0.0, e));
  vec3 normal = normalize(vec3(-hx * 4.0, -hy * 4.0, 1.0));

  vec3 lightDir = normalize(vec3(-0.4, -0.5, 0.8));
  float diffuse = max(dot(normal, lightDir), 0.0);
  float specular = pow(max(dot(normal, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0), 90.0);

  vec3 woodDark = vec3(0.32, 0.17, 0.07);
  vec3 woodBase = vec3(0.62, 0.38, 0.19);
  vec3 color = mix(woodDark, woodBase, h);
  color *= (0.6 + diffuse * 0.7);
  color += specular * 0.08;

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  color *= (0.7 + smoothstep(0.0, 0.12, edge) * 0.3);

  gl_FragColor = vec4(color, 1.0);
}
`;
