// The low-poly runner in the green shirt, seen from behind as on art-direction/gameplay-screen.png.
// It only mirrors game-core's player state; it never changes it.
import { type PlayerState, type RunnerConfig, laneX } from '@credit-runner/game-core';
import { BoxGeometry, Group, type Material, Mesh, MeshLambertMaterial } from 'three';

/** Leg swing per metre run, in radians. */
const STRIDE_PER_METRE = 1.5;

export interface RunnerFigure {
  readonly root: Group;
  /** Poses the figure from the player's state. `distance` and `time` drive the run cycle. */
  update: (
    player: PlayerState,
    config: Readonly<RunnerConfig>,
    distance: number,
    time: number,
  ) => void;
}

export function createRunnerFigure(): RunnerFigure {
  const skin = new MeshLambertMaterial({ color: '#8d5a3b' });
  const shirt = new MeshLambertMaterial({ color: '#2f9e57' });
  const collar = new MeshLambertMaterial({ color: '#237a43' });
  const jeans = new MeshLambertMaterial({ color: '#2c3e63' });
  const shoe = new MeshLambertMaterial({ color: '#f4f1ea' });
  const hair = new MeshLambertMaterial({ color: '#1f1612' });

  // `root` follows the player; `body` pivots at the feet for leaning, rolling and falling.
  const root = new Group();
  const body = new Group();
  root.add(body);

  const box = (
    width: number,
    height: number,
    depth: number,
    material: Material,
    x: number,
    y: number,
    z: number,
    parent: Group,
  ): void => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  };

  const pivot = (x: number, y: number): Group => {
    const group = new Group();
    group.position.set(x, y, 0);
    body.add(group);
    return group;
  };

  // The camera looks along -z, so the figure runs toward -z and shows its back (+z).
  const legs = [pivot(-0.12, 0.88), pivot(0.12, 0.88)] as const;
  for (const leg of legs) {
    box(0.19, 0.8, 0.21, jeans, 0, -0.42, 0, leg);
    box(0.21, 0.1, 0.32, shoe, 0, -0.83, -0.05, leg);
  }

  box(0.52, 0.12, 0.3, jeans, 0, 0.92, 0, body);
  box(0.5, 0.6, 0.28, shirt, 0, 1.2, 0, body);
  box(0.3, 0.06, 0.24, collar, 0, 1.5, 0, body);

  const arms = [pivot(-0.33, 1.45), pivot(0.33, 1.45)] as const;
  for (const arm of arms) {
    box(0.15, 0.26, 0.17, shirt, 0, -0.11, 0, arm);
    box(0.12, 0.36, 0.13, skin, 0, -0.42, 0, arm);
  }

  box(0.12, 0.08, 0.12, skin, 0, 1.55, 0, body);
  box(0.28, 0.3, 0.28, skin, 0, 1.72, 0, body);
  box(0.3, 0.12, 0.3, hair, 0, 1.86, 0.01, body);
  box(0.3, 0.24, 0.06, hair, 0, 1.74, 0.13, body);

  const [leftLeg, rightLeg] = legs;
  const [leftArm, rightArm] = arms;

  return {
    root,
    update: (player, config, distance, time) => {
      const crashed = player.condition === 'CRASHED';
      const stumbling = player.condition === 'STUMBLING';
      const rolling = player.motion === 'ROLL';
      const airborne = player.y > 0;

      root.position.set(player.x, crashed ? 0.12 : player.y, 0);

      const stride = crashed ? 0 : Math.sin(distance * STRIDE_PER_METRE);
      if (airborne && !rolling) {
        leftLeg.rotation.x = 0.9;
        rightLeg.rotation.x = -0.35;
        leftArm.rotation.x = -1.2;
        rightArm.rotation.x = 0.6;
      } else {
        leftLeg.rotation.x = stride * 0.8;
        rightLeg.rotation.x = -stride * 0.8;
        leftArm.rotation.x = -stride * 0.7;
        rightArm.rotation.x = stride * 0.7;
      }

      body.scale.y = rolling ? 0.55 : 1;
      // Lean into a lane change, and forward while rolling, stumbling or after a crash.
      const offset = laneX(player.lane, config) - player.x;
      body.rotation.z = Math.max(-0.3, Math.min(0.3, -offset * 0.18));
      body.rotation.x = crashed ? -1.45 : rolling ? -0.45 : stumbling ? -0.25 : -0.08;

      // Flash during the grace period after a stumble.
      root.visible = !(stumbling && player.graceTime > 0 && Math.floor(time * 12) % 2 === 1);
    },
  };
}
