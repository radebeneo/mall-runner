import { type Box, createBox, overlaps } from './collision';
import { DEFAULT_RUNNER_CONFIG, type Lane, type RunnerConfig } from './config';
import { clearInput, createInputBuffer, drainInput, type InputBuffer, pushInput } from './input';
import {
  applyAction,
  createPlayer,
  hitObstacle,
  type PlayerAction,
  playerBox,
  type PlayerState,
  resetPlayer,
  updatePlayer,
} from './player';
import {
  advanceTrack,
  createTrack,
  entityBox,
  resetTrack,
  type TrackEntity,
  type TrackState,
} from './track-generator';

/** Things the rest of the app reacts to. Called during a simulation step. */
export interface RunnerEvents {
  onCoin?: (points: number) => void;
  onStumble?: () => void;
  onCrash?: () => void;
  onBag?: (lane: Lane) => void;
}

/** Whole runner simulation. Plain mutable objects, advanced in fixed steps. */
export interface RunnerState {
  readonly config: Readonly<RunnerConfig>;
  readonly player: PlayerState;
  readonly track: TrackState;
  readonly input: InputBuffer;
  readonly events: RunnerEvents;
  /** Simulation seconds this run. */
  time: number;
  /** Forward speed before any stumble slowdown. */
  speed: number;
  /** Game points, a separate scale from money. */
  points: number;
  coins: number;
  readonly playerBox: Box;
  readonly scratchBox: Box;
  readonly act: (action: PlayerAction) => boolean;
}

export function createRunner(
  config: Readonly<RunnerConfig> = DEFAULT_RUNNER_CONFIG,
  seed = 1,
  events: RunnerEvents = {},
): RunnerState {
  const player = createPlayer(config);
  return {
    config,
    player,
    track: createTrack(config, seed),
    input: createInputBuffer(),
    events,
    time: 0,
    speed: config.startSpeed,
    points: 0,
    coins: 0,
    playerBox: createBox(),
    scratchBox: createBox(),
    act: (action) => applyAction(player, action, config),
  };
}

export function resetRunner(runner: RunnerState, seed = 1): void {
  resetPlayer(runner.player, runner.config);
  resetTrack(runner.track, runner.config, seed);
  clearInput(runner.input);
  runner.time = 0;
  runner.speed = runner.config.startSpeed;
  runner.points = 0;
  runner.coins = 0;
}

/** Buffers an input; it is applied on the next step the player can act on it. */
export function queueAction(runner: RunnerState, action: PlayerAction): void {
  pushInput(runner.input, action, runner.time);
}

export function isCrashed(runner: RunnerState): boolean {
  return runner.player.condition === 'CRASHED';
}

/** Advances the runner by one fixed step. The world stops after a crash. */
export function stepRunner(runner: RunnerState, dt: number): void {
  const { player, config } = runner;
  if (player.condition === 'CRASHED') return;

  runner.time += dt;
  drainInput(runner.input, runner.time, config.inputBuffer, runner.act);
  updatePlayer(player, dt, config);

  runner.speed = Math.min(config.maxSpeed, runner.speed + config.acceleration * dt);
  const speed =
    player.condition === 'STUMBLING' ? runner.speed * config.stumbleSpeedFactor : runner.speed;
  advanceTrack(runner.track, speed * dt, config);

  collide(runner);
}

function collide(runner: RunnerState): void {
  const { player, config, track, events } = runner;
  const box = playerBox(player, config, runner.playerBox);
  const entities = track.entities.active;

  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i] as TrackEntity;
    if (entity.hit || !overlaps(box, entityBox(entity, config, runner.scratchBox))) continue;

    if (entity.kind === 'COIN') {
      runner.points += config.coinPoints;
      runner.coins += 1;
      track.entities.release(entity);
      events.onCoin?.(runner.points);
    } else if (entity.kind === 'BAG') {
      const { lane } = entity;
      track.entities.release(entity);
      events.onBag?.(lane);
    } else {
      // An obstacle only counts once, however long the player overlaps it.
      entity.hit = true;
      const result = hitObstacle(player, config);
      if (result === 'STUMBLE') {
        events.onStumble?.();
      } else if (result === 'CRASH') {
        events.onCrash?.();
        return;
      }
    }
  }
}
