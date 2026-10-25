import type { PlayerAction } from './player';

/** Fixed-size ring buffer of inputs with the simulation time they arrived. */
export interface InputBuffer {
  readonly capacity: number;
  readonly actions: PlayerAction[];
  readonly times: number[];
  start: number;
  count: number;
}

export function createInputBuffer(capacity = 8): InputBuffer {
  return {
    capacity,
    actions: new Array<PlayerAction>(capacity).fill('JUMP'),
    times: new Array<number>(capacity).fill(0),
    start: 0,
    count: 0,
  };
}

export function clearInput(buffer: InputBuffer): void {
  buffer.start = 0;
  buffer.count = 0;
}

/** Adds an input. When the buffer is full the oldest input is dropped. */
export function pushInput(buffer: InputBuffer, action: PlayerAction, time: number): void {
  if (buffer.count === buffer.capacity) {
    buffer.start = (buffer.start + 1) % buffer.capacity;
    buffer.count -= 1;
  }
  const index = (buffer.start + buffer.count) % buffer.capacity;
  buffer.actions[index] = action;
  buffer.times[index] = time;
  buffer.count += 1;
}

/**
 * Offers each buffered input to `apply`, oldest first. Accepted inputs are removed. Rejected
 * ones stay, in order, until they succeed or are older than `window` seconds, so a jump pressed
 * just before landing still happens. Returns the number of inputs applied.
 */
export function drainInput(
  buffer: InputBuffer,
  time: number,
  window: number,
  apply: (action: PlayerAction) => boolean,
): number {
  const { capacity, actions, times } = buffer;
  let kept = 0;
  let applied = 0;
  for (let i = 0; i < buffer.count; i++) {
    const from = (buffer.start + i) % capacity;
    // Indexes stay inside the fixed-size arrays.
    const action = actions[from] as PlayerAction;
    const at = times[from] as number;
    if (time - at > window) continue;
    if (apply(action)) {
      applied += 1;
      continue;
    }
    const to = (buffer.start + kept) % capacity;
    actions[to] = action;
    times[to] = at;
    kept += 1;
  }
  buffer.count = kept;
  return applied;
}

const KEY_ACTIONS = new Map<string, PlayerAction>([
  ['ArrowLeft', 'LEFT'],
  ['a', 'LEFT'],
  ['A', 'LEFT'],
  ['ArrowRight', 'RIGHT'],
  ['d', 'RIGHT'],
  ['D', 'RIGHT'],
  ['ArrowUp', 'JUMP'],
  ['w', 'JUMP'],
  ['W', 'JUMP'],
  [' ', 'JUMP'],
  ['ArrowDown', 'ROLL'],
  ['s', 'ROLL'],
  ['S', 'ROLL'],
]);

export function actionForKey(key: string): PlayerAction | null {
  return KEY_ACTIONS.get(key) ?? null;
}

export interface SwipeOptions {
  /** Shortest movement, in CSS pixels, that counts as a swipe. */
  minDistance: number;
  /** Longest gesture, in milliseconds, that counts as a swipe. */
  maxDurationMs: number;
}

export const DEFAULT_SWIPE: Readonly<SwipeOptions> = Object.freeze({
  minDistance: 30,
  maxDurationMs: 600,
});

/** Reads a pointer movement as a swipe. Screen y grows downward, so up is a jump. */
export function classifySwipe(
  dx: number,
  dy: number,
  durationMs: number,
  options: Readonly<SwipeOptions> = DEFAULT_SWIPE,
): PlayerAction | null {
  if (durationMs > options.maxDurationMs) return null;
  const across = Math.abs(dx);
  const along = Math.abs(dy);
  if (Math.max(across, along) < options.minDistance) return null;
  if (across >= along) return dx < 0 ? 'LEFT' : 'RIGHT';
  return dy < 0 ? 'JUMP' : 'ROLL';
}

export interface InputTargets {
  /** Game surface that receives pointer events. */
  surface: EventTarget;
  /** Usually `window`, for arrow keys and WASD. */
  keyboard: EventTarget;
}

/**
 * Listens for swipes on the surface and keys on the keyboard target, and reports each as an
 * action. A swipe fires as soon as it passes the threshold, without waiting for release.
 * Returns a function that removes every listener.
 */
export function attachInput(
  targets: InputTargets,
  onAction: (action: PlayerAction) => void,
  options: Readonly<SwipeOptions> = DEFAULT_SWIPE,
  now: () => number = () => performance.now(),
): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let fired = false;

  const swipe = (event: PointerEvent): void => {
    const action = classifySwipe(
      event.clientX - startX,
      event.clientY - startY,
      now() - startTime,
      options,
    );
    if (action === null) return;
    fired = true;
    onAction(action);
  };

  const onDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    pointerId = pointer.pointerId;
    startX = pointer.clientX;
    startY = pointer.clientY;
    startTime = now();
    fired = false;
  };

  const onMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.pointerId !== pointerId || fired) return;
    swipe(pointer);
  };

  const onUp = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.pointerId !== pointerId) return;
    if (!fired) swipe(pointer);
    pointerId = null;
  };

  const onCancel = (event: Event): void => {
    if ((event as PointerEvent).pointerId === pointerId) pointerId = null;
  };

  const onKey = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (key.repeat || key.altKey || key.ctrlKey || key.metaKey) return;
    const action = actionForKey(key.key);
    if (action === null) return;
    key.preventDefault();
    onAction(action);
  };

  const { surface, keyboard } = targets;
  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onUp);
  surface.addEventListener('pointercancel', onCancel);
  keyboard.addEventListener('keydown', onKey);

  return () => {
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerup', onUp);
    surface.removeEventListener('pointercancel', onCancel);
    keyboard.removeEventListener('keydown', onKey);
  };
}
