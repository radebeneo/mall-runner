import { describe, expect, it } from 'vitest';
import { createBox } from '../src/collision';
import { DEFAULT_RUNNER_CONFIG, laneX, type RunnerConfig } from '../src/config';
import {
  applyAction,
  createPlayer,
  hitObstacle,
  isAirborne,
  playerBox,
  type PlayerState,
  resetPlayer,
  updatePlayer,
} from '../src/player';

const config = DEFAULT_RUNNER_CONFIG;
const DT = 1 / 60;

function simulate(
  player: PlayerState,
  seconds: number,
  cfg: Readonly<RunnerConfig> = config,
): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) updatePlayer(player, DT, cfg);
}

describe('player lanes', () => {
  it('starts running in the centre lane', () => {
    const player = createPlayer(config);
    expect(player).toMatchObject({ lane: 1, x: 0, y: 0, motion: 'RUN', condition: 'OK' });
  });

  it('changes lane one step at a time and stops at the edges', () => {
    const player = createPlayer(config);
    expect(applyAction(player, 'LEFT', config)).toBe(true);
    expect(player.lane).toBe(0);
    expect(applyAction(player, 'LEFT', config)).toBe(false);
    expect(applyAction(player, 'RIGHT', config)).toBe(true);
    expect(player.lane).toBe(1);
    expect(applyAction(player, 'RIGHT', config)).toBe(true);
    expect(player.lane).toBe(2);
    expect(applyAction(player, 'RIGHT', config)).toBe(false);
    expect(applyAction(player, 'LEFT', config)).toBe(true);
    expect(player.lane).toBe(1);
  });

  it('slides toward the new lane at the lane-change speed', () => {
    const player = createPlayer(config);
    applyAction(player, 'LEFT', config);
    updatePlayer(player, DT, config);
    expect(player.x).toBeCloseTo(-config.laneChangeSpeed * DT);
    simulate(player, 0.2);
    expect(player.x).toBe(laneX(0, config));
  });
});

describe('player jumping and rolling', () => {
  it('jumps in an arc and lands back to running', () => {
    const player = createPlayer(config);
    expect(applyAction(player, 'JUMP', config)).toBe(true);
    expect(player.motion).toBe('JUMP');
    expect(isAirborne(player)).toBe(true);
    expect(applyAction(player, 'JUMP', config)).toBe(false);

    let peak = 0;
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, DT, config);
      peak = Math.max(peak, player.y);
    }
    expect(peak).toBeGreaterThan(1.2);
    expect(peak).toBeLessThan(1.4);
    expect(player).toMatchObject({ y: 0, vy: 0, motion: 'RUN' });
    expect(isAirborne(player)).toBe(false);
  });

  it('rolls for a fixed time with a lower collision box', () => {
    const player = createPlayer(config);
    expect(applyAction(player, 'ROLL', config)).toBe(true);
    expect(player.rollTime).toBe(config.rollDuration);
    expect(applyAction(player, 'ROLL', config)).toBe(false);
    const box = playerBox(player, config, createBox());
    expect(box.maxY - box.minY).toBeCloseTo(config.rollHeight);
    simulate(player, config.rollDuration + 0.05);
    expect(player).toMatchObject({ motion: 'RUN', rollTime: 0 });
  });

  it('drops quickly to the floor when rolling in mid-air', () => {
    const player = createPlayer(config);
    applyAction(player, 'JUMP', config);
    simulate(player, 0.1);
    applyAction(player, 'ROLL', config);
    expect(player.vy).toBe(-config.dropVelocity);
    expect(player.motion).toBe('ROLL');
    simulate(player, 0.2);
    expect(player.y).toBe(0);
    expect(player.motion).toBe('ROLL');
  });

  it('keeps a faster fall when rolling', () => {
    const player = createPlayer(config);
    player.y = 2;
    player.vy = -20;
    applyAction(player, 'ROLL', config);
    expect(player.vy).toBe(-20);
  });

  it('goes back to the jump pose when a roll ends in mid-air', () => {
    const player = createPlayer(config);
    player.motion = 'ROLL';
    player.rollTime = 0.01;
    player.y = 1;
    player.vy = 5;
    updatePlayer(player, DT, config);
    expect(player.motion).toBe('JUMP');
    simulate(player, 1);
    expect(player.motion).toBe('RUN');
  });

  it('cancels a roll with a jump', () => {
    const player = createPlayer(config);
    applyAction(player, 'ROLL', config);
    applyAction(player, 'JUMP', config);
    expect(player).toMatchObject({ motion: 'JUMP', rollTime: 0 });
  });
});

describe('player hits', () => {
  it('stumbles first, ignores hits in the grace period, then crashes', () => {
    const player = createPlayer(config);
    expect(hitObstacle(player, config)).toBe('STUMBLE');
    expect(player).toMatchObject({
      condition: 'STUMBLING',
      recoveryTime: config.stumbleRecovery,
      graceTime: config.hitGrace,
    });
    expect(hitObstacle(player, config)).toBe('IGNORED');

    simulate(player, config.hitGrace + 0.1);
    expect(player.graceTime).toBe(0);
    expect(hitObstacle(player, config)).toBe('CRASH');
    expect(player.condition).toBe('CRASHED');
    expect(hitObstacle(player, config)).toBe('IGNORED');
  });

  it('recovers from a stumble', () => {
    const player = createPlayer(config);
    hitObstacle(player, config);
    simulate(player, config.stumbleRecovery + 0.1);
    expect(player).toMatchObject({ condition: 'OK', recoveryTime: 0 });
    expect(hitObstacle(player, config)).toBe('STUMBLE');
  });

  it('falls to the floor and stops acting once crashed', () => {
    const player = createPlayer(config);
    applyAction(player, 'JUMP', config);
    simulate(player, 0.1);
    player.condition = 'STUMBLING';
    expect(hitObstacle(player, config)).toBe('CRASH');
    expect(player).toMatchObject({ y: 0, vy: 0, motion: 'RUN' });

    expect(applyAction(player, 'LEFT', config)).toBe(false);
    const before = { ...player };
    simulate(player, 1);
    expect(player).toEqual(before);
  });
});

describe('playerBox and resetPlayer', () => {
  it('describes the standing player around the origin', () => {
    const box = playerBox(createPlayer(config), config, createBox());
    expect(box.minX).toBeCloseTo(-config.playerWidth / 2);
    expect(box.maxX).toBeCloseTo(config.playerWidth / 2);
    expect(box.minY).toBe(0);
    expect(box.maxY).toBe(config.playerHeight);
    expect(box.minZ).toBeCloseTo(-config.playerDepth / 2);
    expect(box.maxZ).toBeCloseTo(config.playerDepth / 2);
  });

  it('resets every field', () => {
    const player = createPlayer(config);
    applyAction(player, 'RIGHT', config);
    applyAction(player, 'JUMP', config);
    hitObstacle(player, config);
    simulate(player, 0.2);
    resetPlayer(player, config);
    expect(player).toEqual(createPlayer(config));
  });
});
