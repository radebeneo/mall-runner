/** Lane across the corridor: 0 is left, 1 is the centre and 2 is right. */
export type Lane = 0 | 1 | 2;

export const LANE_COUNT = 3;

/**
 * What a lane will mean for the money model. AGENTS.md section 3 plans spend and save lanes;
 * v1 stubs them, so every lane is neutral and nothing reads this yet.
 */
export type LaneRole = 'SPEND' | 'NEUTRAL' | 'SAVE';

export const LANE_ROLES: Readonly<Record<Lane, LaneRole>> = Object.freeze({
  0: 'NEUTRAL',
  1: 'NEUTRAL',
  2: 'NEUTRAL',
});

/**
 * Runner tuning, in metres and seconds.
 *
 * Lane space: x runs across the lanes, y is up from the floor and z is the distance ahead of the
 * player. The player stays at z = 0 and the world scrolls toward it.
 */
export interface RunnerConfig {
  /** Distance between lane centres. */
  laneWidth: number;
  /** Sideways speed while changing lane. */
  laneChangeSpeed: number;
  startSpeed: number;
  maxSpeed: number;
  /** Forward speed gained per second, up to `maxSpeed`. */
  acceleration: number;
  /** Fraction of the forward speed kept while stumbling. */
  stumbleSpeedFactor: number;
  jumpVelocity: number;
  gravity: number;
  /** Downward speed applied when rolling in mid-air. */
  dropVelocity: number;
  rollDuration: number;
  playerWidth: number;
  playerHeight: number;
  rollHeight: number;
  playerDepth: number;
  /** How long a stumble lasts. A second hit inside it is a crash. */
  stumbleRecovery: number;
  /** After a hit, further hits are ignored for this long. */
  hitGrace: number;
  /** How long an input waits for the player to be able to act on it. */
  inputBuffer: number;
  chunkLength: number;
  /** The track is generated this far ahead of the player. */
  viewDistance: number;
  /** Chunks and items are recycled once they are this far behind the player. */
  despawnBehind: number;
  /** Every nth chunk carries an offer bag. 0 turns bags off. */
  offerChunkInterval: number;
  /** The first chunks of a run use the gentle start pattern. */
  startChunks: number;
  coinPoints: number;
}

export const DEFAULT_RUNNER_CONFIG: Readonly<RunnerConfig> = Object.freeze({
  laneWidth: 1.6,
  laneChangeSpeed: 12,
  startSpeed: 10,
  maxSpeed: 16,
  acceleration: 0.1,
  stumbleSpeedFactor: 0.7,
  jumpVelocity: 8,
  gravity: 24,
  dropVelocity: 14,
  rollDuration: 0.6,
  playerWidth: 0.7,
  playerHeight: 1.7,
  rollHeight: 0.8,
  playerDepth: 0.6,
  stumbleRecovery: 4,
  hitGrace: 0.8,
  inputBuffer: 0.15,
  chunkLength: 24,
  viewDistance: 120,
  despawnBehind: 8,
  offerChunkInterval: 10,
  startChunks: 1,
  coinPoints: 10,
});

/** Sideways position of a lane centre. */
export function laneX(lane: Lane, config: Readonly<RunnerConfig>): number {
  return (lane - 1) * config.laneWidth;
}
