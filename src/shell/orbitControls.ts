import {dragAngles, orbit, orbitLimits, wheelFactor, zoom, type OrbitState} from '../core/camera/orbit';

/**
 * Drag to orbit, wheel or two-finger pinch to zoom, arrow keys and plus/minus from the keyboard.
 * `get`/`set` hold the camera state; `changed` asks for a redraw.
 */
export function attachOrbitControls(
  canvas: HTMLCanvasElement,
  n: number,
  get: () => OrbitState,
  set: (s: OrbitState) => void,
  changed: () => void,
): void {
  const limits = orbitLimits(n);
  const pointers = new Map<number, {x: number; y: number}>();
  const apply = (s: OrbitState): void => {
    set(s);
    changed();
  };
  const pinchGap = (): number => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  });
  canvas.addEventListener('pointermove', (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    if (pointers.size === 2) {
      const before = pinchGap();
      pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
      const after = pinchGap();
      if (before > 0 && after > 0) apply(zoom(get(), before / after, limits));
      return;
    }
    const {dYaw, dPitch} = dragAngles(e.clientX - last.x, e.clientY - last.y, canvas.clientHeight);
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    apply(orbit(get(), dYaw, dPitch, limits));
  });
  const release = (e: PointerEvent): void => void pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      apply(zoom(get(), wheelFactor(e.deltaY), limits));
    },
    {passive: false},
  );
  canvas.addEventListener('keydown', (e) => {
    const step = 0.1;
    const moves: Record<string, () => OrbitState> = {
      ArrowLeft: () => orbit(get(), -step, 0, limits),
      ArrowRight: () => orbit(get(), step, 0, limits),
      ArrowUp: () => orbit(get(), 0, step, limits),
      ArrowDown: () => orbit(get(), 0, -step, limits),
      '+': () => zoom(get(), 0.9, limits),
      '=': () => zoom(get(), 0.9, limits),
      '-': () => zoom(get(), 1 / 0.9, limits),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    apply(move());
  });
}
