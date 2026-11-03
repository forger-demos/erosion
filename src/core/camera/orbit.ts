import {lookAt, multiply, perspective, type Mat4, type Vec3} from './mat4';

/**
 * An orbit camera around a fixed target. Yaw turns around the vertical axis, pitch is the elevation above the
 * horizon, distance is from the target. The scene is y-up with the terrain centred on the origin.
 * The camera is view code, not simulation, so it may use trigonometry; the bit-exact rule covers generation and erosion.
 */
export interface OrbitState {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface OrbitLimits {
  minPitch: number;
  maxPitch: number;
  minDistance: number;
  maxDistance: number;
}

export const fovY = Math.PI / 4;

/** Camera limits for a terrain of n x n cells: never under the ground plane, never so close the surface fills the view. */
export function orbitLimits(n: number): OrbitLimits {
  return {minPitch: 0.08, maxPitch: 1.5, minDistance: n * 0.25, maxDistance: n * 3};
}

/** Where the camera starts: looking at the range from the south-east, above it. */
export function defaultOrbit(n: number): OrbitState {
  return {yaw: 0.6, pitch: 0.7, distance: n * 1.7};
}

/** The point the camera looks at: the middle of the terrain, a little above the ground plane. */
export function orbitTarget(n: number): Vec3 {
  return [0, n / 8, 0];
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Turns the camera by the given angles, keeping pitch inside its limits. */
export function orbit(s: OrbitState, dYaw: number, dPitch: number, limits: OrbitLimits): OrbitState {
  return {yaw: s.yaw + dYaw, pitch: clamp(s.pitch + dPitch, limits.minPitch, limits.maxPitch), distance: s.distance};
}

/** Scales the distance by `factor` (below 1 moves closer), keeping it inside its limits. Wheel and pinch both use this. */
export function zoom(s: OrbitState, factor: number, limits: OrbitLimits): OrbitState {
  if (!(factor > 0)) return s;
  return {yaw: s.yaw, pitch: s.pitch, distance: clamp(s.distance * factor, limits.minDistance, limits.maxDistance)};
}

/** Radians of turn per pixel of drag, so a drag across the view turns the camera about half a revolution. */
export function dragAngles(dxPixels: number, dyPixels: number, viewPixels: number): {dYaw: number; dPitch: number} {
  const perPixel = Math.PI / Math.max(viewPixels, 1);
  return {dYaw: -dxPixels * perPixel, dPitch: dyPixels * perPixel};
}

/** Distance factor for a wheel step; deltaY is positive when scrolling away from the user. */
export function wheelFactor(deltaY: number): number {
  return Math.pow(1.0015, clamp(deltaY, -400, 400));
}

export function eyePosition(s: OrbitState, target: Vec3): [number, number, number] {
  const horizontal = Math.cos(s.pitch) * s.distance;
  return [
    target[0] + Math.sin(s.yaw) * horizontal,
    target[1] + Math.sin(s.pitch) * s.distance,
    target[2] + Math.cos(s.yaw) * horizontal,
  ];
}

export function viewMatrix(s: OrbitState, target: Vec3): number[] {
  return lookAt(eyePosition(s, target), target, [0, 1, 0]);
}

/** Projection for a terrain of n cells: the far plane reaches past the farthest zoom plus the terrain's own extent. */
export function projectionMatrix(aspect: number, n: number): number[] {
  const limits = orbitLimits(n);
  return perspective(fovY, aspect, limits.minDistance * 0.1, limits.maxDistance + n * 2);
}

export function viewProjection(s: OrbitState, aspect: number, n: number): number[] {
  return multiply(projectionMatrix(aspect, n) as Mat4, viewMatrix(s, orbitTarget(n)));
}
