import type { Lane } from './config';

/** Wet floor signs are jumped, banners are rolled under and carts need a lane change. */
export type ObstacleKind = 'WET_FLOOR' | 'CART' | 'BANNER';
export type EntityKind = ObstacleKind | 'COIN' | 'BAG';

export interface PatternItem {
  readonly kind: EntityKind;
  readonly lane: Lane;
  /** Metres from the near edge of the chunk. */
  readonly at: number;
}

/** Layout of one track chunk. */
export interface TrackPattern {
  readonly id: string;
  readonly items: readonly PatternItem[];
  /** Lane painted as the pink offer lane, when the chunk carries an offer bag. */
  readonly offerLane?: Lane;
}

export function isObstacle(kind: EntityKind): kind is ObstacleKind {
  return kind === 'WET_FLOOR' || kind === 'CART' || kind === 'BANNER';
}

function item(kind: EntityKind, lane: Lane, at: number): PatternItem {
  return { kind, lane, at };
}

/** Coins every 2 m from `from` to `to`, inclusive. */
function coins(lane: Lane, from: number, to: number): PatternItem[] {
  const items: PatternItem[] = [];
  for (let at = from; at <= to; at += 2) items.push(item('COIN', lane, at));
  return items;
}

/** Opening chunk: coins only, so the player can settle in. */
export const START_PATTERN: TrackPattern = { id: 'start', items: coins(1, 8, 20) };

/** Chunk with the glowing shopping bag in the centre lane, as in the gameplay mockup. */
export const OFFER_PATTERN: TrackPattern = {
  id: 'offer',
  offerLane: 1,
  items: [item('CART', 2, 6), item('WET_FLOOR', 0, 10), item('BAG', 1, 16), ...coins(0, 14, 20)],
};

/**
 * Regular chunks. Each one leaves a way through: carts never fill every lane, and a lane never
 * asks for a jump and a roll at once.
 */
export const PATTERNS: readonly TrackPattern[] = [
  {
    id: 'coin-line',
    items: [...coins(1, 2, 12), item('WET_FLOOR', 0, 10), item('WET_FLOOR', 2, 18)],
  },
  {
    id: 'cart-left',
    items: [item('CART', 0, 8), ...coins(2, 4, 14), item('WET_FLOOR', 1, 16)],
  },
  {
    id: 'banner-centre',
    items: [...coins(1, 4, 10), item('BANNER', 1, 8), item('CART', 2, 16)],
  },
  {
    id: 'wet-floor-row',
    items: [
      item('WET_FLOOR', 0, 12),
      item('WET_FLOOR', 1, 12),
      item('WET_FLOOR', 2, 12),
      ...coins(1, 6, 18),
    ],
  },
  {
    id: 'carts-sides',
    items: [item('CART', 0, 10), item('CART', 2, 10), ...coins(1, 4, 16)],
  },
  {
    id: 'zigzag',
    items: [
      ...coins(0, 2, 4),
      ...coins(1, 7, 9),
      ...coins(2, 12, 14),
      item('BANNER', 0, 18),
      item('BANNER', 1, 18),
    ],
  },
  {
    id: 'cart-banner',
    items: [
      ...coins(0, 2, 10),
      item('CART', 1, 6),
      item('BANNER', 0, 14),
      item('WET_FLOOR', 2, 14),
    ],
  },
];
