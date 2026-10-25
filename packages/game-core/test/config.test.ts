import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNNER_CONFIG, LANE_COUNT, LANE_ROLES, laneX } from '../src/config';

describe('config', () => {
  it('places the lanes around the centre', () => {
    expect(laneX(0, DEFAULT_RUNNER_CONFIG)).toBeCloseTo(-1.6);
    expect(laneX(1, DEFAULT_RUNNER_CONFIG)).toBe(0);
    expect(laneX(2, DEFAULT_RUNNER_CONFIG)).toBeCloseTo(1.6);
  });

  it('keeps the spend and save lanes stubbed as neutral in v1', () => {
    expect(LANE_COUNT).toBe(3);
    expect(Object.values(LANE_ROLES)).toEqual(['NEUTRAL', 'NEUTRAL', 'NEUTRAL']);
  });

  it('freezes the defaults', () => {
    expect(Object.isFrozen(DEFAULT_RUNNER_CONFIG)).toBe(true);
    expect(Object.isFrozen(LANE_ROLES)).toBe(true);
  });
});
