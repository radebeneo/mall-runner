// The runner's mall, drawn with Three.js from game-core state, following
// art-direction/gameplay-screen.png. Nothing here owns game logic: each frame reads the runner's
// plain objects and writes instance matrices, with no allocations and no React
// (AGENTS.md section 7, rules 1 to 4).
//
// Two looks share one layout. With the prepared art (src/assets/mall) the coins, the bucket, the
// wet-floor sign, the runner and the side props are camera-facing cut-outs, and the floor uses
// the generated stone tile. Without it (still loading, failed, or no art) everything is drawn
// with the low-poly procedural models. The corridor, shopfronts, banner and bag are real 3D in
// both looks.
//
// Game space has z as the distance ahead of the player; Three.js looks down -z, so a game z
// becomes a Three.js z of -z.
import {
  ENTITY_SIZES,
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
  Group,
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
  type Texture,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cutoutMaterial, quadGeometry, yawToward } from './billboard';
import { type MallArt, type MallTextureId, type SceneTextures, cloneArtTextures } from './mall-art';
import {
  DECOR_PROPS,
  DECOR_SPACING,
  type DecorProp,
  INLAY_BAND_WIDTH,
  PILLAR_ALONG,
  SHOPFRONT_OFFSET,
  SHOPFRONT_RELIEF,
  decorAt,
  hashSlot,
  outerLaneEdge,
} from './mall-layout';
import { type MallManifest, type PropId, propQuad, runnerQuads } from './mall-manifest';
import { type RunnerFigure, createRunnerFigure } from './runner-figure';
import { createSpriteRunnerFigure } from './runner-sprite';

/** AGENTS.md section 7, rule 4. */
const MAX_DPR = 2;

const FOG_COLOUR = '#ddd5c6';
const FLOOR_WIDTH = 13;
/** The corridor runs from just behind the player to past the generated track, in game z. */
const FLOOR_NEAR = -14;
const FLOOR_FAR = 150;
const LENGTH = FLOOR_FAR - FLOOR_NEAR;
/** Three.js z of the corridor's middle. */
const MIDDLE_Z = -(FLOOR_NEAR + FLOOR_FAR) / 2;
/** The procedural floor texture repeats every 2 m (2 x 2 tiles of 1 m). */
const PROCEDURAL_TILE_METRES = 2;

const DECOR_COUNT = Math.ceil(LENGTH / DECOR_SPACING) + 1;
const SHOP_X = SHOPFRONT_OFFSET;
const UPPER_SHOP_X = 7.2;
const UPPER_Y = 4.8;
const PILLAR_X = 4.5;
/** Shop sign colours: warm accents to sit with the cream stone. No text or brands (section 3). */
const SIGN_COLOURS = ['#b5653f', '#5f8a6b', '#d49a3a', '#6b4a7a', '#3f7f86', '#a8473f', '#3b3f47'];

const CHARCOAL = '#2a2d33';
const METAL = '#3b3f47';
const TERRACOTTA = '#b5653f';
const GLASS = '#d3e6ea';

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

/** The last frame's renderer counts, for the `?perf` readout. */
export interface SceneStats {
  drawCalls: number;
  triangles: number;
}

export interface MallSceneOptions {
  /** The prepared art, or null (the default) for the procedural mall. */
  art?: MallArt | null;
  /** Turns off decorative motion: coin bob and shimmer, bag bob and the stumble wobble. */
  reducedMotion?: boolean;
}

export interface MallScene {
  /** Draws the offer bag and the pink offer lane. Off once the month's offer is decided. */
  showOffers: boolean;
  /** Updated by `render`. */
  readonly offer: OfferMarker;
  /** True when the prepared art is drawn, false for the procedural mall. */
  readonly usesArt: boolean;
  /** Updated by `render`. */
  readonly stats: SceneStats;
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

/** The model's height before scaling: the top of the cone. */
const WET_FLOOR_MODEL_HEIGHT = 0.8;

/** The yellow A-frame sign, scaled to its hitbox height and kept inside its width. */
function wetFloorModel(): BufferGeometry {
  const { width, height } = ENTITY_SIZES.WET_FLOOR;
  return merge([
    part(new BoxGeometry(0.7, 0.75, 0.04), '#f5c518', { y: 0.36, z: 0.11, rx: -0.3 }),
    part(new BoxGeometry(0.7, 0.75, 0.04), '#f5c518', { y: 0.36, z: -0.11, rx: 0.3 }),
    part(new BoxGeometry(0.5, 0.1, 0.05), '#1b1f1d', { y: 0.46, z: 0.11, rx: -0.3 }),
    part(new BoxGeometry(0.5, 0.1, 0.05), '#1b1f1d', { y: 0.46, z: -0.11, rx: 0.3 }),
    part(new ConeGeometry(0.06, 0.08, 4), '#1b1f1d', { y: 0.76 }),
  ]).scale(Math.min(1, (width * 0.95) / 0.7), height / WET_FLOOR_MODEL_HEIGHT, 1);
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

/**
 * A banner hanging from a dark rod on two long cords, so it reads as overhead (roll under it).
 * Teal cloth with a cream stripe keeps it apart from the pink offer bag. Text-free.
 */
function bannerModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(1.4, 0.9, 0.06), '#2f6f73', { y: 0.45 }),
    part(new BoxGeometry(1.4, 0.12, 0.07), '#f3ead8', { y: 0.26 }),
    part(new BoxGeometry(1.4, 0.05, 0.075), TERRACOTTA, { y: 0.05 }),
    part(new CylinderGeometry(0.035, 0.035, 1.62, 8), CHARCOAL, { y: 0.92, rz: Math.PI / 2 }),
    part(new CylinderGeometry(0.015, 0.015, 2.7, 5), METAL, { x: -0.62, y: 2.27 }),
    part(new CylinderGeometry(0.015, 0.015, 2.7, 5), METAL, { x: 0.62, y: 2.27 }),
  ]);
}

/** The glowing pink shopping bag that marks an offer: handles and a blank tag, no text. */
function bagModel(): BufferGeometry {
  return merge([
    part(new BoxGeometry(0.62, 0.66, 0.3), '#ff5fa8', { y: 0.33 }),
    part(new BoxGeometry(0.64, 0.07, 0.31), '#ffd1e6', { y: 0.63 }),
    part(new TorusGeometry(0.16, 0.03, 6, 14, Math.PI), '#7a1f4f', { y: 0.66, z: 0.07 }),
    part(new TorusGeometry(0.16, 0.03, 6, 14, Math.PI), '#7a1f4f', { y: 0.66, z: -0.07 }),
    part(new BoxGeometry(0.16, 0.2, 0.02), '#fcfaf5', { x: 0.18, y: 0.32, z: 0.16, rz: 0.2 }),
  ]);
}

/**
 * A shopfront facing +x with its front at x = 0: two windows either side of a recessed
 * entrance. The sign band is a separate mesh.
 */
function glazedShopModel(): BufferGeometry {
  const windows = [-1, 1].flatMap((end) => [
    part(new BoxGeometry(0.5, 4.2, 3.0), METAL, { x: -0.25, y: 2.1, z: end * 2.3 }),
    part(new BoxGeometry(0.1, 2.7, 2.9), GLASS, { x: 0.02, y: 1.55, z: end * 2.3 }),
    part(new BoxGeometry(0.16, 0.18, 3.0), CHARCOAL, { x: 0.04, y: 0.09, z: end * 2.3 }),
    part(new BoxGeometry(0.14, 2.9, 0.16), CHARCOAL, { x: 0.04, y: 1.45, z: end * 0.8 }),
    part(new BoxGeometry(0.14, 2.9, 0.16), CHARCOAL, { x: 0.04, y: 1.45, z: end * 3.72 }),
  ]);
  return merge([
    part(new BoxGeometry(0.7, 4.2, 7.6), METAL, { x: -0.85, y: 2.1 }),
    ...windows,
    // The recessed entrance: a lintel over a warm, lit interior.
    part(new BoxGeometry(0.5, 1.6, 1.6), METAL, { x: -0.25, y: 3.4 }),
    part(new BoxGeometry(0.04, 2.6, 1.6), '#7a6656', { x: -0.48, y: 1.3 }),
    part(new BoxGeometry(0.5, 0.08, 1.6), CHARCOAL, { x: -0.25, y: 2.6 }),
    // Goods in the windows, as plain shapes.
    part(new BoxGeometry(0.04, 0.8, 0.7), TERRACOTTA, { x: 0.09, y: 0.9, z: -2.8 }),
    part(new BoxGeometry(0.04, 1.1, 0.5), '#5f8a6b', { x: 0.09, y: 1.05, z: -1.7 }),
    part(new BoxGeometry(0.04, 0.6, 0.9), '#f3ead8', { x: 0.09, y: 0.8, z: 2.4 }),
  ]);
}

/** A shopfront facing +x with a display bay standing out, a canopy and a glazed door. */
function displayShopModel(): BufferGeometry {
  const relief = SHOPFRONT_RELIEF;
  return merge([
    part(new BoxGeometry(1.2, 4.2, 7.6), METAL, { x: -0.6, y: 2.1 }),
    part(new BoxGeometry(relief, 2.2, 3.4), GLASS, { x: relief / 2, y: 1.4, z: -1.7 }),
    part(new BoxGeometry(relief + 0.04, 0.3, 3.44), CHARCOAL, { x: relief / 2, y: 0.15, z: -1.7 }),
    part(new BoxGeometry(relief + 0.06, 0.1, 3.5), CHARCOAL, { x: relief / 2, y: 2.55, z: -1.7 }),
    part(new BoxGeometry(0.04, 0.9, 0.8), '#d49a3a', { x: relief + 0.01, y: 0.95, z: -2.4 }),
    part(new BoxGeometry(0.04, 1.3, 0.6), '#6b4a7a', { x: relief + 0.01, y: 1.15, z: -1.1 }),
    part(new BoxGeometry(0.08, 2.4, 0.9), GLASS, { x: 0.02, y: 1.4, z: 0.7 }),
    part(new BoxGeometry(0.08, 2.6, 1.8), '#7a6656', { x: 0.02, y: 1.3, z: 2.2 }),
    part(new BoxGeometry(0.12, 2.8, 0.14), CHARCOAL, { x: 0.04, y: 1.4, z: 1.25 }),
    part(new BoxGeometry(0.12, 2.8, 0.14), CHARCOAL, { x: 0.04, y: 1.4, z: 3.15 }),
    part(new BoxGeometry(0.7, 0.08, 7.2), TERRACOTTA, { x: 0.35, y: 2.95 }),
    part(new BoxGeometry(0.14, 0.18, 7.6), CHARCOAL, { x: 0.03, y: 0.09 }),
  ]);
}

/** A cream pillar with dark metal at its foot and top. */
function pillarModel(): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.26, 0.3, 4.45, 12), '#f6f2ea', { y: 2.225 }),
    part(new CylinderGeometry(0.34, 0.34, 0.16, 12), METAL, { y: 0.08 }),
    part(new CylinderGeometry(0.34, 0.3, 0.16, 12), METAL, { y: 4.37 }),
  ]);
}

/** A pendant lamp on a thin rod from the ceiling. */
function lampModel(): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.015, 0.015, 2.0, 5), METAL, { y: 8.5 }),
    part(new CylinderGeometry(0.12, 0.3, 0.22, 12), CHARCOAL, { y: 7.62 }),
    part(new SphereGeometry(0.26, 10, 8), '#fff1cc', { y: 7.42 }),
  ]);
}

function createFloorTexture(): CanvasTexture {
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
  return texture;
}

// ---------------------------------------------------------------------------------------------
// The corridor
// ---------------------------------------------------------------------------------------------

/**
 * A flat strip of floor whose UVs are in world units: one texture repeat every `across` by
 * `along` metres, with u = 0 at x = `uOrigin`. It runs `extend` metres past the far end, so the
 * floor group can scroll by up to one repeat without a gap.
 */
function floorStrip(
  left: number,
  right: number,
  across: number,
  along: number,
  uOrigin: number,
  lift: number,
  extend: number,
): BufferGeometry {
  const geometry = new PlaneGeometry(right - left, LENGTH + extend)
    .rotateX(-Math.PI / 2)
    .translate((left + right) / 2, lift, -(FLOOR_NEAR + FLOOR_FAR + extend) / 2);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) - uOrigin) / across, -position.getZ(i) / along);
  }
  return geometry;
}

/** The two inlay bands just outside the outer lanes. */
function bandStrips(config: Readonly<RunnerConfig>, along: number, extend: number): BufferGeometry {
  const inner = outerLaneEdge(config);
  const outer = inner + INLAY_BAND_WIDTH;
  return merge([
    floorStrip(-outer, -inner, INLAY_BAND_WIDTH, along, -outer, 0.005, extend),
    floorStrip(inner, outer, INLAY_BAND_WIDTH, along, inner, 0.005, extend),
  ]);
}

/** Lane lines, balconies and ceiling. None of it moves. */
function buildCorridor(scene: Scene, config: Readonly<RunnerConfig>, withArt: boolean): void {
  // Thin lines on the lane edges: bright on the procedural floor, a soft cream inlay on the
  // stone, where the grout also falls on the lane edges.
  const lines = [-1.5, -0.5, 0.5, 1.5].map((edge) =>
    new PlaneGeometry(withArt ? 0.05 : 0.07, LENGTH)
      .rotateX(-Math.PI / 2)
      .translate(edge * config.laneWidth, 0.01, MIDDLE_Z),
  );
  scene.add(
    new Mesh(
      merge(lines),
      new MeshBasicMaterial({
        color: withArt ? '#fffaf0' : '#ffffff',
        transparent: true,
        opacity: withArt ? 0.6 : 0.9,
        depthWrite: false,
      }),
    ),
  );

  // The upper level: balcony slabs and dark metal rails on both sides.
  const balconies = [-1, 1].flatMap((side) => [
    part(new BoxGeometry(2.9, 0.35, LENGTH), '#efe9df', { x: side * 5.75, y: 4.62, z: MIDDLE_Z }),
    part(new BoxGeometry(0.1, 0.08, LENGTH), METAL, { x: side * 4.32, y: 5.84, z: MIDDLE_Z }),
    part(new BoxGeometry(0.08, 0.06, LENGTH), METAL, { x: side * 4.32, y: 4.83, z: MIDDLE_Z }),
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

type DecorMeshes = Readonly<Record<DecorProp, InstancedMesh>>;

/**
 * Shopfronts, pillars, lamps, skylight ribs and (with the art) the side props, scrolling past in
 * a seamless loop. Each slot's look comes from a hash of its place in the mall, so it never
 * changes as it scrolls.
 */
function createDecor(
  scene: Scene,
  props: DecorMeshes | null,
): (distance: number, cameraX: number, cameraZ: number) => void {
  const slots = DECOR_COUNT * SHOP_ROWS.length;
  const shopMaterial = new MeshLambertMaterial({ vertexColors: true });
  const glazed = new InstancedMesh(glazedShopModel(), shopMaterial, slots);
  const display = new InstancedMesh(displayShopModel(), shopMaterial, slots);
  const signs = new InstancedMesh(
    new BoxGeometry(0.3, 0.7, 6.8).translate(0.15, 3.45, 0),
    new MeshLambertMaterial({ color: '#ffffff' }),
    slots,
  );
  const pillars = new InstancedMesh(
    pillarModel(),
    new MeshLambertMaterial({ vertexColors: true }),
    DECOR_COUNT * 2,
  );
  const lamps = new InstancedMesh(
    lampModel(),
    new MeshBasicMaterial({ vertexColors: true }),
    DECOR_COUNT,
  );
  const ribs = new InstancedMesh(
    new BoxGeometry(3.6, 0.14, 0.14).translate(0, 9.48, 0),
    new MeshLambertMaterial({ color: METAL }),
    DECOR_COUNT * 2,
  );
  const meshes: InstancedMesh[] = [glazed, display, signs, pillars, lamps, ribs];
  if (props !== null) for (const prop of DECOR_PROPS) meshes.push(props[prop]);
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  const palette = SIGN_COLOURS.map((colour) => new Color(colour));
  const dummy = new Object3D();
  const propCounts: Record<DecorProp, number> = { plant: 0, bench: 0, 'sale-board': 0 };
  let colourBase = Number.NaN;

  return (distance, cameraX, cameraZ) => {
    const base = Math.floor(distance / DECOR_SPACING);
    const shift = distance - base * DECOR_SPACING;
    const recolour = base !== colourBase;
    let glazedCount = 0;
    let displayCount = 0;
    for (let p = 0; p < DECOR_PROPS.length; p++) propCounts[DECOR_PROPS[p] as DecorProp] = 0;

    for (let i = 0; i < DECOR_COUNT; i++) {
      const slot = base + i;
      const z = -(FLOOR_NEAR + i * DECOR_SPACING - shift);
      for (let row = 0; row < SHOP_ROWS.length; row++) {
        const { x, y, turn } = SHOP_ROWS[row] as ShopRow;
        const index = row * DECOR_COUNT + i;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, turn, 0);
        dummy.updateMatrix();
        if ((hashSlot(slot, 20 + row) & 1) === 0) {
          glazed.setMatrixAt(glazedCount, dummy.matrix);
          glazedCount += 1;
        } else {
          display.setMatrixAt(displayCount, dummy.matrix);
          displayCount += 1;
        }
        signs.setMatrixAt(index, dummy.matrix);
        // A shop keeps its colour as it scrolls: the colour follows its place in the mall.
        if (recolour) {
          signs.setColorAt(index, palette[hashSlot(slot, 10 + row) % palette.length] as Color);
        }
      }

      dummy.rotation.set(0, 0, 0);
      dummy.position.set(-PILLAR_X, 0, z - PILLAR_ALONG);
      dummy.updateMatrix();
      pillars.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.x = PILLAR_X;
      dummy.updateMatrix();
      pillars.setMatrixAt(i * 2 + 1, dummy.matrix);

      dummy.position.set(0, 0, z);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
      ribs.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.z = z - DECOR_SPACING / 2;
      dummy.updateMatrix();
      ribs.setMatrixAt(i * 2 + 1, dummy.matrix);

      if (props === null) continue;
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const placement = decorAt(slot, side);
        if (placement === null) continue;
        const px = side * placement.offset;
        const pz = z - placement.along;
        dummy.position.set(px, 0, pz);
        // Cut-outs turn to the camera, so they never show an edge or a mirrored back.
        dummy.rotation.set(0, yawToward(px, pz, cameraX, cameraZ), 0);
        dummy.updateMatrix();
        const count = propCounts[placement.prop];
        props[placement.prop].setMatrixAt(count, dummy.matrix);
        propCounts[placement.prop] = count + 1;
      }
    }

    glazed.count = glazedCount;
    display.count = displayCount;
    glazed.instanceMatrix.needsUpdate = true;
    display.instanceMatrix.needsUpdate = true;
    signs.instanceMatrix.needsUpdate = true;
    pillars.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    ribs.instanceMatrix.needsUpdate = true;
    if (props !== null) {
      for (let p = 0; p < DECOR_PROPS.length; p++) {
        const prop = DECOR_PROPS[p] as DecorProp;
        props[prop].count = propCounts[prop];
        props[prop].instanceMatrix.needsUpdate = true;
      }
    }
    if (recolour) {
      colourBase = base;
      if (signs.instanceColor !== null) signs.instanceColor.needsUpdate = true;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Track items
// ---------------------------------------------------------------------------------------------

interface EntityLook {
  readonly mesh: InstancedMesh;
  /** A cut-out that turns to face the camera, instead of a model that is spun or left square. */
  readonly billboard: boolean;
  /** A floor decal showing the hitbox's footprint under a cut-out, or null. */
  readonly decal: InstancedMesh | null;
}

/** A flat ellipse on the floor covering a hitbox's width and depth. */
function footprintDecal(
  kind: EntityKind,
  colour: ColorRepresentation,
  opacity: number,
): InstancedMesh {
  const { width, depth } = ENTITY_SIZES[kind];
  return new InstancedMesh(
    new CircleGeometry(0.5, 24).rotateX(-Math.PI / 2).scale(width, 1, depth),
    new MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }),
    CAPACITY[kind],
  );
}

interface ArtLook {
  readonly manifest: MallManifest;
  readonly textures: Readonly<Record<MallTextureId, Texture>>;
}

function cutoutMesh(look: ArtLook, id: PropId, capacity: number): InstancedMesh {
  return new InstancedMesh(
    quadGeometry(propQuad(look.manifest.props[id])),
    cutoutMaterial(look.textures[id]),
    capacity,
  );
}

function entityLooks(look: ArtLook | null): Record<EntityKind, EntityLook> {
  const solid = (geometry: BufferGeometry, material: Material, kind: EntityKind): EntityLook => ({
    mesh: new InstancedMesh(geometry, material, CAPACITY[kind]),
    billboard: false,
    decal: null,
  });
  const banner = solid(bannerModel(), new MeshLambertMaterial({ vertexColors: true }), 'BANNER');
  const bag = solid(
    bagModel(),
    new MeshLambertMaterial({ vertexColors: true, emissive: '#ff3d96', emissiveIntensity: 0.55 }),
    'BAG',
  );
  if (look === null) {
    const plain = new MeshLambertMaterial({ vertexColors: true });
    return {
      COIN: solid(
        coinModel(),
        new MeshLambertMaterial({ vertexColors: true, emissive: '#5c3b00' }),
        'COIN',
      ),
      WET_FLOOR: solid(wetFloorModel(), plain, 'WET_FLOOR'),
      CART: solid(cartModel(), plain, 'CART'),
      BANNER: banner,
      BAG: bag,
    };
  }
  return {
    COIN: { mesh: cutoutMesh(look, 'coin', CAPACITY.COIN), billboard: true, decal: null },
    WET_FLOOR: {
      mesh: cutoutMesh(look, 'wet-floor', CAPACITY.WET_FLOOR),
      billboard: true,
      // A puddle as wide as the hitbox: the sign itself is narrower than the space it blocks.
      decal: footprintDecal('WET_FLOOR', '#8fb3c4', 0.5),
    },
    CART: {
      mesh: cutoutMesh(look, 'bucket', CAPACITY.CART),
      billboard: true,
      decal: footprintDecal('CART', '#000000', 0.22),
    },
    BANNER: banner,
    BAG: bag,
  };
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * Builds the mall into `container`. Throws when WebGL is unavailable, so the caller can offer
 * decisions-only play instead (AGENTS.md section 7, rule 7).
 */
export function createMallScene(
  container: HTMLElement,
  config: Readonly<RunnerConfig>,
  options: MallSceneOptions = {},
): MallScene {
  const art = options.art ?? null;
  const reducedMotion = options.reducedMotion ?? false;

  // Created first: it throws without WebGL, before anything else is allocated.
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

  // Skylight daylight: a warm sky and bounce, and soft sun from above.
  scene.add(new HemisphereLight('#fff8ec', '#8f887c', 2.4));
  const sun = new DirectionalLight('#ffffff', 1.4);
  sun.position.set(4, 12, 8);
  scene.add(sun);

  // This scene's own copies of the shared art, so disposing it never breaks another scene.
  const sceneTextures: SceneTextures | null =
    art === null ? null : cloneArtTextures(art, renderer.capabilities.getMaxAnisotropy());
  const look: ArtLook | null =
    art === null || sceneTextures === null
      ? null
      : { manifest: art.manifest, textures: sceneTextures.textures };

  // The floor and its inlay bands scroll together by moving this group, never a texture offset.
  const floor = new Group();
  scene.add(floor);
  let floorPeriod = PROCEDURAL_TILE_METRES;
  let proceduralFloor: CanvasTexture | null = null;
  if (look !== null) {
    const tile = look.manifest.floorTile;
    const band = look.manifest.floorBand;
    floorPeriod = tile.metres[1];
    const tileTexture = look.textures['floor-tile'];
    floor.add(
      new Mesh(
        // u = 0 on a lane edge, so the grout (every half texture, one lane width) marks the lanes.
        floorStrip(
          -FLOOR_WIDTH / 2,
          FLOOR_WIDTH / 2,
          tile.metres[0],
          floorPeriod,
          config.laneWidth / 2,
          0,
          floorPeriod,
        ),
        new MeshLambertMaterial({ map: tileTexture }),
      ),
    );
    floor.add(
      new Mesh(
        bandStrips(config, band.metres[1], floorPeriod),
        new MeshLambertMaterial({ map: look.textures['floor-band'] }),
      ),
    );
  } else {
    proceduralFloor = createFloorTexture();
    proceduralFloor.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    floor.add(
      new Mesh(
        floorStrip(
          -FLOOR_WIDTH / 2,
          FLOOR_WIDTH / 2,
          PROCEDURAL_TILE_METRES,
          PROCEDURAL_TILE_METRES,
          0,
          0,
          PROCEDURAL_TILE_METRES,
        ),
        new MeshLambertMaterial({ map: proceduralFloor }),
      ),
    );
    floor.add(
      new Mesh(
        bandStrips(config, PROCEDURAL_TILE_METRES, PROCEDURAL_TILE_METRES),
        new MeshLambertMaterial({ color: TERRACOTTA }),
      ),
    );
  }
  // The floor is drawn first and never writes depth. The bench and bucket are drawn from above,
  // so they stand on their far feet and wheels and the near ones reach just below the floor
  // line; this lets those near parts show over the floor instead of being cut off.
  floor.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    // `instanceof` narrows to Mesh<any, any>; the floor is built from plain meshes.
    const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
    mesh.renderOrder = -1;
    for (const material of [mesh.material].flat()) material.depthWrite = false;
  });

  buildCorridor(scene, config, look !== null);
  const decorProps: DecorMeshes | null =
    look === null
      ? null
      : {
          plant: cutoutMesh(look, 'plant', DECOR_COUNT * 2),
          bench: cutoutMesh(look, 'bench', DECOR_COUNT * 2),
          'sale-board': cutoutMesh(look, 'sale-board', DECOR_COUNT * 2),
        };
  const updateDecor = createDecor(scene, decorProps);

  // Track items: one instanced mesh per kind (AGENTS.md section 7, rule 3).
  const looks = entityLooks(look);
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
  const entityMeshes: InstancedMesh[] = [halo];
  for (const kind of ENTITY_KINDS) {
    const { mesh, decal } = looks[kind];
    entityMeshes.push(mesh);
    if (decal !== null) entityMeshes.push(decal);
  }
  for (const mesh of entityMeshes) {
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

  const figure: RunnerFigure =
    look === null
      ? createRunnerFigure()
      : createSpriteRunnerFigure(
          look.textures.runner,
          runnerQuads(look.manifest.runner),
          reducedMotion,
        );
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
    usesArt: look !== null,
    stats: { drawCalls: 0, triangles: 0 },

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
      const cameraX = camera.position.x;
      const cameraZ = camera.position.z;

      floor.position.z = distance % floorPeriod;
      updateDecor(distance, cameraX, cameraZ);

      for (let k = 0; k < ENTITY_KINDS.length; k++) counts[ENTITY_KINDS[k] as EntityKind] = 0;
      let bag: TrackEntity | null = null;
      const entities = track.entities.active;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i] as TrackEntity;
        const { kind } = entity;
        if (kind === 'BAG' && !api.showOffers) continue;
        const index = counts[kind];
        if (index >= CAPACITY[kind]) continue;
        const entityLook = looks[kind];

        const x = laneX(entity.lane, config);
        const z = -(entity.z - ahead);
        let y = entity.y;
        let yaw = entityLook.billboard ? yawToward(x, z, cameraX, cameraZ) : 0;
        let tilt = 0;
        let scale = 1;
        if (kind === 'COIN') {
          if (!entityLook.billboard) {
            if (!reducedMotion) yaw = time * 3.5 + entity.id * 0.6;
          } else if (!reducedMotion) {
            // A gentle bob and shimmer; the coin always faces the camera.
            y += Math.sin(time * 2.6 + entity.id * 0.7) * 0.05;
            scale = 1 + Math.sin(time * 5 + entity.id) * 0.03;
          }
        } else if (kind === 'BAG') {
          if (!reducedMotion) {
            y += Math.sin(time * 3) * 0.08;
            yaw = Math.sin(time * 1.5) * 0.5;
          }
          bag = entity;
        } else if (entity.hit) {
          // An obstacle the player ran into stays knocked askew.
          tilt = 0.4;
        }
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, tilt);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        entityLook.mesh.setMatrixAt(index, dummy.matrix);
        if (kind === 'BAG') halo.setMatrixAt(index, dummy.matrix);
        if (entityLook.decal !== null) {
          dummy.position.set(x, 0.014, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          entityLook.decal.setMatrixAt(index, dummy.matrix);
        }
        counts[kind] = index + 1;
      }
      dummy.scale.setScalar(1);
      for (let k = 0; k < ENTITY_KINDS.length; k++) {
        const kind = ENTITY_KINDS[k] as EntityKind;
        const { mesh, decal } = looks[kind];
        mesh.count = counts[kind];
        mesh.instanceMatrix.needsUpdate = true;
        if (decal !== null) {
          decal.count = counts[kind];
          decal.instanceMatrix.needsUpdate = true;
        }
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
      api.stats.drawCalls = renderer.info.render.calls;
      api.stats.triangles = renderer.info.render.triangles;
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
      // Sprite frames that are not on screen are outside the scene graph.
      figure.dispose?.();
      proceduralFloor?.dispose();
      sceneTextures?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };

  return api;
}
