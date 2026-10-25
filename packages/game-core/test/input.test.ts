import { describe, expect, it } from 'vitest';
import {
  actionForKey,
  attachInput,
  classifySwipe,
  clearInput,
  createInputBuffer,
  DEFAULT_SWIPE,
  drainInput,
  pushInput,
} from '../src/input';
import type { PlayerAction } from '../src/player';

function drainAll(buffer: ReturnType<typeof createInputBuffer>, time = 0): PlayerAction[] {
  const seen: PlayerAction[] = [];
  drainInput(buffer, time, 1, (action) => {
    seen.push(action);
    return true;
  });
  return seen;
}

describe('input buffer', () => {
  it('applies inputs oldest first and removes accepted ones', () => {
    const buffer = createInputBuffer();
    pushInput(buffer, 'LEFT', 0);
    pushInput(buffer, 'JUMP', 0);
    pushInput(buffer, 'RIGHT', 0);
    const seen: PlayerAction[] = [];
    const applied = drainInput(buffer, 0, 1, (action) => {
      seen.push(action);
      return action !== 'JUMP';
    });
    expect(applied).toBe(2);
    expect(seen).toEqual(['LEFT', 'JUMP', 'RIGHT']);
    expect(buffer.count).toBe(1);
    expect(drainAll(buffer)).toEqual(['JUMP']);
    expect(buffer.count).toBe(0);
  });

  it('drops inputs older than the window', () => {
    const buffer = createInputBuffer();
    pushInput(buffer, 'JUMP', 0);
    pushInput(buffer, 'ROLL', 0.5);
    expect(drainAll(buffer, 1.2)).toEqual(['ROLL']);
  });

  it('keeps rejected inputs in order until they succeed or expire', () => {
    const buffer = createInputBuffer();
    pushInput(buffer, 'JUMP', 0);
    pushInput(buffer, 'ROLL', 0);
    expect(drainInput(buffer, 0.1, 0.15, () => false)).toBe(0);
    expect(buffer.count).toBe(2);
    expect(drainInput(buffer, 0.2, 0.15, () => true)).toBe(0);
    expect(buffer.count).toBe(0);
  });

  it('drops the oldest input when full and wraps around', () => {
    const buffer = createInputBuffer(3);
    pushInput(buffer, 'LEFT', 0);
    pushInput(buffer, 'RIGHT', 0);
    pushInput(buffer, 'JUMP', 0);
    pushInput(buffer, 'ROLL', 0);
    expect(buffer.count).toBe(3);
    expect(drainAll(buffer)).toEqual(['RIGHT', 'JUMP', 'ROLL']);
    pushInput(buffer, 'LEFT', 0);
    pushInput(buffer, 'RIGHT', 0);
    expect(drainAll(buffer)).toEqual(['LEFT', 'RIGHT']);
  });

  it('clears', () => {
    const buffer = createInputBuffer();
    pushInput(buffer, 'LEFT', 0);
    clearInput(buffer);
    expect(drainAll(buffer)).toEqual([]);
  });
});

describe('actionForKey', () => {
  it('maps arrows, WASD and space', () => {
    expect(actionForKey('ArrowLeft')).toBe('LEFT');
    expect(actionForKey('a')).toBe('LEFT');
    expect(actionForKey('D')).toBe('RIGHT');
    expect(actionForKey('ArrowUp')).toBe('JUMP');
    expect(actionForKey(' ')).toBe('JUMP');
    expect(actionForKey('s')).toBe('ROLL');
    expect(actionForKey('Enter')).toBeNull();
  });
});

describe('classifySwipe', () => {
  it('reads the main direction of a swipe', () => {
    expect(classifySwipe(-60, 10, 100)).toBe('LEFT');
    expect(classifySwipe(60, -10, 100)).toBe('RIGHT');
    expect(classifySwipe(5, -60, 100)).toBe('JUMP');
    expect(classifySwipe(5, 60, 100)).toBe('ROLL');
  });

  it('ignores short and slow gestures', () => {
    expect(classifySwipe(10, 10, 100)).toBeNull();
    expect(classifySwipe(100, 0, DEFAULT_SWIPE.maxDurationMs + 1)).toBeNull();
  });
});

describe('attachInput', () => {
  function setup() {
    const surface = new EventTarget();
    const keyboard = new EventTarget();
    const seen: PlayerAction[] = [];
    const clock = { now: 0 };
    const detach = attachInput(
      { surface, keyboard },
      (action) => seen.push(action),
      DEFAULT_SWIPE,
      () => clock.now,
    );
    const pointer = (type: string, x: number, y: number, pointerId = 1): void => {
      surface.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX: x, clientY: y }));
    };
    const key = (value: string, extra: Record<string, boolean> = {}): Event => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), {
        key: value,
        repeat: false,
        ...extra,
      });
      keyboard.dispatchEvent(event);
      return event;
    };
    return { seen, clock, detach, pointer, key };
  }

  it('fires a swipe once it passes the threshold, without waiting for release', () => {
    const { seen, pointer } = setup();
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 90, 100);
    expect(seen).toEqual([]);
    pointer('pointermove', 40, 100);
    expect(seen).toEqual(['LEFT']);
    pointer('pointermove', 0, 100);
    pointer('pointerup', 0, 100);
    expect(seen).toEqual(['LEFT']);
  });

  it('reads the release when the threshold was not passed while moving', () => {
    const { seen, pointer } = setup();
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 100, 30);
    expect(seen).toEqual(['JUMP']);
  });

  it('ignores taps, slow drags, other pointers and cancelled gestures', () => {
    const { seen, clock, pointer } = setup();
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 102, 101);

    pointer('pointerdown', 100, 100);
    clock.now = 2000;
    pointer('pointerup', 100, 200);

    pointer('pointermove', 0, 0, 9);
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 100, 200, 2);
    pointer('pointerup', 100, 200, 2);
    pointer('pointercancel', 0, 0, 2);
    pointer('pointercancel', 0, 0);
    pointer('pointerup', 100, 300);
    expect(seen).toEqual([]);
  });

  it('maps keys and prevents their default scrolling', () => {
    const { seen, key } = setup();
    expect(key('ArrowDown').defaultPrevented).toBe(true);
    expect(key('ArrowRight', { repeat: true }).defaultPrevented).toBe(false);
    expect(key('ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(seen).toEqual(['ROLL']);
  });

  it('removes every listener when detached', () => {
    const { seen, detach, pointer, key } = setup();
    detach();
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 0, 100);
    key('ArrowLeft');
    expect(seen).toEqual([]);
  });

  it('uses the swipe defaults and performance clock when none are given', () => {
    const surface = new EventTarget();
    const seen: PlayerAction[] = [];
    const detach = attachInput({ surface, keyboard: new EventTarget() }, (a) => seen.push(a));
    surface.dispatchEvent(
      Object.assign(new Event('pointerdown'), { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    surface.dispatchEvent(
      Object.assign(new Event('pointerup'), { pointerId: 1, clientX: 80, clientY: 0 }),
    );
    detach();
    expect(seen).toEqual(['RIGHT']);
  });
});
