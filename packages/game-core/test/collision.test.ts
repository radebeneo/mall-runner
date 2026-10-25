import { describe, expect, it } from 'vitest';
import { createBox, overlaps, setBox } from '../src/collision';

describe('collision', () => {
  it('builds a box from a centre, an underside height and full sizes', () => {
    const box = setBox(createBox(), 1, 0.5, 10, 2, 1, 4);
    expect(box).toEqual({ minX: 0, maxX: 2, minY: 0.5, maxY: 1.5, minZ: 8, maxZ: 12 });
  });

  it('writes into the box it is given', () => {
    const box = createBox();
    expect(setBox(box, 0, 0, 0, 1, 1, 1)).toBe(box);
  });

  it('detects overlapping boxes', () => {
    const a = setBox(createBox(), 0, 0, 0, 2, 2, 2);
    const b = setBox(createBox(), 1, 1, 1, 2, 2, 2);
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  it('treats boxes that only touch as apart', () => {
    const a = setBox(createBox(), 0, 0, 0, 2, 2, 2);
    const b = setBox(createBox(), 2, 0, 0, 2, 2, 2);
    expect(overlaps(a, b)).toBe(false);
  });

  it('separates boxes on any single axis', () => {
    const a = setBox(createBox(), 0, 0, 0, 1, 1, 1);
    expect(overlaps(a, setBox(createBox(), 5, 0, 0, 1, 1, 1))).toBe(false);
    expect(overlaps(a, setBox(createBox(), 0, 5, 0, 1, 1, 1))).toBe(false);
    expect(overlaps(a, setBox(createBox(), 0, 0, 5, 1, 1, 1))).toBe(false);
  });
});
