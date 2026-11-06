import { DEFAULT_RUNNER_CONFIG, ENTITY_SIZES } from '@credit-runner/game-core';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/mall/manifest.json';
import { PROP_IDS, parseMallManifest, propQuad, rectQuad, runnerQuads } from './mall-manifest';

interface RawManifest {
  version: unknown;
  assets: Record<string, unknown>[];
}

/** A deep, editable copy of the real manifest. */
function rawCopy(): RawManifest {
  return JSON.parse(JSON.stringify(manifestJson)) as RawManifest;
}

function asset(raw: RawManifest, id: string): Record<string, unknown> {
  const found = raw.assets.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`The test manifest has no ${id}.`);
  return found;
}

/** The runtime files that are actually in the folder. */
const BUNDLED = Object.keys(import.meta.glob('../assets/mall/*.webp')).map((path) =>
  path.slice(path.lastIndexOf('/') + 1),
);

const manifest = parseMallManifest(manifestJson);

describe('mall art manifest', () => {
  it('lists exactly the runtime files in the folder, including both background crops', () => {
    expect([...manifest.files].sort()).toEqual([...BUNDLED].sort());
    expect(manifest.files).toContain('mall-background-desktop.webp');
    expect(manifest.files).toContain('mall-background-mobile.webp');
    expect(manifest.files).not.toContain('image.png');
    expect(manifest.files).toHaveLength(11);
  });

  it('sizes the hazard cut-outs to their hitboxes', () => {
    const bucket = propQuad(manifest.props.bucket);
    expect(bucket.height).toBeCloseTo(ENTITY_SIZES.CART.height, 6);
    expect(bucket.width).toBeLessThanOrEqual(ENTITY_SIZES.CART.width);
    expect(propQuad(manifest.props['wet-floor']).height).toBeCloseTo(
      ENTITY_SIZES.WET_FLOOR.height,
      6,
    );
    expect(Math.abs(propQuad(manifest.props.coin).width - ENTITY_SIZES.COIN.width)).toBeLessThan(
      0.05,
    );
  });

  it('stands the props drawn from above on their highest foot, so none float', () => {
    // Seen from above, the far feet and wheels sit higher in the image than the near ones. The
    // pivot is on the highest contact; the near ones reach below the floor line, but not far.
    for (const id of ['bench', 'bucket'] as const) {
      const quad = propQuad(manifest.props[id]);
      expect(quad.bottom, id).toBeLessThan(-0.1);
      expect(quad.bottom, id).toBeGreaterThan(-0.6);
    }
  });

  it('stands every prop on a centred ground pivot with UVs inside its image', () => {
    for (const id of PROP_IDS) {
      const quad = propQuad(manifest.props[id]);
      if (id !== 'bench' && id !== 'bucket') expect(quad.bottom, id).toBeCloseTo(0, 9);
      expect(quad.left, id).toBeCloseTo(-quad.width / 2, 9);
      expect(quad.u0, id).toBeGreaterThan(0);
      expect(quad.u1, id).toBeLessThan(1);
      expect(quad.v0, id).toBeGreaterThan(0);
      expect(quad.v1, id).toBeLessThan(1);
      expect(quad.u0, id).toBeLessThan(quad.u1);
      expect(quad.v0, id).toBeLessThan(quad.v1);
    }
  });

  it('gives the six run frames one size and foot pivot, each with its own UVs', () => {
    const { runner } = manifest;
    const quads = runnerQuads(runner);
    const metresPerPixel = 1.75 / 460;
    expect(quads).toHaveLength(6);
    for (const quad of quads) {
      expect(quad.width).toBeCloseTo(256 * metresPerPixel, 9);
      expect(quad.height).toBeCloseTo(480 * metresPerPixel, 9);
      // The feet sit on the pivot, 10 px above the bottom of the padded cell.
      expect(quad.bottom).toBeCloseTo(-10 * metresPerPixel, 9);
      expect(quad.left).toBeCloseTo(-128 * metresPerPixel, 9);
    }
    expect(new Set(quads.map((quad) => `${String(quad.u0)},${String(quad.v1)}`)).size).toBe(6);
    expect(quads[0]?.u0).toBeCloseTo(8 / 800, 9);
    expect(quads[0]?.v1).toBeCloseTo(1 - 8 / 984, 9);
  });

  it('lays one floor tile across two lanes so the grout falls on the lane edges', () => {
    expect(manifest.floorTile.metres[0]).toBeCloseTo(DEFAULT_RUNNER_CONFIG.laneWidth * 2, 9);
    expect(manifest.floorBand.metres[1]).toBe(manifest.floorTile.metres[1]);
  });

  it('flips v so it matches how Three.js samples images', () => {
    expect(rectQuad(100, 100, [0, 0, 50, 25], [25, 25], 0.01)).toEqual({
      width: 0.5,
      height: 0.25,
      left: -0.25,
      bottom: 0,
      u0: 0,
      v0: 0.75,
      u1: 0.5,
      v1: 1,
    });
  });

  it('rejects manifests the scene could not draw', () => {
    const cases: [string, (raw: RawManifest) => void, RegExp][] = [
      [
        'version',
        (raw) => {
          raw.version = 2;
        },
        /only version 1/,
      ],
      [
        'missing',
        (raw) => {
          raw.assets = raw.assets.filter((entry) => entry.id !== 'bucket');
        },
        /"bucket" is missing/,
      ],
      [
        'duplicate',
        (raw) => {
          raw.assets.push({ ...asset(raw, 'coin') });
        },
        /"coin" is listed twice/,
      ],
      [
        'rect',
        (raw) => {
          asset(raw, 'bucket').contentRect = [8, 8, 400, 512];
        },
        /bucket\.contentRect lies outside the image/,
      ],
      [
        'pivot',
        (raw) => {
          asset(raw, 'runner').pivot = [300, 10];
        },
        /runner\.pivot lies outside a frame/,
      ],
      [
        'axis',
        (raw) => {
          asset(raw, 'bucket').worldSize = { axis: 'depth', metres: 1 };
        },
        /must be width or height/,
      ],
      [
        'frames',
        (raw) => {
          asset(raw, 'runner').frames = [];
        },
        /at least one frame/,
      ],
      [
        'metres',
        (raw) => {
          asset(raw, 'floor-tile').metres = [0, 3.2];
        },
        /floor-tile\.metres\[0\] must be positive/,
      ],
      [
        'number',
        (raw) => {
          asset(raw, 'bucket').width = 'wide';
        },
        /bucket\.width is not a number/,
      ],
    ];
    for (const [label, change, message] of cases) {
      const raw = rawCopy();
      change(raw);
      expect(() => parseMallManifest(raw), label).toThrow(message);
    }
    expect(() => parseMallManifest(null)).toThrow(/is not an object/);
  });
});
