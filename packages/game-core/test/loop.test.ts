import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceClock,
  animationFrameScheduler,
  createLoop,
  createStepClock,
  type FrameScheduler,
} from '../src/loop';

function fakeScheduler() {
  let nextHandle = 1;
  const pending = new Map<number, (timeMs: number) => void>();
  const scheduler: FrameScheduler = {
    request: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    },
  };
  return {
    scheduler,
    tick: (timeMs: number) => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(timeMs);
    },
    pendingCount: () => pending.size,
  };
}

describe('advanceClock', () => {
  it('runs whole steps and keeps the remainder', () => {
    const clock = createStepClock(0.25, 1);
    const update = vi.fn<(dt: number) => void>();
    expect(advanceClock(clock, 0.6, update)).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(0.25);
    expect(clock.accumulator).toBeCloseTo(0.1);
    expect(clock.alpha).toBeCloseTo(0.4);
    expect(advanceClock(clock, 0.15, update)).toBe(1);
    expect(clock.accumulator).toBeCloseTo(0);
  });

  it('runs exactly one step per frame when frames match the step', () => {
    const clock = createStepClock();
    let steps = 0;
    for (let i = 0; i < 600; i++) {
      const ran = advanceClock(clock, 1 / 60, () => undefined);
      expect(ran).toBe(1);
      steps += ran;
    }
    expect(steps).toBe(600);
  });

  it('clamps a long frame so a stalled tab cannot burst', () => {
    const clock = createStepClock(0.25, 0.5);
    expect(advanceClock(clock, 10, () => undefined)).toBe(2);
  });

  it('ignores negative elapsed time', () => {
    const clock = createStepClock(0.25, 1);
    expect(advanceClock(clock, -1, () => undefined)).toBe(0);
    expect(clock.accumulator).toBe(0);
  });

  it('defaults to 60 steps a second and a 100 ms frame cap', () => {
    const clock = createStepClock();
    expect(clock.step).toBeCloseTo(1 / 60);
    expect(clock.maxFrame).toBe(0.1);
  });
});

describe('createLoop', () => {
  it('updates in fixed steps and renders once per frame', () => {
    const fake = fakeScheduler();
    const update = vi.fn<(dt: number) => void>();
    const render = vi.fn<(alpha: number) => void>();
    const loop = createLoop({ update, render }, fake.scheduler, createStepClock(0.25, 1));

    loop.start();
    expect(loop.isRunning()).toBe(true);
    fake.tick(1000);
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith(0);

    fake.tick(1500);
    expect(update).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(2);
    expect(fake.pendingCount()).toBe(1);
  });

  it('starts once and stops cleanly', () => {
    const fake = fakeScheduler();
    const loop = createLoop({ update: () => undefined, render: () => undefined }, fake.scheduler);
    loop.start();
    loop.start();
    expect(fake.pendingCount()).toBe(1);
    loop.stop();
    loop.stop();
    expect(loop.isRunning()).toBe(false);
    expect(fake.pendingCount()).toBe(0);
  });

  it('does not count paused time as one long frame', () => {
    const fake = fakeScheduler();
    const update = vi.fn<(dt: number) => void>();
    const loop = createLoop(
      { update, render: () => undefined },
      fake.scheduler,
      createStepClock(0.25, 10),
    );
    loop.start();
    fake.tick(0);
    loop.stop();
    loop.start();
    fake.tick(60_000);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('animationFrameScheduler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wraps requestAnimationFrame and cancelAnimationFrame', () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const callback = (): void => undefined;
    expect(animationFrameScheduler.request(callback)).toBe(7);
    expect(request).toHaveBeenCalledWith(callback);
    animationFrameScheduler.cancel(7);
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
