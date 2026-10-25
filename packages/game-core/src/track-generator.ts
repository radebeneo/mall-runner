import { type Box, setBox } from './collision';
import { type Lane, type RunnerConfig, laneX } from './config';
import {
  type EntityKind,
  OFFER_PATTERN,
  PATTERNS,
  START_PATTERN,
  type TrackPattern,
} from './patterns';
import { Pool } from './pools';
import { createRandom, type Random } from './random';

export interface EntitySize {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  /** Height of the underside above the floor. */
  readonly bottom: number;
}

export const ENTITY_SIZES: Readonly<Record<EntityKind, EntitySize>> = Object.freeze({
  WET_FLOOR: { width: 0.8, height: 0.7, depth: 0.5, bottom: 0 },
  CART: { width: 1.2, height: 1.5, depth: 1.4, bottom: 0 },
  BANNER: { width: 1.4, height: 0.9, depth: 0.3, bottom: 1.1 },
  COIN: { width: 0.6, height: 0.6, depth: 0.6, bottom: 0.5 },
  BAG: { width: 0.9, height: 0.9, depth: 0.9, bottom: 0.3 },
});

export interface TrackEntity {
  /** Unique within a run; changes when the pooled object is reused. */
  id: number;
  kind: EntityKind;
  lane: Lane;
  /** Distance ahead of the player to the centre. */
  z: number;
  /** Underside height. */
  y: number;
  /** An obstacle that has already hit the player. */
  hit: boolean;
}

export interface TrackChunk {
  /** Order in the run, from 0. */
  index: number;
  /** Distance ahead of the player to the near edge. */
  z: number;
  pattern: TrackPattern;
}

export interface TrackState {
  readonly chunks: Pool<TrackChunk>;
  readonly entities: Pool<TrackEntity>;
  random: Random;
  /** Near edge of the next chunk to spawn. */
  nextChunkZ: number;
  chunkCount: number;
  nextEntityId: number;
  lastPattern: TrackPattern | null;
  /** Metres travelled this run. */
  distance: number;
}

const CHUNK_PREFILL = 8;
const ENTITY_PREFILL = 96;

export function createTrack(config: Readonly<RunnerConfig>, seed: number): TrackState {
  const track: TrackState = {
    chunks: new Pool<TrackChunk>(() => ({ index: 0, z: 0, pattern: START_PATTERN }), CHUNK_PREFILL),
    entities: new Pool<TrackEntity>(
      () => ({ id: 0, kind: 'COIN', lane: 1, z: 0, y: 0, hit: false }),
      ENTITY_PREFILL,
    ),
    random: createRandom(seed),
    nextChunkZ: 0,
    chunkCount: 0,
    nextEntityId: 0,
    lastPattern: null,
    distance: 0,
  };
  fillTrack(track, config);
  return track;
}

/** Recycles everything and builds the track again from the start of a run. */
export function resetTrack(track: TrackState, config: Readonly<RunnerConfig>, seed: number): void {
  track.chunks.releaseAll();
  track.entities.releaseAll();
  track.random = createRandom(seed);
  track.nextChunkZ = 0;
  track.chunkCount = 0;
  track.nextEntityId = 0;
  track.lastPattern = null;
  track.distance = 0;
  fillTrack(track, config);
}

/** Places one item on the track. Also used to place items on demand, such as an offer bag. */
export function spawnEntity(
  track: TrackState,
  kind: EntityKind,
  lane: Lane,
  z: number,
  y: number = ENTITY_SIZES[kind].bottom,
): TrackEntity {
  const entity = track.entities.acquire();
  entity.id = track.nextEntityId;
  entity.kind = kind;
  entity.lane = lane;
  entity.z = z;
  entity.y = y;
  entity.hit = false;
  track.nextEntityId += 1;
  return entity;
}

function choosePattern(
  track: TrackState,
  config: Readonly<RunnerConfig>,
  index: number,
): TrackPattern {
  if (index < config.startChunks) return START_PATTERN;
  if (config.offerChunkInterval > 0 && (index + 1) % config.offerChunkInterval === 0) {
    return OFFER_PATTERN;
  }
  let pick = Math.floor(track.random() * PATTERNS.length);
  if (PATTERNS[pick] === track.lastPattern) pick = (pick + 1) % PATTERNS.length;
  // `pick` is always a valid index.
  return PATTERNS[pick] as TrackPattern;
}

function spawnChunk(track: TrackState, config: Readonly<RunnerConfig>): void {
  const pattern = choosePattern(track, config, track.chunkCount);
  const chunk = track.chunks.acquire();
  chunk.index = track.chunkCount;
  chunk.z = track.nextChunkZ;
  chunk.pattern = pattern;
  for (const item of pattern.items) spawnEntity(track, item.kind, item.lane, chunk.z + item.at);
  track.lastPattern = pattern;
  track.chunkCount += 1;
  track.nextChunkZ += config.chunkLength;
}

function fillTrack(track: TrackState, config: Readonly<RunnerConfig>): void {
  while (track.nextChunkZ < config.viewDistance) spawnChunk(track, config);
}

/** Scrolls the world `distance` metres toward the player, recycling what falls behind. */
export function advanceTrack(
  track: TrackState,
  distance: number,
  config: Readonly<RunnerConfig>,
): void {
  track.distance += distance;
  // After a very long step, start the track again just ahead rather than spawning behind.
  track.nextChunkZ = Math.max(track.nextChunkZ - distance, 0);

  const chunks = track.chunks.active;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i] as TrackChunk;
    chunk.z -= distance;
    if (chunk.z + config.chunkLength < -config.despawnBehind) track.chunks.release(chunk);
  }

  const entities = track.entities.active;
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i] as TrackEntity;
    entity.z -= distance;
    if (entity.z < -config.despawnBehind) track.entities.release(entity);
  }

  fillTrack(track, config);
}

/** Writes an item's collision box into `out` and returns it. */
export function entityBox(entity: TrackEntity, config: Readonly<RunnerConfig>, out: Box): Box {
  const size = ENTITY_SIZES[entity.kind];
  return setBox(
    out,
    laneX(entity.lane, config),
    entity.y,
    entity.z,
    size.width,
    size.height,
    size.depth,
  );
}
