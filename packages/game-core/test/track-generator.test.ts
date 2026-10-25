import { describe, expect, it } from 'vitest';
import { type Box, createBox } from '../src/collision';
import { DEFAULT_RUNNER_CONFIG, type RunnerConfig } from '../src/config';
import {
  advanceTrack,
  createTrack,
  ENTITY_SIZES,
  entityBox,
  resetTrack,
  spawnEntity,
  type TrackState,
} from '../src/track-generator';

const config = DEFAULT_RUNNER_CONFIG;

function chunkIds(track: TrackState): string[] {
  return [...track.chunks.active].sort((a, b) => a.index - b.index).map((c) => c.pattern.id);
}

function patternSequence(
  seed: number,
  count: number,
  cfg: Readonly<RunnerConfig> = config,
): string[] {
  const track = createTrack(cfg, seed);
  const seen = new Map<number, string>();
  const record = (): void => {
    for (const chunk of track.chunks.active) seen.set(chunk.index, chunk.pattern.id);
  };
  record();
  while (seen.size < count) {
    advanceTrack(track, 1, cfg);
    record();
  }
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .slice(0, count);
}

function expectBox(box: Box, expected: Box): void {
  for (const key of Object.keys(expected) as (keyof Box)[]) {
    expect(box[key]).toBeCloseTo(expected[key]);
  }
}

describe('createTrack', () => {
  it('fills the view with chunks, starting with the gentle start pattern', () => {
    const track = createTrack(config, 1);
    const zs = [...track.chunks.active].map((chunk) => chunk.z).sort((a, b) => a - b);
    expect(zs).toEqual([0, 24, 48, 72, 96]);
    expect(track.nextChunkZ).toBe(config.viewDistance);
    expect(chunkIds(track)[0]).toBe('start');
  });

  it('builds the same track for the same seed', () => {
    expect(patternSequence(7, 30)).toEqual(patternSequence(7, 30));
    expect(patternSequence(7, 30)).not.toEqual(patternSequence(8, 30));
  });

  it('places an offer chunk every tenth chunk', () => {
    const ids = patternSequence(3, 30);
    expect(ids[9]).toBe('offer');
    expect(ids[19]).toBe('offer');
    expect(ids[29]).toBe('offer');
    expect(ids.filter((id) => id === 'offer')).toHaveLength(3);
  });

  it('never repeats a regular pattern back to back', () => {
    const ids = patternSequence(11, 60);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it('can turn offer chunks off', () => {
    expect(patternSequence(3, 30, { ...config, offerChunkInterval: 0 })).not.toContain('offer');
  });
});

describe('advanceTrack', () => {
  it('recycles chunks and items without growing the pools', () => {
    const track = createTrack(config, 5);
    for (let d = 0; d < 3000; d += 0.25) advanceTrack(track, 0.25, config);
    expect(track.distance).toBe(3000);
    expect(track.chunks.size).toBe(8);
    expect(track.entities.size).toBe(96);
    for (const chunk of track.chunks.active) {
      expect(chunk.z + config.chunkLength).toBeGreaterThanOrEqual(-config.despawnBehind);
    }
    for (const entity of track.entities.active) {
      expect(entity.z).toBeGreaterThanOrEqual(-config.despawnBehind);
    }
  });

  it('starts the track again just ahead after a very long step', () => {
    const track = createTrack(config, 5);
    advanceTrack(track, 1000, config);
    const zs = [...track.chunks.active].map((chunk) => chunk.z).sort((a, b) => a - b);
    expect(zs).toEqual([0, 24, 48, 72, 96]);
    expect(track.entities.active.every((entity) => entity.z >= 0)).toBe(true);
  });
});

describe('resetTrack', () => {
  it('rebuilds the track from the start', () => {
    const track = createTrack(config, 9);
    advanceTrack(track, 300, config);
    resetTrack(track, config, 9);
    const fresh = createTrack(config, 9);
    expect(chunkIds(track)).toEqual(chunkIds(fresh));
    expect(track.distance).toBe(0);
    expect(track.nextEntityId).toBe(fresh.nextEntityId);
    expect(track.entities.active).toHaveLength(fresh.entities.active.length);
  });
});

describe('spawnEntity and entityBox', () => {
  it('places an item at its default height unless told otherwise', () => {
    const track = createTrack(config, 1);
    const banner = spawnEntity(track, 'BANNER', 0, 30);
    expect(banner).toMatchObject({ kind: 'BANNER', lane: 0, z: 30, hit: false });
    expect(banner.y).toBe(ENTITY_SIZES.BANNER.bottom);
    const bag = spawnEntity(track, 'BAG', 2, 40, 2);
    expect(bag.y).toBe(2);
    expect(bag.id).toBe(banner.id + 1);
  });

  it('builds the collision box from the lane and the item size', () => {
    const track = createTrack(config, 1);
    const cart = spawnEntity(track, 'CART', 2, 10);
    expectBox(entityBox(cart, config, createBox()), {
      minX: 1,
      maxX: 2.2,
      minY: 0,
      maxY: 1.5,
      minZ: 9.3,
      maxZ: 10.7,
    });
  });
});
