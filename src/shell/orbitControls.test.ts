import {expect, test} from 'bun:test';
import {defaultOrbit, orbitLimits, type OrbitState} from '../core/camera/orbit';
import {attachOrbitControls} from './orbitControls';

function setup() {
  const target = new EventTarget();
  const canvas = Object.assign(target, {clientHeight: 100, setPointerCapture: () => {}}) as unknown as HTMLCanvasElement;
  let state: OrbitState = defaultOrbit(256);
  let redraws = 0;
  attachOrbitControls(canvas, 256, () => state, (s) => (state = s), () => redraws++);
  const fire = (type: string, props: object): Event & {prevented: boolean} => {
    const e = Object.assign(new Event(type, {cancelable: true}), props, {prevented: false});
    const prevent = e.preventDefault.bind(e);
    e.preventDefault = () => {
      e.prevented = true;
      prevent();
    };
    target.dispatchEvent(e);
    return e;
  };
  return {fire, get state() { return state; }, get redraws() { return redraws; }};
}

test('dragging one pointer orbits and releasing stops it', () => {
  const t = setup();
  const start = t.state.yaw;
  t.fire('pointerdown', {pointerId: 1, clientX: 0, clientY: 0});
  t.fire('pointermove', {pointerId: 1, clientX: 50, clientY: 0});
  expect(t.state.yaw).toBeLessThan(start);
  const after = t.state.yaw;
  t.fire('pointerup', {pointerId: 1});
  t.fire('pointermove', {pointerId: 1, clientX: 90, clientY: 0});
  expect(t.state.yaw).toBe(after);
  expect(t.redraws).toBe(1);
});

test('moving a pointer that is not down does nothing', () => {
  const t = setup();
  t.fire('pointermove', {pointerId: 7, clientX: 50, clientY: 50});
  expect(t.redraws).toBe(0);
});

test('two pointers moving apart zoom in, together zoom out', () => {
  const t = setup();
  const d0 = t.state.distance;
  t.fire('pointerdown', {pointerId: 1, clientX: 0, clientY: 0});
  t.fire('pointerdown', {pointerId: 2, clientX: 10, clientY: 0});
  t.fire('pointermove', {pointerId: 2, clientX: 20, clientY: 0});
  const d1 = t.state.distance;
  expect(d1).toBeLessThan(d0);
  t.fire('pointermove', {pointerId: 2, clientX: 10, clientY: 0});
  expect(t.state.distance).toBeGreaterThan(d1);
  t.fire('pointercancel', {pointerId: 2});
});

test('the wheel zooms and stops the page scrolling; zoom stays inside limits', () => {
  const t = setup();
  const e = t.fire('wheel', {deltaY: -100});
  expect(e.prevented).toBe(true);
  expect(t.state.distance).toBeLessThan(defaultOrbit(256).distance);
  for (let i = 0; i < 200; i++) t.fire('wheel', {deltaY: -400});
  expect(t.state.distance).toBe(orbitLimits(256).minDistance);
});

test('keys orbit and zoom, and other keys are left alone', () => {
  const t = setup();
  const s0 = t.state;
  t.fire('keydown', {key: 'ArrowLeft'});
  t.fire('keydown', {key: 'ArrowRight'});
  t.fire('keydown', {key: 'ArrowUp'});
  t.fire('keydown', {key: 'ArrowDown'});
  expect(t.state.yaw).toBeCloseTo(s0.yaw, 9);
  expect(t.state.pitch).toBeCloseTo(s0.pitch, 9);
  t.fire('keydown', {key: '+'});
  const closer = t.state.distance;
  expect(closer).toBeLessThan(s0.distance);
  t.fire('keydown', {key: '='});
  t.fire('keydown', {key: '-'});
  const tab = t.fire('keydown', {key: 'Tab'});
  expect(tab.prevented).toBe(false);
  expect(t.redraws).toBe(7);
});
