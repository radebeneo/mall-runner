// The runner as a cut-out from the rear-view atlas (assets/mall/runner-atlas.webp). It keeps the
// `RunnerFigure` contract of the procedural figure, which stays the fallback, and only mirrors
// game-core's player state.
//
// The source sheet has six running poses and no jump, roll or crash poses, so those are adapted:
// - jump: the third frame while rising and the sixth while falling (the two most tucked poses);
// - roll: the run cycle squashed to about half height, as the procedural figure does;
// - stumble: the run cycle with a quick wobble (off with reduced motion) and the grace flash;
// - crash: the current frame held and tipped over sideways onto the floor.
// The cycle follows distance, so it stops when the run is paused or crashed.
import { type PlayerState, type RunnerConfig, laneX } from '@credit-runner/game-core';
import { Group, Mesh, type PlaneGeometry, type Texture } from 'three';
import { cutoutMaterial, quadGeometry } from './billboard';
import type { Quad } from './mall-manifest';
import type { RunnerFigure } from './runner-figure';

/** One full cycle (two strides, all frames) every 4.8 m: three lane widths. */
export const RUNNER_CYCLE_METRES = 4.8;
export const RISING_FRAME = 2;
export const FALLING_FRAME = 5;
export const ROLL_SQUASH = 0.55;
export const CRASH_TIP = 1.3;

/** The atlas frame for the player's state at `distance`. */
export function runnerFrame(player: PlayerState, distance: number, frameCount: number): number {
  if (player.y > 0 && player.motion !== 'ROLL') {
    return Math.min(player.vy > 0 ? RISING_FRAME : FALLING_FRAME, frameCount - 1);
  }
  const frame = Math.floor((distance / RUNNER_CYCLE_METRES) * frameCount) % frameCount;
  return frame < 0 ? frame + frameCount : frame;
}

export function createSpriteRunnerFigure(
  map: Texture,
  quads: readonly Quad[],
  reducedMotion = false,
): RunnerFigure {
  // One small geometry per frame: switching frames swaps geometry, never a texture offset.
  const frames: PlaneGeometry[] = quads.map((quad) => quadGeometry(quad));
  const [first] = frames;
  if (first === undefined) throw new Error('The runner atlas has no frames.');
  const material = cutoutMaterial(map);

  // `root` follows the player; `body` pivots at the feet for leaning, squashing and falling.
  const root = new Group();
  const body = new Mesh(first, material);
  root.add(body);
  let shown = 0;

  return {
    root,
    update: (player, config: Readonly<RunnerConfig>, distance, time) => {
      const crashed = player.condition === 'CRASHED';
      const stumbling = player.condition === 'STUMBLING';
      const rolling = player.motion === 'ROLL';

      const frame = runnerFrame(player, distance, frames.length);
      if (frame !== shown) {
        shown = frame;
        body.geometry = frames[frame] as PlaneGeometry;
      }

      root.position.set(player.x, crashed ? 0 : player.y, 0);

      // Lean into a lane change; wobble while stumbling; tip over after a crash.
      const offset = laneX(player.lane, config) - player.x;
      const lean = Math.max(-0.3, Math.min(0.3, -offset * 0.18));
      const wobble = stumbling && !reducedMotion ? Math.sin(time * 16) * 0.07 : 0;
      body.rotation.z = crashed ? CRASH_TIP : lean + wobble;
      body.scale.set(rolling ? 1.1 : 1, rolling ? ROLL_SQUASH : 1, 1);

      // Flash during the grace period after a stumble.
      root.visible = !(stumbling && player.graceTime > 0 && Math.floor(time * 12) % 2 === 1);
    },
    dispose: () => {
      for (const geometry of frames) geometry.dispose();
      material.dispose();
    },
  };
}
