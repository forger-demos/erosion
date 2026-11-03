import {describe, expect, test} from 'bun:test';
import {lookAt, multiply, perspective, project} from './mat4';
import {
  defaultOrbit,
  dragAngles,
  eyePosition,
  orbit,
  orbitLimits,
  orbitTarget,
  viewMatrix,
  viewProjection,
  wheelFactor,
  zoom,
} from './orbit';

const near = (a: readonly number[], b: readonly number[], digits = 6): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));
};
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const limits = orbitLimits(256);

describe('matrices', () => {
  test('multiplying by identity changes nothing', () => {
    const m = perspective(1, 1.5, 0.1, 100);
    near(multiply(identity, m), m);
    near(multiply(m, identity), m);
  });
  test('multiply applies the right matrix first', () => {
    const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1];
    const scale = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1];
    near(project(multiply(translate, scale), [1, 1, 1]), [4, 5, 6]);
    near(project(multiply(scale, translate), [1, 1, 1]), [6, 8, 10]);
  });
  test('perspective maps near and far planes to -1 and 1 and keeps centre centred', () => {
    const m = perspective(Math.PI / 2, 1, 1, 11);
    near(project(m, [0, 0, -1]), [0, 0, -1]);
    near(project(m, [0, 0, -11]), [0, 0, 1]);
    near(project(m, [1, 1, -1]), [1, 1, -1]);
  });
  test('perspective narrows the view as aspect widens', () => {
    const m = perspective(Math.PI / 2, 2, 1, 10);
    near(project(m, [2, 0, -1]), [1, 0, -1 + 0], 6);
  });
  test('lookAt puts the target straight ahead at its distance', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    near(project(v, [0, 0, 0]), [0, 0, -5]);
    near(project(v, [1, 0, 0]), [1, 0, -5]);
    near(project(v, [0, 1, 0]), [0, 1, -5]);
  });
  test('lookAt from the side turns the world', () => {
    const v = lookAt([5, 0, 0], [0, 0, 0], [0, 1, 0]);
    near(project(v, [0, 0, 0]), [0, 0, -5]);
    near(project(v, [0, 0, -1]), [1, 0, -5]);
    near(project(v, [-1, 0, 0]), [0, 0, -6]);
  });
});

describe('orbit camera', () => {
  test('eye sits at the stated distance from the target', () => {
    const t = orbitTarget(256);
    const s = {yaw: 1.1, pitch: 0.4, distance: 300};
    const e = eyePosition(s, t);
    expect(Math.hypot(e[0] - t[0], e[1] - t[1], e[2] - t[2])).toBeCloseTo(300, 6);
  });
  test('zero yaw looks from +z, positive yaw swings towards +x, pitch raises the eye', () => {
    near(eyePosition({yaw: 0, pitch: 0, distance: 10}, [0, 0, 0]), [0, 0, 10]);
    near(eyePosition({yaw: Math.PI / 2, pitch: 0, distance: 10}, [0, 0, 0]), [10, 0, 0]);
    near(eyePosition({yaw: 0, pitch: Math.PI / 2, distance: 10}, [0, 0, 0]), [0, 10, 0]);
  });
  test('orbit adds to yaw without limit and clamps pitch', () => {
    const s = orbit(defaultOrbit(256), 10, 0, limits);
    expect(s.yaw).toBeCloseTo(10.6, 9);
    expect(orbit(defaultOrbit(256), 0, 9, limits).pitch).toBe(limits.maxPitch);
    expect(orbit(defaultOrbit(256), 0, -9, limits).pitch).toBe(limits.minPitch);
  });
  test('orbit leaves distance alone and returns a new state', () => {
    const s = defaultOrbit(256);
    const o = orbit(s, 0.2, 0.1, limits);
    expect(o.distance).toBe(s.distance);
    expect(o).not.toBe(s);
    expect(s.yaw).toBe(0.6);
  });
  test('zoom scales distance and stops at both limits', () => {
    const s = defaultOrbit(256);
    expect(zoom(s, 0.5, limits).distance).toBeCloseTo(s.distance / 2, 9);
    expect(zoom(s, 1e-6, limits).distance).toBe(limits.minDistance);
    expect(zoom(s, 1e6, limits).distance).toBe(limits.maxDistance);
  });
  test('zoom ignores a factor that is not positive or not a number', () => {
    const s = defaultOrbit(256);
    expect(zoom(s, 0, limits)).toBe(s);
    expect(zoom(s, -2, limits)).toBe(s);
    expect(zoom(s, NaN, limits)).toBe(s);
  });
  test('the default camera starts inside its limits', () => {
    const s = defaultOrbit(256);
    expect(s.distance).toBeGreaterThan(limits.minDistance);
    expect(s.distance).toBeLessThan(limits.maxDistance);
    expect(s.pitch).toBeGreaterThan(limits.minPitch);
    expect(s.pitch).toBeLessThan(limits.maxPitch);
  });
  test('dragging across the view height turns half a revolution; right drag turns left', () => {
    const a = dragAngles(100, 0, 100);
    expect(a.dYaw).toBeCloseTo(-Math.PI, 9);
    expect(a.dPitch).toBeCloseTo(0, 9);
    expect(dragAngles(0, 50, 100).dPitch).toBeCloseTo(Math.PI / 2, 9);
    expect(Number.isFinite(dragAngles(5, 5, 0).dYaw)).toBe(true);
  });
  test('wheel steps zoom smoothly, are capped, and scroll-up moves closer', () => {
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-100)).toBeLessThan(1);
    expect(wheelFactor(100)).toBeGreaterThan(1);
    expect(wheelFactor(1e9)).toBe(wheelFactor(400));
  });
  test('the view matrix puts the target on the axis at the camera distance', () => {
    const s = {yaw: 0.9, pitch: 0.5, distance: 200};
    const t = orbitTarget(256);
    near(project(viewMatrix(s, t), t), [0, 0, -200], 4);
  });
  test('the terrain centre projects to the middle of the screen and is visible', () => {
    const p = project(viewProjection(defaultOrbit(256), 1.6, 256), orbitTarget(256));
    near([p[0], p[1]], [0, 0], 5);
    expect(p[2]).toBeGreaterThan(-1);
    expect(p[2]).toBeLessThan(1);
  });
  test('the whole terrain stays inside the depth range at the farthest zoom', () => {
    const s = {yaw: 2, pitch: 0.3, distance: limits.maxDistance};
    for (const [x, z] of [[-128, -128], [128, 128], [-128, 128], [128, -128]] as const) {
      const p = project(viewProjection(s, 1, 256), [x, 0, z]);
      expect(Math.abs(p[2])).toBeLessThan(1);
    }
  });
});
