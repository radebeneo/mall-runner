import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNNER_CONFIG } from '../src/config';
import {
  isObstacle,
  OFFER_PATTERN,
  PATTERNS,
  START_PATTERN,
  type TrackPattern,
} from '../src/patterns';

const ALL: readonly TrackPattern[] = [START_PATTERN, OFFER_PATTERN, ...PATTERNS];

describe('patterns', () => {
  it('have unique ids', () => {
    const ids = ALL.map((pattern) => pattern.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keep every item inside one chunk', () => {
    for (const pattern of ALL) {
      for (const item of pattern.items) {
        expect(item.at).toBeGreaterThanOrEqual(0);
        expect(item.at).toBeLessThan(DEFAULT_RUNNER_CONFIG.chunkLength);
      }
    }
  });

  it('never block all three lanes with carts', () => {
    for (const pattern of ALL) {
      const carts = new Map<number, Set<number>>();
      for (const item of pattern.items) {
        if (item.kind !== 'CART') continue;
        const lanes = carts.get(item.at) ?? new Set<number>();
        lanes.add(item.lane);
        carts.set(item.at, lanes);
      }
      for (const lanes of carts.values()) expect(lanes.size).toBeLessThan(3);
    }
  });

  it('never ask for a jump and a roll at the same spot', () => {
    for (const pattern of ALL) {
      const spots = new Set(
        pattern.items
          .filter((item) => item.kind === 'WET_FLOOR')
          .map((item) => `${item.lane}:${item.at}`),
      );
      for (const item of pattern.items) {
        if (item.kind === 'BANNER') expect(spots.has(`${item.lane}:${item.at}`)).toBe(false);
      }
    }
  });

  it('start with coins only', () => {
    expect(START_PATTERN.items.every((item) => item.kind === 'COIN')).toBe(true);
  });

  it('put the offer bag in the pink offer lane', () => {
    const bag = OFFER_PATTERN.items.find((item) => item.kind === 'BAG');
    expect(bag?.lane).toBe(OFFER_PATTERN.offerLane);
  });

  it('tell obstacles from pickups', () => {
    expect(isObstacle('WET_FLOOR')).toBe(true);
    expect(isObstacle('CART')).toBe(true);
    expect(isObstacle('BANNER')).toBe(true);
    expect(isObstacle('COIN')).toBe(false);
    expect(isObstacle('BAG')).toBe(false);
  });
});
