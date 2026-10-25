import { type Box, setBox } from './collision';
import { type Lane, type RunnerConfig, laneX } from './config';

export type PlayerAction = 'LEFT' | 'RIGHT' | 'JUMP' | 'ROLL';
export type PlayerMotion = 'RUN' | 'JUMP' | 'ROLL';
export type PlayerCondition = 'OK' | 'STUMBLING' | 'CRASHED';
export type HitResult = 'STUMBLE' | 'CRASH' | 'IGNORED';

export interface PlayerState {
  /** Lane the player is in or moving to. */
  lane: Lane;
  /** Sideways position; moves toward the lane centre. */
  x: number;
  /** Height of the feet above the floor. */
  y: number;
  /** Vertical speed. */
  vy: number;
  motion: PlayerMotion;
  /** Seconds of roll left. */
  rollTime: number;
  condition: PlayerCondition;
  /** Seconds until a stumble wears off. */
  recoveryTime: number;
  /** Seconds during which further hits are ignored. */
  graceTime: number;
}

export function createPlayer(config: Readonly<RunnerConfig>): PlayerState {
  return {
    lane: 1,
    x: laneX(1, config),
    y: 0,
    vy: 0,
    motion: 'RUN',
    rollTime: 0,
    condition: 'OK',
    recoveryTime: 0,
    graceTime: 0,
  };
}

export function resetPlayer(player: PlayerState, config: Readonly<RunnerConfig>): void {
  Object.assign(player, createPlayer(config));
}

export function isAirborne(player: PlayerState): boolean {
  return player.y > 0 || player.vy > 0;
}

/**
 * Applies an input. Returns false when the player cannot act on it right now (for example a
 * jump in mid-air), so the input buffer can retry it shortly after.
 */
export function applyAction(
  player: PlayerState,
  action: PlayerAction,
  config: Readonly<RunnerConfig>,
): boolean {
  if (player.condition === 'CRASHED') return false;
  switch (action) {
    case 'LEFT':
      if (player.lane === 0) return false;
      player.lane = player.lane === 2 ? 1 : 0;
      return true;
    case 'RIGHT':
      if (player.lane === 2) return false;
      player.lane = player.lane === 0 ? 1 : 2;
      return true;
    case 'JUMP':
      if (isAirborne(player)) return false;
      // Jumping cancels a roll.
      player.motion = 'JUMP';
      player.vy = config.jumpVelocity;
      player.rollTime = 0;
      return true;
    case 'ROLL':
      if (player.motion === 'ROLL') return false;
      // Rolling in mid-air drops the player quickly to the floor.
      if (isAirborne(player)) player.vy = Math.min(player.vy, -config.dropVelocity);
      player.motion = 'ROLL';
      player.rollTime = config.rollDuration;
      return true;
  }
}

/** Advances the player by one fixed step. A crashed player stays where it fell. */
export function updatePlayer(
  player: PlayerState,
  dt: number,
  config: Readonly<RunnerConfig>,
): void {
  if (player.condition === 'CRASHED') return;

  const targetX = laneX(player.lane, config);
  const maxShift = config.laneChangeSpeed * dt;
  const offset = targetX - player.x;
  player.x = Math.abs(offset) <= maxShift ? targetX : player.x + Math.sign(offset) * maxShift;

  if (isAirborne(player)) {
    player.vy -= config.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      if (player.motion === 'JUMP') player.motion = 'RUN';
    }
  }

  if (player.motion === 'ROLL') {
    player.rollTime -= dt;
    if (player.rollTime <= 0) {
      player.rollTime = 0;
      player.motion = isAirborne(player) ? 'JUMP' : 'RUN';
    }
  }

  if (player.graceTime > 0) player.graceTime = Math.max(0, player.graceTime - dt);

  if (player.condition === 'STUMBLING') {
    player.recoveryTime -= dt;
    if (player.recoveryTime <= 0) {
      player.recoveryTime = 0;
      player.condition = 'OK';
    }
  }
}

/**
 * Handles running into an obstacle: the first hit is a stumble, a second hit before the
 * stumble wears off is a crash. Hits during the short grace period after a hit are ignored.
 */
export function hitObstacle(player: PlayerState, config: Readonly<RunnerConfig>): HitResult {
  if (player.condition === 'CRASHED' || player.graceTime > 0) return 'IGNORED';
  if (player.condition === 'STUMBLING') {
    player.condition = 'CRASHED';
    player.motion = 'RUN';
    player.y = 0;
    player.vy = 0;
    player.rollTime = 0;
    return 'CRASH';
  }
  player.condition = 'STUMBLING';
  player.recoveryTime = config.stumbleRecovery;
  player.graceTime = config.hitGrace;
  return 'STUMBLE';
}

/** Writes the player's collision box into `out` and returns it. Rolling lowers the box. */
export function playerBox(player: PlayerState, config: Readonly<RunnerConfig>, out: Box): Box {
  const height = player.motion === 'ROLL' ? config.rollHeight : config.playerHeight;
  return setBox(out, player.x, player.y, 0, config.playerWidth, height, config.playerDepth);
}
