// Where the mall's decoration stands. Variation comes from a hash of each slot's place in the
// mall, so the layout is stable as it scrolls and never uses the simulation's random numbers.
import { LANE_COUNT, type RunnerConfig } from '@credit-runner/game-core';

/** The shopfronts, pillars and props repeat every this many metres. */
export const DECOR_SPACING = 8;
/** Pillars stand this far into each slot, along the corridor. */
export const PILLAR_ALONG = DECOR_SPACING / 2;
/** Ground-floor shopfronts stand this far either side of the centre line. */
export const SHOPFRONT_OFFSET = 6;
/** How far the display bays and canopies stand out from a shopfront. */
export const SHOPFRONT_RELIEF = 0.45;
/** The terracotta inlay band beside the outer lanes. */
export const INLAY_BAND_WIDTH = 0.4;

/** The outer edge of the outer lanes, from the centre line. */
export function outerLaneEdge(config: Readonly<RunnerConfig>): number {
  return (config.laneWidth * LANE_COUNT) / 2;
}

/** Props keep their nearest edge at least this far from the centre line: past the inlay band. */
export function propClearance(config: Readonly<RunnerConfig>): number {
  return outerLaneEdge(config) + INLAY_BAND_WIDTH;
}

export type DecorProp = 'plant' | 'bench' | 'sale-board';
export const DECOR_PROPS: readonly DecorProp[] = ['plant', 'bench', 'sale-board'];

export interface DecorPlacement {
  readonly prop: DecorProp;
  /** Distance of the prop's centre from the centre line, in metres. */
  readonly offset: number;
  /** Metres from its slot's shopfront centre along the corridor, in game z. */
  readonly along: number;
}

/**
 * Benches sit just past the inlay band; plants and boards stand in front of the shops. All are
 * well clear of the pillars, which stand `PILLAR_ALONG` into each slot.
 */
export const DECOR_PLACEMENTS: Readonly<Record<DecorProp, DecorPlacement>> = {
  plant: { prop: 'plant', offset: 4.8, along: 6.6 },
  bench: { prop: 'bench', offset: 3.9, along: 1.6 },
  'sale-board': { prop: 'sale-board', offset: 4.9, along: 2.4 },
};

/** Of every eight slots on a side: three plants, two benches, a sale board and two left clear. */
const ROLL: readonly (DecorProp | null)[] = [
  'plant',
  'plant',
  'plant',
  'bench',
  'bench',
  'sale-board',
  null,
  null,
];

/** A well-mixed unsigned 32-bit hash of a slot and a salt. */
export function hashSlot(slot: number, salt: number): number {
  let h = Math.imul(slot | 0, 0x9e3779b1) ^ Math.imul((salt | 0) + 0x632be5ab, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The prop on one side (-1 left, 1 right) of a slot, or null. Returns shared objects only. */
export function decorAt(slot: number, side: -1 | 1): DecorPlacement | null {
  const prop = ROLL[hashSlot(slot, side === 1 ? 2 : 1) % ROLL.length] ?? null;
  return prop === null ? null : DECOR_PLACEMENTS[prop];
}
