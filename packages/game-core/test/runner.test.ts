import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RUNNER_CONFIG } from '../src/config';
import { isAirborne } from '../src/player';
import {
  createRunner,
  isCrashed,
  queueAction,
  resetRunner,
  type RunnerState,
  stepRunner,
} from '../src/runner';
import { spawnEntity } from '../src/track-generator';

const DT = 1 / 60;

function runFor(runner: RunnerState, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepRunner(runner, DT);
}

describe('createRunner', () => {
  it('starts at the start speed with no points', () => {
    const runner = createRunner();
    expect(runner).toMatchObject({ time: 0, speed: 10, points: 0, coins: 0 });
    expect(runner.player.lane).toBe(1);
  });
});

describe('stepRunner', () => {
  it('speeds up to the maximum', () => {
    const runner = createRunner({ ...DEFAULT_RUNNER_CONFIG, acceleration: 100 });
    stepRunner(runner, DT);
    expect(runner.speed).toBeCloseTo(10 + 100 * DT);
    runFor(runner, 0.2);
    expect(runner.speed).toBe(16);
  });

  it('collects the coins in the start chunk', () => {
    const onCoin = vi.fn<(points: number) => void>();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onCoin });
    runFor(runner, 2.1);
    expect(runner.coins).toBe(7);
    expect(runner.points).toBe(70);
    expect(onCoin).toHaveBeenCalledTimes(7);
    expect(onCoin).toHaveBeenLastCalledWith(70);
  });

  it('stumbles on the first obstacle and slows down', () => {
    const onStumble = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onStumble });
    const sign = spawnEntity(runner.track, 'WET_FLOOR', 1, 2);
    runFor(runner, 0.3);
    expect(onStumble).toHaveBeenCalledTimes(1);
    expect(sign.hit).toBe(true);
    expect(runner.player.condition).toBe('STUMBLING');

    const before = runner.track.distance;
    stepRunner(runner, DT);
    expect(runner.track.distance - before).toBeCloseTo(
      runner.speed * DEFAULT_RUNNER_CONFIG.stumbleSpeedFactor * DT,
    );
  });

  it('counts back-to-back obstacles as one hit', () => {
    const onStumble = vi.fn();
    const onCrash = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onStumble, onCrash });
    const first = spawnEntity(runner.track, 'WET_FLOOR', 1, 2);
    const second = spawnEntity(runner.track, 'WET_FLOOR', 1, 3);
    runFor(runner, 0.5);
    expect(first.hit).toBe(true);
    expect(second.hit).toBe(true);
    expect(onStumble).toHaveBeenCalledTimes(1);
    expect(onCrash).not.toHaveBeenCalled();
  });

  it('crashes on a second hit while stumbling and stops the world', () => {
    const onCrash = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onCrash });
    spawnEntity(runner.track, 'WET_FLOOR', 1, 2);
    runFor(runner, 1.2);
    spawnEntity(runner.track, 'CART', 1, 2);
    runFor(runner, 0.5);
    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(isCrashed(runner)).toBe(true);

    const { time } = runner;
    const { distance } = runner.track;
    runFor(runner, 1);
    expect(runner.time).toBe(time);
    expect(runner.track.distance).toBe(distance);
  });

  it('reports the offer bag and removes it', () => {
    const onBag = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onBag });
    const bag = spawnEntity(runner.track, 'BAG', 1, 2);
    runFor(runner, 0.3);
    expect(onBag).toHaveBeenCalledWith(1);
    expect(runner.track.entities.active).not.toContain(bag);
  });

  it('works without event handlers', () => {
    const runner = createRunner();
    spawnEntity(runner.track, 'BAG', 1, 1);
    spawnEntity(runner.track, 'WET_FLOOR', 1, 2);
    runFor(runner, 1.5);
    spawnEntity(runner.track, 'CART', 1, 2);
    runFor(runner, 0.5);
    expect(runner.coins).toBeGreaterThan(0);
    expect(isCrashed(runner)).toBe(true);
  });
});

describe('dodging', () => {
  it('jumps over a wet floor sign', () => {
    const onStumble = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onStumble });
    spawnEntity(runner.track, 'WET_FLOOR', 1, 4);
    queueAction(runner, 'JUMP');
    runFor(runner, 1);
    expect(onStumble).not.toHaveBeenCalled();
  });

  it('rolls under a banner', () => {
    const onStumble = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onStumble });
    spawnEntity(runner.track, 'BANNER', 1, 4);
    queueAction(runner, 'ROLL');
    runFor(runner, 1);
    expect(onStumble).not.toHaveBeenCalled();
  });

  it('changes lane around a cart', () => {
    const onStumble = vi.fn();
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, 1, { onStumble });
    spawnEntity(runner.track, 'CART', 1, 6);
    queueAction(runner, 'LEFT');
    runFor(runner, 1);
    expect(onStumble).not.toHaveBeenCalled();
    expect(runner.player.lane).toBe(0);
  });
});

describe('input buffering', () => {
  it('jumps again when the jump was pressed just before landing', () => {
    const runner = createRunner();
    queueAction(runner, 'JUMP');
    runFor(runner, 0.6);
    queueAction(runner, 'JUMP');
    runFor(runner, 0.15);
    expect(isAirborne(runner.player)).toBe(true);
  });

  it('forgets a jump pressed too early', () => {
    const runner = createRunner();
    queueAction(runner, 'JUMP');
    runFor(runner, 0.3);
    queueAction(runner, 'JUMP');
    runFor(runner, 0.5);
    expect(isAirborne(runner.player)).toBe(false);
  });
});

describe('resetRunner', () => {
  it('starts a fresh run', () => {
    const runner = createRunner();
    queueAction(runner, 'RIGHT');
    runFor(runner, 2);
    resetRunner(runner);
    expect(runner).toMatchObject({ time: 0, speed: 10, points: 0, coins: 0 });
    expect(runner.player.lane).toBe(1);
    expect(runner.input.count).toBe(0);
    expect(runner.track.distance).toBe(0);
  });
});
