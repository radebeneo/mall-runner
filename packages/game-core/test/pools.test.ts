import { describe, expect, it } from 'vitest';
import { Pool } from '../src/pools';
import { createRandom } from '../src/random';

describe('Pool', () => {
  it('prefills and reuses free items before creating new ones', () => {
    let created = 0;
    const pool = new Pool(() => ({ id: (created += 1) }), 2);
    expect(pool.size).toBe(2);
    expect(pool.freeCount).toBe(2);
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(created).toBe(3);
    expect(pool.active).toEqual([a, b, c]);
    pool.release(a);
    expect(pool.acquire()).toBe(a);
    expect(created).toBe(3);
  });

  it('releases by swapping with the last active item', () => {
    const pool = new Pool(() => ({}));
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(pool.release(a)).toBe(true);
    expect(pool.active).toEqual([c, b]);
    expect(pool.release(b)).toBe(true);
    expect(pool.active).toEqual([c]);
    expect(pool.release(a)).toBe(false);
    expect(pool.freeCount).toBe(2);
  });

  it('releases everything', () => {
    const pool = new Pool(() => ({}), 1);
    pool.acquire();
    pool.acquire();
    pool.releaseAll();
    expect(pool.active).toHaveLength(0);
    expect(pool.freeCount).toBe(2);
    expect(pool.size).toBe(2);
  });
});

describe('createRandom', () => {
  it('repeats for the same seed and stays in [0, 1)', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 200; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    const a = createRandom(1);
    const b = createRandom(2);
    const first = Array.from({ length: 5 }, () => a());
    const second = Array.from({ length: 5 }, () => b());
    expect(first).not.toEqual(second);
  });
});
