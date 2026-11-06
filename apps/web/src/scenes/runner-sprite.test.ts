import {
  DEFAULT_RUNNER_CONFIG,
  type PlayerState,
  createPlayer,
  laneX,
} from '@credit-runner/game-core';
import { type BufferGeometry, Mesh, MeshBasicMaterial, type Object3D, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/mall/manifest.json';
import { parseMallManifest, runnerQuads } from './mall-manifest';
import {
  CRASH_TIP,
  FALLING_FRAME,
  RISING_FRAME,
  ROLL_SQUASH,
  RUNNER_CYCLE_METRES,
  createSpriteRunnerFigure,
  runnerFrame,
} from './runner-sprite';

const config = DEFAULT_RUNNER_CONFIG;
const quads = runnerQuads(parseMallManifest(manifestJson).runner);
const STEP = RUNNER_CYCLE_METRES / quads.length;

function player(changes: Partial<PlayerState> = {}): PlayerState {
  return { ...createPlayer(config), ...changes };
}

/** Narrows to a default-typed `Mesh` (a bare `instanceof` gives `Mesh<any, any, any>`). */
function isMesh(object: Object3D | undefined): object is Mesh {
  return object instanceof Mesh;
}

function setup(reducedMotion = false): {
  figure: ReturnType<typeof createSpriteRunnerFigure>;
  body: Mesh;
  material: MeshBasicMaterial;
} {
  const figure = createSpriteRunnerFigure(new Texture(), quads, reducedMotion);
  const body = figure.root.children[0];
  if (!isMesh(body)) throw new Error('The sprite runner has no body mesh.');
  if (!(body.material instanceof MeshBasicMaterial)) {
    throw new Error('The sprite runner body should use a MeshBasicMaterial.');
  }
  return { figure, body, material: body.material };
}

describe('sprite runner frames', () => {
  it('steps through the cycle with distance and wraps', () => {
    for (let frame = 0; frame < quads.length; frame++) {
      expect(runnerFrame(player(), (frame + 0.5) * STEP, quads.length)).toBe(frame);
    }
    expect(runnerFrame(player(), RUNNER_CYCLE_METRES + 0.5 * STEP, quads.length)).toBe(0);
    expect(runnerFrame(player(), -0.5 * STEP, quads.length)).toBe(quads.length - 1);
  });

  it('holds a tucked frame in the air: one rising, one falling', () => {
    expect(runnerFrame(player({ y: 0.5, vy: 3, motion: 'JUMP' }), 1, 6)).toBe(RISING_FRAME);
    expect(runnerFrame(player({ y: 0.5, vy: -3, motion: 'JUMP' }), 1, 6)).toBe(FALLING_FRAME);
    // Never past the last frame of a shorter atlas.
    expect(runnerFrame(player({ y: 0.5, vy: -3, motion: 'JUMP' }), 1, 2)).toBe(1);
  });

  it('keeps the run cycle while rolling', () => {
    const rolling = player({ y: 0.2, vy: -1, motion: 'ROLL' });
    expect(runnerFrame(rolling, 1.5 * STEP, 6)).toBe(1);
  });

  it('freezes while the distance does not move', () => {
    const still = player();
    expect(runnerFrame(still, 7.3, 6)).toBe(runnerFrame(still, 7.3, 6));
  });
});

describe('sprite runner figure', () => {
  it('needs at least one frame', () => {
    expect(() => createSpriteRunnerFigure(new Texture(), [])).toThrow(/no frames/);
  });

  it('swaps frame geometry instead of moving the texture', () => {
    const { figure, body, material } = setup();
    const map = material.map;
    figure.update(player(), config, 0.5 * STEP, 0);
    const first = body.geometry;
    figure.update(player(), config, 3.5 * STEP, 0.1);
    expect(body.geometry).not.toBe(first);
    expect(body.material).toBe(material);
    expect(material.map).toBe(map);
    expect(map?.offset.x).toBe(0);
    expect(map?.offset.y).toBe(0);
  });

  it('follows the player and leans into a lane change', () => {
    const { figure, body } = setup();
    const moving = player({ lane: 2, x: laneX(1, config), y: 0.4, vy: 1, motion: 'JUMP' });
    figure.update(moving, config, 0, 0);
    expect(figure.root.position.x).toBe(moving.x);
    expect(figure.root.position.y).toBe(0.4);
    expect(body.rotation.z).toBeLessThan(0);
    expect(body.rotation.z).toBeGreaterThanOrEqual(-0.3);
  });

  it('squashes while rolling and tips over onto the floor after a crash', () => {
    const { figure, body } = setup();
    figure.update(player({ motion: 'ROLL', rollTime: 0.4 }), config, 0, 0);
    expect(body.scale.y).toBe(ROLL_SQUASH);
    figure.update(player({ condition: 'CRASHED', y: 0.6 }), config, 0, 0);
    expect(body.rotation.z).toBe(CRASH_TIP);
    expect(body.scale.y).toBe(1);
    expect(figure.root.position.y).toBe(0);
  });

  it('wobbles while stumbling unless motion is reduced, and flashes during grace', () => {
    const stumbling = player({ condition: 'STUMBLING', recoveryTime: 1, graceTime: 1 });
    const moving = setup();
    moving.figure.update(stumbling, config, 0, 0.1);
    expect(moving.body.rotation.z).not.toBe(0);
    const still = setup(true);
    still.figure.update(stumbling, config, 0, 0.1);
    expect(still.body.rotation.z).toBe(0);
    // The flash hides the figure on alternate twelfths of a second.
    still.figure.update(stumbling, config, 0, 1.5 / 12);
    expect(still.figure.root.visible).toBe(false);
    still.figure.update(stumbling, config, 0, 2.5 / 12);
    expect(still.figure.root.visible).toBe(true);
  });

  it('disposes every frame geometry and its material', () => {
    const { figure, body, material } = setup();
    const disposed = new Set<BufferGeometry>();
    const geometries: BufferGeometry[] = [];
    for (let frame = 0; frame < quads.length; frame++) {
      figure.update(player(), config, (frame + 0.5) * STEP, 0);
      if (!geometries.includes(body.geometry)) geometries.push(body.geometry);
    }
    for (const geometry of geometries) {
      geometry.addEventListener('dispose', () => disposed.add(geometry));
    }
    let materialDisposed = false;
    material.addEventListener('dispose', () => {
      materialDisposed = true;
    });
    figure.dispose?.();
    expect(geometries).toHaveLength(quads.length);
    expect(disposed.size).toBe(quads.length);
    expect(materialDisposed).toBe(true);
  });
});
