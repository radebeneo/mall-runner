import { DEFAULT_RUNNER_CONFIG } from '@credit-runner/game-core';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/mall/manifest.json';
import {
  DECOR_PLACEMENTS,
  DECOR_PROPS,
  DECOR_SPACING,
  type DecorProp,
  PILLAR_ALONG,
  SHOPFRONT_OFFSET,
  SHOPFRONT_RELIEF,
  decorAt,
  hashSlot,
  outerLaneEdge,
  propClearance,
} from './mall-layout';
import { parseMallManifest, propQuad } from './mall-manifest';

const manifest = parseMallManifest(manifestJson);
/** Pillar base radius, from the pillar model. */
const PILLAR_RADIUS = 0.34;

function halfWidth(prop: DecorProp): number {
  return propQuad(manifest.props[prop]).width / 2;
}

describe('mall decor layout', () => {
  it('keeps the inlay band just outside the three lanes', () => {
    expect(outerLaneEdge(DEFAULT_RUNNER_CONFIG)).toBeCloseTo(2.4, 9);
    expect(propClearance(DEFAULT_RUNNER_CONFIG)).toBeCloseTo(2.8, 9);
  });

  it('keeps every prop clear of the lanes, the inlay band and the shop display bays', () => {
    for (const prop of DECOR_PROPS) {
      const { offset } = DECOR_PLACEMENTS[prop];
      // Conservative: the full cut-out width, as if it faced straight across the corridor.
      expect(offset - halfWidth(prop), prop).toBeGreaterThanOrEqual(
        propClearance(DEFAULT_RUNNER_CONFIG),
      );
      expect(offset + halfWidth(prop), prop).toBeLessThan(SHOPFRONT_OFFSET - SHOPFRONT_RELIEF);
    }
  });

  it('keeps every prop inside its slot and clear of the pillars', () => {
    for (const prop of DECOR_PROPS) {
      const { along } = DECOR_PLACEMENTS[prop];
      expect(along, prop).toBeGreaterThanOrEqual(0);
      expect(along, prop).toBeLessThan(DECOR_SPACING);
      for (const pillar of [
        PILLAR_ALONG - DECOR_SPACING,
        PILLAR_ALONG,
        PILLAR_ALONG + DECOR_SPACING,
      ]) {
        expect(Math.abs(along - pillar), prop).toBeGreaterThan(halfWidth(prop) + PILLAR_RADIUS);
      }
    }
  });

  it('picks the same prop for a slot every time, without the simulation RNG', () => {
    for (let slot = 0; slot < 64; slot++) {
      expect(decorAt(slot, -1)).toBe(decorAt(slot, -1));
      expect(decorAt(slot, 1)).toBe(decorAt(slot, 1));
      expect(hashSlot(slot, 3)).toBe(hashSlot(slot, 3));
    }
  });

  it('hashes to unsigned 32-bit values that vary with the slot and salt', () => {
    const seen = new Set<number>();
    for (let slot = 0; slot < 256; slot++) {
      const value = hashSlot(slot, 1);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
      seen.add(value);
    }
    expect(seen.size).toBe(256);
    expect(hashSlot(5, 1)).not.toBe(hashSlot(5, 2));
  });

  it('mixes plants, benches, boards and gaps in about the planned shares', () => {
    const counts: Record<DecorProp | 'none', number> = {
      plant: 0,
      bench: 0,
      'sale-board': 0,
      none: 0,
    };
    const slots = 8000;
    for (let slot = 0; slot < slots; slot++) {
      counts[decorAt(slot, 1)?.prop ?? 'none'] += 1;
    }
    expect(counts.plant / slots).toBeCloseTo(3 / 8, 1);
    expect(counts.bench / slots).toBeCloseTo(2 / 8, 1);
    expect(counts['sale-board'] / slots).toBeCloseTo(1 / 8, 1);
    expect(counts.none / slots).toBeCloseTo(2 / 8, 1);
  });
});
