/** Seconds of rounding error forgiven when deciding whether a whole step has passed. */
const STEP_EPSILON = 1e-9;

/** Fixed-timestep clock. Frame time goes in; whole simulation steps come out. */
export interface StepClock {
  /** Simulation step in seconds. */
  readonly step: number;
  /** Longest frame that counts, so a stalled tab cannot cause a burst of catch-up steps. */
  readonly maxFrame: number;
  accumulator: number;
  /** Fraction of a step left over after the last advance, for render interpolation. */
  alpha: number;
}

export function createStepClock(step = 1 / 60, maxFrame = 0.1): StepClock {
  return { step, maxFrame, accumulator: 0, alpha: 0 };
}

/**
 * Adds one frame's elapsed time, clamped to `[0, maxFrame]`, and runs `update` once per whole
 * step. The remainder stays in the accumulator. Returns the number of steps run.
 */
export function advanceClock(
  clock: StepClock,
  elapsedSeconds: number,
  update: (dt: number) => void,
): number {
  clock.accumulator += Math.min(Math.max(elapsedSeconds, 0), clock.maxFrame);
  let steps = 0;
  // The tolerance absorbs floating-point drift, so frames exactly one step long (a 60 Hz
  // display) never alternate between zero and two updates.
  while (clock.accumulator >= clock.step - STEP_EPSILON) {
    update(clock.step);
    clock.accumulator = Math.max(clock.accumulator - clock.step, 0);
    steps += 1;
  }
  clock.alpha = clock.accumulator / clock.step;
  return steps;
}

export interface FrameScheduler {
  request: (callback: (timeMs: number) => void) => number;
  cancel: (handle: number) => void;
}

export const animationFrameScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface LoopHandlers {
  /** Advances the simulation by one fixed step. */
  update: (dt: number) => void;
  /** Draws a frame; `alpha` is how far the clock is into the next step. */
  render: (alpha: number) => void;
}

export interface GameLoop {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * Runs `handlers` on animation frames with a clamped fixed timestep. Per-frame values stay in
 * the handlers' own objects; nothing here touches React.
 */
export function createLoop(
  handlers: LoopHandlers,
  scheduler: FrameScheduler = animationFrameScheduler,
  clock: StepClock = createStepClock(),
): GameLoop {
  let handle: number | null = null;
  let lastTime: number | null = null;

  const frame = (timeMs: number): void => {
    handle = scheduler.request(frame);
    const elapsed = lastTime === null ? 0 : (timeMs - lastTime) / 1000;
    lastTime = timeMs;
    advanceClock(clock, elapsed, handlers.update);
    handlers.render(clock.alpha);
  };

  return {
    start: () => {
      if (handle !== null) return;
      // Restarting must not count the paused time as one long frame.
      lastTime = null;
      handle = scheduler.request(frame);
    },
    stop: () => {
      if (handle === null) return;
      scheduler.cancel(handle);
      handle = null;
    },
    isRunning: () => handle !== null,
  };
}
