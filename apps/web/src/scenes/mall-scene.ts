// The runner's mall, drawn with Three.js from game-core state, following
// art-direction/gameplay-screen.png. Nothing here owns game logic: each frame reads the runner's
// plain objects and writes instance matrices, with no allocations and no React
// (AGENTS.md section 7, rules 1 to 4).
//
// Game space has z as the distance ahead of the player; Three.js looks down -z, so a game z
// becomes a Three.js z of -z.
import {
  type EntityKind,
  type Lane,
  type RunnerConfig,
  type RunnerState,
  type TrackChunk,
  type TrackEntity,
  laneX,
} from '@credit-runner/game-core';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  type ColorRepresentation,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRunnerFigure } from './runner-figure';

/** AGENTS.md section 7, rule 4. */
const MAX_DPR = 2;

const FOG_COLOUR = '#d8d1c4';
const FLOOR_WIDTH = 13;
/** The corridor runs from just behind the player to past the generated track, in game z. */
const FLOOR_NEAR = -14;
const FLOOR_FAR = 150;
const LENGTH = FLOOR_FAR - FLOOR_NEAR;
/** Three.js z of the corridor's middle. */
const MIDDLE_Z = -(FLOOR_NEAR + FLOOR_FAR) / 2;
/** Floor texture repeat, in metres: 2 x 2 tiles of 1 m. */
const FLOOR_TILE_METRES = 2;

/** Shops, pillars and lamps repeat every few metres and scroll with the floor. */
const DECOR_SPACING = 8;
const DECOR_COUNT = Math.ceil(LENGTH / DECOR_SPACING) + 1;
const SHOP_X = 6;
const UPPER_SHOP_X = 7.2;
const UPPER_Y = 4.8;
const PILLAR_X = 4.5;
/** Shop sign colours. No text or real brands on any sign (AGENTS.md section 3). */
const SIGN_COLOURS = ['#e94e77', '#2f9e57', '#f0a024', '#5b3d8f', '#2d8fd5', '#ff7a45'];

/** The offer label shows while the bag is between these distances ahead. */
const OFFER_LABEL_NEAR = 2;
const OFFER_LABEL_FAR = 70;

const ENTITY_KINDS: readonly EntityKind[] = ['COIN', 'WET_FLOOR', 'CART', 'BANNER', 'BAG'];
const CAPACITY: Readonly<Record<EntityKind, number>> = {
  COIN: 160,
  WET_FLOOR: 24,
  CART: 24,
  BANNER: 24,
  BAG: 4,
};

/** Where the offer bag is on screen, in CSS pixels from the top left of the canvas. */
export interface OfferMarker {
  visible: boolean;
  x: number;
  y: number;
}

export interface MallScene {
  /** Draws the offer bag and the pink offer lane. Off once the month's offer is decided. */
  showOffers: boolean;
  /** Updated by `render`. */
  readonly offer: OfferMarker;
  resize: (width: number, height: number) => void;
  /** Draws a frame. `lead` is how many seconds the frame is past the last simulation step. */
  render: (runner: RunnerState, lead: number) => void;
  dispose: () => void;
}

// ---------------------------------------------------------------------------------------------
// Low-poly models. Each is one merged geometry with vertex colours, so a kind is one draw call.
// ---------------------------------------------------------------------------------------------

interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

/** Rotates, moves and paints one piece of a model. */
function part(
  geometry: BufferGeometry,
  colour: ColorRepresentation,
  { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 }: Placement = {},
): BufferGeometry {
  if (rx !== 0) geometry.rotateX(rx);
  if (ry !== 0) geometry.rotateY(ry);
  if (rz !== 0) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  const { r, g, b } = new Color(colour);
  const count = geometry.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = r;
    colours[i * 3 + 1] = g;
    colours[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return geometry;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const piece of parts) piece.dispose();
  if (merged === null) throw new Error('Could not build a mall model.');
  return merged;
}

// Entity models sit on their underside (y = 0) and match game-core's ENTITY_SIZES.

function coinModel(): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.3, 0.3, 0.08, 18), '#f2b632', { y: 0.3, rx: Math.PI / 2 }),
    part(new CylinderGeometry(0.2, 0.2, 0.1, 18), '#d4911a', { y: 0.3, rx: Math.PI / 2 }),
  ]);
}

/** The yellow A-frame sign. */
function wetFloorModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(0.7, 0.75, 0.04), '#f5c518', { y: 0.36, z: 0.11, rx: -0.3 }),
    part(new BoxGeometry(0.7, 0.75, 0.04), '#f5c518', { y: 0.36, z: -0.11, rx: 0.3 }),
    part(new BoxGeometry(0.5, 0.1, 0.05), '#1b1f1d', { y: 0.46, z: 0.11, rx: -0.3 }),
    part(new BoxGeometry(0.5, 0.1, 0.05), '#1b1f1d', { y: 0.46, z: -0.11, rx: 0.3 }),
    part(new ConeGeometry(0.06, 0.08, 4), '#1b1f1d', { y: 0.76 }),
  ]);
}

/** The cleaning cart: body, tray, bucket, mop and wheels. */
function cartModel(): BufferGeometry {
  const wheels = [-1, 1].flatMap((side) =>
    [-1, 1].map((end) =>
      part(new CylinderGeometry(0.09, 0.09, 0.06, 10), '#1b1f1d', {
        x: side * 0.42,
        y: 0.09,
        z: end * 0.45,
        rz: Math.PI / 2,
      }),
    ),
  );
  return merge([
    part(new BoxGeometry(1.0, 0.8, 1.1), '#4a6fa5', { y: 0.55 }),
    part(new BoxGeometry(1.1, 0.06, 1.2), '#2d3e57', { y: 0.98 }),
    part(new CylinderGeometry(0.28, 0.24, 0.4, 12), '#f0a024', { x: 0.2, y: 1.21, z: 0.15 }),
    part(new CylinderGeometry(0.03, 0.03, 0.7, 6), '#c9c9c9', { x: -0.3, y: 1.3, z: -0.2 }),
    part(new BoxGeometry(0.9, 0.05, 0.05), '#2d3e57', { y: 1.25, z: 0.62 }),
    part(new BoxGeometry(0.05, 0.3, 0.05), '#2d3e57', { x: -0.43, y: 1.1, z: 0.6 }),
    part(new BoxGeometry(0.05, 0.3, 0.05), '#2d3e57', { x: 0.43, y: 1.1, z: 0.6 }),
    ...wheels,
  ]);
}

/** A hanging sale banner, rolled under. Its cords run up toward the balcony. */
function bannerModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(1.4, 0.9, 0.08), '#e94e77', { y: 0.45 }),
    part(new BoxGeometry(1.2, 0.16, 0.09), '#fcfaf5', { y: 0.45 }),
    part(new CylinderGeometry(0.02, 0.02, 2.2, 6), '#3b3f47', { x: -0.6, y: 2.0 }),
    part(new CylinderGeometry(0.02, 0.02, 2.2, 6), '#3b3f47', { x: 0.6, y: 2.0 }),
  ]);
}

/** The glowing shopping bag that marks an offer. */
function bagModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(0.6, 0.62, 0.28), '#ff5fa8', { y: 0.31 }),
    part(new BoxGeometry(0.62, 0.06, 0.29), '#ff8cc2', { y: 0.6 }),
    part(new TorusGeometry(0.15, 0.025, 6, 12, Math.PI), '#7a1f4f', { y: 0.62 }),
  ]);
}

/** A shopfront facing +x, with its front at x = 0. The sign band is a separate mesh. */
function shopModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(1.2, 4.2, 7.6), '#3b3f47', { x: -0.6, y: 2.1 }),
    part(new BoxGeometry(0.1, 2.7, 6.4), '#d6ecf2', { x: 0.02, y: 1.55 }),
    part(new BoxGeometry(0.12, 2.7, 0.18), '#3b3f47', { x: 0.06, y: 1.55 }),
    part(new BoxGeometry(0.14, 0.18, 7.6), '#2a2d33', { x: 0.03, y: 0.09 }),
  ]);
}

function createFloorTexture(anisotropy: number): CanvasTexture {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#ebe5d9';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#dcd4c5';
    context.fillRect(0, 0, half, half);
    context.fillRect(half, half, half, half);
    // Grout lines.
    context.fillStyle = 'rgb(150 140 122 / 0.45)';
    context.fillRect(0, 0, size, 2);
    context.fillRect(0, half - 1, size, 2);
    context.fillRect(0, 0, 2, size);
    context.fillRect(half - 1, 0, 2, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.repeat.set(FLOOR_WIDTH / FLOOR_TILE_METRES, LENGTH / FLOOR_TILE_METRES);
  return texture;
}

// ---------------------------------------------------------------------------------------------
// The corridor
// ---------------------------------------------------------------------------------------------

/** Floor, lane lines, balconies and ceiling. None of it moves; the floor texture scrolls. */
function buildCorridor(
  scene: Scene,
  config: Readonly<RunnerConfig>,
  floorTexture: CanvasTexture,
): void {
  scene.add(
    new Mesh(
      new PlaneGeometry(FLOOR_WIDTH, LENGTH).rotateX(-Math.PI / 2).translate(0, 0, MIDDLE_Z),
      new MeshLambertMaterial({ map: floorTexture }),
    ),
  );

  // White lines on the lane edges.
  const lines = [-1.5, -0.5, 0.5, 1.5].map((edge) =>
    new PlaneGeometry(0.07, LENGTH)
      .rotateX(-Math.PI / 2)
      .translate(edge * config.laneWidth, 0.01, MIDDLE_Z),
  );
  scene.add(
    new Mesh(
      merge(lines),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
    ),
  );

  // The upper level: balcony slabs and rails on both sides.
  const balconies = [-1, 1].flatMap((side) => [
    part(new BoxGeometry(2.9, 0.35, LENGTH), '#efe9df', { x: side * 5.75, y: 4.62, z: MIDDLE_Z }),
    part(new BoxGeometry(0.1, 0.08, LENGTH), '#3b3f47', { x: side * 4.32, y: 5.84, z: MIDDLE_Z }),
    part(new BoxGeometry(0.08, 0.06, LENGTH), '#3b3f47', { x: side * 4.32, y: 4.83, z: MIDDLE_Z }),
  ]);
  scene.add(new Mesh(merge(balconies), new MeshLambertMaterial({ vertexColors: true })));

  const glass = [-1, 1].map((side) =>
    new BoxGeometry(0.04, 1.0, LENGTH).translate(side * 4.32, 5.3, MIDDLE_Z),
  );
  scene.add(
    new Mesh(
      merge(glass),
      new MeshLambertMaterial({
        color: '#cfe7ee',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    ),
  );

  // Ceiling and the long skylight.
  scene.add(
    new Mesh(
      new PlaneGeometry(FLOOR_WIDTH + 6, LENGTH).rotateX(Math.PI / 2).translate(0, 9.6, MIDDLE_Z),
      new MeshLambertMaterial({ color: '#e9e3d7' }),
    ),
  );
  scene.add(
    new Mesh(
      new PlaneGeometry(3.4, LENGTH).rotateX(Math.PI / 2).translate(0, 9.55, MIDDLE_Z),
      new MeshBasicMaterial({ color: '#fffaf1' }),
    ),
  );
}

interface ShopRow {
  readonly x: number;
  readonly y: number;
  /** Rotation about y: 0 faces +x (the left side), pi faces -x (the right side). */
  readonly turn: number;
}

const SHOP_ROWS: readonly ShopRow[] = [
  { x: -SHOP_X, y: 0, turn: 0 },
  { x: SHOP_X, y: 0, turn: Math.PI },
  { x: -UPPER_SHOP_X, y: UPPER_Y, turn: 0 },
  { x: UPPER_SHOP_X, y: UPPER_Y, turn: Math.PI },
];

/** Shopfronts, pillars and lamps that scroll past in a seamless loop. */
function createDecor(scene: Scene): (distance: number) => void {
  const slots = DECOR_COUNT * SHOP_ROWS.length;
  const shops = new InstancedMesh(
    shopModel(),
    new MeshLambertMaterial({ vertexColors: true }),
    slots,
  );
  const signs = new InstancedMesh(
    new BoxGeometry(0.3, 0.7, 6.8).translate(0.15, 3.45, 0),
    new MeshLambertMaterial({ color: '#ffffff' }),
    slots,
  );
  const pillars = new InstancedMesh(
    new CylinderGeometry(0.26, 0.3, 4.45, 10).translate(0, 2.225, 0),
    new MeshLambertMaterial({ color: '#f6f2ea' }),
    DECOR_COUNT * 2,
  );
  const lamps = new InstancedMesh(
    new SphereGeometry(0.32, 10, 8).translate(0, 7.4, 0),
    new MeshBasicMaterial({ color: '#fff1cc' }),
    DECOR_COUNT,
  );
  for (const mesh of [shops, signs, pillars, lamps]) {
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  const palette = SIGN_COLOURS.map((colour) => new Color(colour));
  const dummy = new Object3D();
  let colourBase = -1;

  return (distance) => {
    const base = Math.floor(distance / DECOR_SPACING);
    const shift = distance - base * DECOR_SPACING;
    const recolour = base !== colourBase;

    for (let i = 0; i < DECOR_COUNT; i++) {
      const z = -(FLOOR_NEAR + i * DECOR_SPACING - shift);
      for (let row = 0; row < SHOP_ROWS.length; row++) {
        const { x, y, turn } = SHOP_ROWS[row] as ShopRow;
        const index = row * DECOR_COUNT + i;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, turn, 0);
        dummy.updateMatrix();
        shops.setMatrixAt(index, dummy.matrix);
        signs.setMatrixAt(index, dummy.matrix);
        // A shop keeps its colour as it scrolls: the colour follows its place in the mall.
        if (recolour) {
          signs.setColorAt(index, palette[(base + i + row * 2) % palette.length] as Color);
        }
      }

      dummy.rotation.set(0, 0, 0);
      dummy.position.set(-PILLAR_X, 0, z - DECOR_SPACING / 2);
      dummy.updateMatrix();
      pillars.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.x = PILLAR_X;
      dummy.updateMatrix();
      pillars.setMatrixAt(i * 2 + 1, dummy.matrix);

      dummy.position.set(0, 0, z);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
    }

    shops.instanceMatrix.needsUpdate = true;
    signs.instanceMatrix.needsUpdate = true;
    pillars.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    if (recolour) {
      colourBase = base;
      if (signs.instanceColor !== null) signs.instanceColor.needsUpdate = true;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * Builds the mall into `container`. Throws when WebGL is unavailable, so the caller can offer
 * decisions-only play instead (AGENTS.md section 7, rule 7).
 */
export function createMallScene(container: HTMLElement, config: Readonly<RunnerConfig>): MallScene {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new Scene();
  scene.background = new Color(FOG_COLOUR);
  scene.fog = new Fog(FOG_COLOUR, 40, FLOOR_FAR - 10);
  const camera = new PerspectiveCamera(55, 1, 0.1, FLOOR_FAR + 20);

  scene.add(new HemisphereLight('#fff8ec', '#8f887c', 2.4));
  const sun = new DirectionalLight('#ffffff', 1.4);
  sun.position.set(4, 12, 8);
  scene.add(sun);

  const floorTexture = createFloorTexture(renderer.capabilities.getMaxAnisotropy());
  buildCorridor(scene, config, floorTexture);
  const updateDecor = createDecor(scene);

  // Track items: one instanced mesh per kind (AGENTS.md section 7, rule 3).
  const meshes: Record<EntityKind, InstancedMesh> = {
    COIN: new InstancedMesh(
      coinModel(),
      new MeshLambertMaterial({ vertexColors: true, emissive: '#5c3b00' }),
      CAPACITY.COIN,
    ),
    WET_FLOOR: new InstancedMesh(
      wetFloorModel(),
      new MeshLambertMaterial({ vertexColors: true }),
      CAPACITY.WET_FLOOR,
    ),
    CART: new InstancedMesh(
      cartModel(),
      new MeshLambertMaterial({ vertexColors: true }),
      CAPACITY.CART,
    ),
    BANNER: new InstancedMesh(
      bannerModel(),
      new MeshLambertMaterial({ vertexColors: true }),
      CAPACITY.BANNER,
    ),
    BAG: new InstancedMesh(
      bagModel(),
      new MeshLambertMaterial({ vertexColors: true, emissive: '#ff3d96', emissiveIntensity: 0.55 }),
      CAPACITY.BAG,
    ),
  };
  const halo = new InstancedMesh(
    new SphereGeometry(0.62, 14, 10).translate(0, 0.45, 0),
    new MeshBasicMaterial({
      color: '#ff7ab8',
      transparent: true,
      opacity: 0.28,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
    CAPACITY.BAG,
  );
  for (const mesh of [...Object.values(meshes), halo]) {
    // Instances move every frame, so a bounding sphere from one frame would cull wrongly.
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
  }

  // The pink offer lane under the chunk that carries the bag.
  const offerLane = new Mesh(
    new PlaneGeometry(config.laneWidth * 0.94, config.chunkLength).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: '#ff5fa8', transparent: true, opacity: 0.5, depthWrite: false }),
  );
  offerLane.visible = false;
  scene.add(offerLane);

  const shadow = new Mesh(
    new CircleGeometry(0.42, 16).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  scene.add(shadow);

  const figure = createRunnerFigure();
  scene.add(figure.root);

  // Scratch objects, reused every frame.
  const dummy = new Object3D();
  const projected = new Vector3();
  const counts: Record<EntityKind, number> = { COIN: 0, WET_FLOOR: 0, CART: 0, BANNER: 0, BAG: 0 };

  let viewWidth = 1;
  let viewHeight = 1;
  let cameraDistance = 6;

  const api: MallScene = {
    showOffers: true,
    offer: { visible: false, x: 0, y: 0 },

    resize: (width, height) => {
      if (width <= 0 || height <= 0) return;
      viewWidth = width;
      viewHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Portrait phones get a wider lens and a camera further back, so all three lanes fit.
      camera.fov = camera.aspect < 1 ? 68 : 55;
      const halfWidthPerMetre = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
      cameraDistance = Math.max(6, 3.1 / halfWidthPerMetre);
      camera.updateProjectionMatrix();
    },

    render: (runner, lead) => {
      const { player, track } = runner;
      const running = player.condition !== 'CRASHED';
      const speed = !running
        ? 0
        : player.condition === 'STUMBLING'
          ? runner.speed * config.stumbleSpeedFactor
          : runner.speed;
      // How far the world has moved since the last fixed step, for smooth motion between steps.
      const ahead = speed * lead;
      const distance = track.distance + ahead;
      const time = runner.time + (running ? lead : 0);

      camera.position.set(player.x * 0.45, 1.6 + cameraDistance * 0.34, cameraDistance);
      camera.lookAt(player.x * 0.3, 1.1, -14);
      camera.updateMatrixWorld();

      floorTexture.offset.y = (distance / FLOOR_TILE_METRES) % 1;
      updateDecor(distance);

      for (let k = 0; k < ENTITY_KINDS.length; k++) counts[ENTITY_KINDS[k] as EntityKind] = 0;
      let bag: TrackEntity | null = null;
      const entities = track.entities.active;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i] as TrackEntity;
        const { kind } = entity;
        if (kind === 'BAG' && !api.showOffers) continue;
        const index = counts[kind];
        if (index >= CAPACITY[kind]) continue;

        let y = entity.y;
        let spin = 0;
        let tilt = 0;
        if (kind === 'COIN') {
          spin = time * 3.5 + entity.id * 0.6;
        } else if (kind === 'BAG') {
          y += Math.sin(time * 3) * 0.08;
          spin = Math.sin(time * 1.5) * 0.5;
          bag = entity;
        } else if (entity.hit) {
          // An obstacle the player ran into stays knocked askew.
          tilt = 0.4;
        }
        dummy.position.set(laneX(entity.lane, config), y, -(entity.z - ahead));
        dummy.rotation.set(0, spin, tilt);
        dummy.updateMatrix();
        meshes[kind].setMatrixAt(index, dummy.matrix);
        if (kind === 'BAG') halo.setMatrixAt(index, dummy.matrix);
        counts[kind] = index + 1;
      }
      for (let k = 0; k < ENTITY_KINDS.length; k++) {
        const kind = ENTITY_KINDS[k] as EntityKind;
        const mesh = meshes[kind];
        mesh.count = counts[kind];
        mesh.instanceMatrix.needsUpdate = true;
      }
      halo.count = counts.BAG;
      halo.instanceMatrix.needsUpdate = true;

      let offerChunk: TrackChunk | null = null;
      let offerLaneIndex: Lane = 1;
      if (api.showOffers) {
        const chunks = track.chunks.active;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i] as TrackChunk;
          if (chunk.pattern.offerLane !== undefined) {
            offerChunk = chunk;
            offerLaneIndex = chunk.pattern.offerLane;
            break;
          }
        }
      }
      offerLane.visible = offerChunk !== null;
      if (offerChunk !== null) {
        offerLane.position.set(
          laneX(offerLaneIndex, config),
          0.012,
          -(offerChunk.z - ahead + config.chunkLength / 2),
        );
      }

      const marker = api.offer;
      marker.visible = false;
      if (bag !== null) {
        const bagZ = bag.z - ahead;
        if (bagZ > OFFER_LABEL_NEAR && bagZ < OFFER_LABEL_FAR) {
          projected.set(laneX(bag.lane, config), bag.y + 1.35, -bagZ).project(camera);
          if (projected.z < 1) {
            marker.visible = true;
            marker.x = (projected.x + 1) * 0.5 * viewWidth;
            marker.y = (1 - projected.y) * 0.5 * viewHeight;
          }
        }
      }

      figure.update(player, config, distance, time);
      shadow.position.set(player.x, 0.015, 0);
      shadow.scale.setScalar(1 - Math.min(player.y, 2) * 0.25);

      renderer.render(scene, camera);
    },

    dispose: () => {
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        // `instanceof` narrows to `Mesh<any, any>`; every mesh here uses these types.
        if (object instanceof InstancedMesh) (object as InstancedMesh).dispose();
        const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      floorTexture.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };

  return api;
}
