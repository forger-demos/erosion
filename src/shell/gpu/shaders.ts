/**
 * The model of src/core/erosion/step.ts as fragment passes. State texture S holds (bed, water, sediment),
 * flux texture F holds (left, right, up, down) outflow; both are read at the texel of the cell and its
 * neighbours, never written in place. Stage order and every constant mirror the CPU step.
 */

export const vertexSource = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const header = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform int uN;
uniform float uDt;
uniform float uRain;
uniform float uCell;
uniform float uCellArea;
out vec4 outColor;
`;

/** Rain, then outflow flux scaled so no cell sends out more than it holds (CPU stages 1-2). */
export const fluxSource = `${header}
uniform sampler2D uS;
uniform sampler2D uF;
uniform float uK;
float wet(ivec2 q) { vec4 t = texelFetch(uS, q, 0); return t.g + uDt * uRain; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int n1 = uN - 1;
  vec4 f = texelFetch(uF, p, 0);
  float d1 = wet(p);
  float h = texelFetch(uS, p, 0).r + d1;
  float l = 0.0, r = 0.0, t = 0.0, b = 0.0;
  if (p.x > 0) { ivec2 q = p + ivec2(-1, 0); l = max(0.0, f.r + uK * (h - texelFetch(uS, q, 0).r - wet(q))); }
  if (p.x < n1) { ivec2 q = p + ivec2(1, 0); r = max(0.0, f.g + uK * (h - texelFetch(uS, q, 0).r - wet(q))); }
  if (p.y > 0) { ivec2 q = p + ivec2(0, -1); t = max(0.0, f.b + uK * (h - texelFetch(uS, q, 0).r - wet(q))); }
  if (p.y < n1) { ivec2 q = p + ivec2(0, 1); b = max(0.0, f.a + uK * (h - texelFetch(uS, q, 0).r - wet(q))); }
  float total = (l + r + t + b) * uDt;
  if (total > 0.0) {
    float scale = min(1.0, (d1 * uCellArea) / total);
    l *= scale; r *= scale; t *= scale; b *= scale;
  }
  outColor = vec4(l, r, t, b);
}`;

/** Water depth from net flux, velocity, then erosion and deposition (CPU stages 3-5). */
export const erodeSource = `${header}
uniform sampler2D uS;
uniform sampler2D uF;
uniform float uKc;
uniform float uKs;
uniform float uKd;
uniform float uDepthMax;
float bedAt(ivec2 q) { return texelFetch(uS, q, 0).r; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int n1 = uN - 1;
  vec4 st = texelFetch(uS, p, 0);
  vec4 f = texelFetch(uF, p, 0);
  float d1 = st.g + uDt * uRain;
  float fromLeft = p.x > 0 ? texelFetch(uF, p + ivec2(-1, 0), 0).g : 0.0;
  float fromRight = p.x < n1 ? texelFetch(uF, p + ivec2(1, 0), 0).r : 0.0;
  float fromUp = p.y > 0 ? texelFetch(uF, p + ivec2(0, -1), 0).a : 0.0;
  float fromDown = p.y < n1 ? texelFetch(uF, p + ivec2(0, 1), 0).b : 0.0;
  float inflow = fromLeft + fromRight + fromUp + fromDown;
  float outflow = f.r + f.g + f.b + f.a;
  float d2 = max(0.0, d1 + (uDt * (inflow - outflow)) / uCellArea);

  float vx = 0.0, vy = 0.0;
  float mean = (d1 + d2) / 2.0;
  if (mean >= 1e-4) {
    float wx = (fromLeft - f.r + f.g - fromRight) / 2.0;
    float wy = (fromUp - f.b + f.a - fromDown) / 2.0;
    vx = wx / (uCell * mean);
    vy = wy / (uCell * mean);
  }

  float b = st.r;
  float gx = (bedAt(p + ivec2(p.x < n1 ? 1 : 0, 0)) - bedAt(p + ivec2(p.x > 0 ? -1 : 0, 0))) / ((p.x > 0 && p.x < n1 ? 2.0 : 1.0) * uCell);
  float gy = (bedAt(p + ivec2(0, p.y < n1 ? 1 : 0)) - bedAt(p + ivec2(0, p.y > 0 ? -1 : 0))) / ((p.y > 0 && p.y < n1 ? 2.0 : 1.0) * uCell);
  float slope = sqrt(gx * gx + gy * gy);
  float sinAlpha = slope / sqrt(1.0 + slope * slope);
  float speed = sqrt(vx * vx + vy * vy);
  float depthFactor = min(1.0, d2 / uDepthMax);
  float capacity = uKc * max(sinAlpha, 0.01) * speed * depthFactor;
  float s = st.b;
  if (capacity > s) {
    float amount = uDt * uKs * (capacity - s);
    b = b - amount;
    s = s + amount;
  } else {
    float amount = uDt * uKd * (s - capacity);
    b = b + amount;
    s = s - amount;
  }
  outColor = vec4(b, d2, s, 0.0);
}`;

/**
 * Sediment rides the water leaving each cell (CPU stage 6), gathered rather than scattered:
 * a cell loses its share through its own fluxes and gains what each neighbour sends towards it.
 */
export const carrySource = `${header}
uniform sampler2D uS0;
uniform sampler2D uS;
uniform sampler2D uF;
float perUnit(ivec2 q) {
  float volume = (texelFetch(uS0, q, 0).g + uDt * uRain) * uCellArea;
  float s = texelFetch(uS, q, 0).b;
  return (volume <= 0.0 || s <= 0.0) ? 0.0 : (s * uDt) / volume;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int n1 = uN - 1;
  vec4 st = texelFetch(uS, p, 0);
  vec4 f = texelFetch(uF, p, 0);
  float moved = 0.0;
  float own = perUnit(p);
  moved -= own * f.r;
  moved -= own * f.g;
  moved -= own * f.b;
  moved -= own * f.a;
  if (p.x > 0) { ivec2 q = p + ivec2(-1, 0); moved += perUnit(q) * texelFetch(uF, q, 0).g; }
  if (p.x < n1) { ivec2 q = p + ivec2(1, 0); moved += perUnit(q) * texelFetch(uF, q, 0).r; }
  if (p.y > 0) { ivec2 q = p + ivec2(0, -1); moved += perUnit(q) * texelFetch(uF, q, 0).a; }
  if (p.y < n1) { ivec2 q = p + ivec2(0, 1); moved += perUnit(q) * texelFetch(uF, q, 0).b; }
  outColor = vec4(st.r, st.g, max(0.0, st.b + moved), 0.0);
}`;

/** Evaporation, then thermal weathering to the eight neighbours (CPU stages 7-8). */
export const settleSource = `${header}
uniform sampler2D uS;
uniform float uEvaporation;
uniform float uReach;
uniform float uDiagReach;
uniform float uThermalRate;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int n1 = uN - 1;
  vec4 st = texelFetch(uS, p, 0);
  float change = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 q = p + ivec2(dx, dy);
      if ((dx == 0 && dy == 0) || q.x < 0 || q.y < 0 || q.x > n1 || q.y > n1) continue;
      float reach = (dx != 0 && dy != 0) ? uDiagReach : uReach;
      float bq = texelFetch(uS, q, 0).r;
      float down = st.r - bq - reach;
      if (down > 0.0) change -= (uThermalRate * down) / 2.0;
      float up = bq - st.r - reach;
      if (up > 0.0) change += (uThermalRate * up) / 2.0;
    }
  }
  outColor = vec4(st.r + change, st.g * (1.0 - uEvaporation * uDt), st.b, 0.0);
}`;
