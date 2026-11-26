// The manifest that scripts/prepare-mall-assets.py writes next to the runtime mall art. It is
// checked when it loads and turned into world-space quads here. Pure TypeScript with no Three.js
// or DOM, so the numbers are easy to test.

/** `[x, y, width, height]` in image pixels, from the top left. */
export type PixelRect = readonly [number, number, number, number];

export const PROP_IDS = ['coin', 'bucket', 'wet-floor', 'plant', 'bench', 'sale-board'] as const;
export type PropId = (typeof PROP_IDS)[number];

export interface ImageAsset {
  readonly id: string;
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

/** A cut-out that stands on the floor, such as the bucket or a plant. */
export interface PropAsset extends ImageAsset {
  readonly contentRect: PixelRect;
  /** Ground contact point, in image pixels. */
  readonly pivot: readonly [number, number];
  /** The world size of the content along one axis; the other follows the image. */
  readonly worldSize: { readonly axis: 'width' | 'height'; readonly metres: number };
}

/** The rear-view run cycle: equal, padded cells with one shared ground pivot. */
export interface RunnerAsset extends ImageAsset {
  /** Atlas cells, in cycle order. */
  readonly frames: readonly PixelRect[];
  /** Ground contact point inside each cell, in pixels from the cell's top left. */
  readonly pivot: readonly [number, number];
  readonly standingHeightPx: number;
  readonly standingHeightMetres: number;
}

/** A texture that repeats across the floor. */
export interface TileAsset extends ImageAsset {
  /** World size of one repeat, `[across, along]` the corridor, in metres. */
  readonly metres: readonly [number, number];
}

export interface MallManifest {
  readonly props: Readonly<Record<PropId, PropAsset>>;
  readonly runner: RunnerAsset;
  readonly floorTile: TileAsset;
  readonly floorBand: TileAsset;
  /** Every file the manifest lists, including the CSS backgrounds. */
  readonly files: readonly string[];
}

/** A textured rectangle standing on a ground pivot at the origin, in metres. */
export interface Quad {
  readonly width: number;
  readonly height: number;
  /** Left edge, relative to the pivot. */
  readonly left: number;
  /** Bottom edge, relative to the pivot (0 when the art touches the ground). */
  readonly bottom: number;
  /** Texture coordinates with v up, as Three.js samples flipped images. */
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

type Fields = Readonly<Record<string, unknown>>;

function fail(message: string): never {
  throw new Error(`Mall art manifest: ${message}.`);
}

function fields(value: unknown, where: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${where} is not an object`);
  }
  return value as Fields;
}

function finite(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${where} is not a number`);
  return value;
}

function positive(value: unknown, where: string): number {
  const number = finite(value, where);
  if (number <= 0) fail(`${where} must be positive`);
  return number;
}

function name(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') fail(`${where} is not a name`);
  return value;
}

function numbers(value: unknown, length: number, where: string): number[] {
  if (!Array.isArray(value) || value.length !== length) {
    fail(`${where} needs ${String(length)} numbers`);
  }
  return (value as unknown[]).map((item, index) => finite(item, `${where}[${String(index)}]`));
}

function pair(value: unknown, where: string): readonly [number, number] {
  const [a = 0, b = 0] = numbers(value, 2, where);
  return [a, b];
}

function rect(value: unknown, where: string, width: number, height: number): PixelRect {
  const [x = 0, y = 0, w = 0, h = 0] = numbers(value, 4, where);
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) {
    fail(`${where} lies outside the image`);
  }
  return [x, y, w, h];
}

function image(entry: Fields, where: string): ImageAsset {
  return {
    id: name(entry.id, `${where}.id`),
    file: name(entry.file, `${where}.file`),
    width: positive(entry.width, `${where}.width`),
    height: positive(entry.height, `${where}.height`),
  };
}

function parseProp(entry: Fields, where: string): PropAsset {
  const base = image(entry, where);
  const size = fields(entry.worldSize, `${where}.worldSize`);
  const axis = size.axis;
  if (axis !== 'width' && axis !== 'height') {
    fail(`${where}.worldSize.axis must be width or height`);
  }
  return {
    ...base,
    contentRect: rect(entry.contentRect, `${where}.contentRect`, base.width, base.height),
    pivot: pair(entry.pivot, `${where}.pivot`),
    worldSize: { axis, metres: positive(size.metres, `${where}.worldSize.metres`) },
  };
}

function parseRunner(entry: Fields): RunnerAsset {
  const base = image(entry, 'runner');
  const list = entry.frames;
  if (!Array.isArray(list) || list.length === 0) fail('runner.frames needs at least one frame');
  const frames = (list as unknown[]).map((item, index) => {
    const where = `runner.frames[${String(index)}]`;
    const frame = fields(item, where);
    return rect([frame.x, frame.y, frame.w, frame.h], where, base.width, base.height);
  });
  const pivot = pair(entry.pivot, 'runner.pivot');
  if (frames.some(([, , w, h]) => pivot[0] < 0 || pivot[1] < 0 || pivot[0] > w || pivot[1] > h)) {
    fail('runner.pivot lies outside a frame');
  }
  const size = fields(entry.worldSize, 'runner.worldSize');
  if (size.axis !== 'standingHeight') fail('runner.worldSize.axis must be standingHeight');
  return {
    ...base,
    frames,
    pivot,
    standingHeightPx: positive(entry.standingHeightPx, 'runner.standingHeightPx'),
    standingHeightMetres: positive(size.metres, 'runner.worldSize.metres'),
  };
}

function parseTile(entry: Fields, where: string): TileAsset {
  const [across = 0, along = 0] = numbers(entry.metres, 2, `${where}.metres`);
  return {
    ...image(entry, where),
    metres: [positive(across, `${where}.metres[0]`), positive(along, `${where}.metres[1]`)],
  };
}

/** Checks the manifest JSON. Throws a readable error on anything the scene could not draw. */
export function parseMallManifest(raw: unknown): MallManifest {
  const root = fields(raw, 'the manifest');
  if (root.version !== 1) fail('only version 1 is supported');
  const list = root.assets;
  if (!Array.isArray(list)) fail('assets is not a list');

  const byId = new Map<string, Fields>();
  (list as unknown[]).forEach((item, index) => {
    const entry = fields(item, `assets[${String(index)}]`);
    const id = name(entry.id, `assets[${String(index)}].id`);
    if (byId.has(id)) fail(`asset "${id}" is listed twice`);
    byId.set(id, entry);
  });
  const find = (id: string): Fields => byId.get(id) ?? fail(`asset "${id}" is missing`);

  const props = {} as Record<PropId, PropAsset>;
  for (const id of PROP_IDS) props[id] = parseProp(find(id), id);

  return {
    props,
    runner: parseRunner(find('runner')),
    floorTile: parseTile(find('floor-tile'), 'floor-tile'),
    floorBand: parseTile(find('floor-band'), 'floor-band'),
    files: [...byId.entries()].map(([id, entry]) => name(entry.file, `${id}.file`)),
  };
}

// ---------------------------------------------------------------------------------------------
// World-space quads
// ---------------------------------------------------------------------------------------------

/** The quad for one pixel rectangle of an image, at `metresPerPixel`, standing on `pivot`. */
export function rectQuad(
  imageWidth: number,
  imageHeight: number,
  [x, y, w, h]: PixelRect,
  pivot: readonly [number, number],
  metresPerPixel: number,
): Quad {
  return {
    width: w * metresPerPixel,
    height: h * metresPerPixel,
    left: (x - pivot[0]) * metresPerPixel,
    bottom: (pivot[1] - (y + h)) * metresPerPixel,
    u0: x / imageWidth,
    v0: 1 - (y + h) / imageHeight,
    u1: (x + w) / imageWidth,
    v1: 1 - y / imageHeight,
  };
}

/** A prop's content rectangle at its world size. */
export function propQuad(asset: PropAsset): Quad {
  const [, , w, h] = asset.contentRect;
  const pixels = asset.worldSize.axis === 'width' ? w : h;
  return rectQuad(
    asset.width,
    asset.height,
    asset.contentRect,
    asset.pivot,
    asset.worldSize.metres / pixels,
  );
}

/** One quad per run-cycle cell. They share a size and pivot and differ only in UVs. */
export function runnerQuads(asset: RunnerAsset): Quad[] {
  const metresPerPixel = asset.standingHeightMetres / asset.standingHeightPx;
  return asset.frames.map((frame) =>
    rectQuad(
      asset.width,
      asset.height,
      frame,
      [frame[0] + asset.pivot[0], frame[1] + asset.pivot[1]],
      metresPerPixel,
    ),
  );
}
