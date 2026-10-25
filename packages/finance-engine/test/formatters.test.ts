import { describe, expect, it } from 'vitest';
import { formatPercent, formatPoints, formatWholePercent } from '../src/money';

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [0.02, '2%'],
    [0.05, '5%'],
    [0.025, '2.5%'],
    [0.0525, '5.25%'],
    [0.0205, '2.05%'],
    [0.105, '10.5%'],
    [0.248, '24.8%'],
    [1, '100%'],
  ])('formats %d as %s', (rate, expected) => {
    expect(formatPercent(rate)).toBe(expected);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (rate) => {
    expect(() => formatPercent(rate)).toThrow(RangeError);
  });
});

describe('formatWholePercent', () => {
  it.each([
    [0, '0%'],
    [25, '25%'],
    [100, '100%'],
    [112, '112%'],
  ])('formats %d as %s', (percent, expected) => {
    expect(formatWholePercent(percent)).toBe(expected);
  });

  it.each([-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (percent) => {
    expect(() => formatWholePercent(percent)).toThrow(RangeError);
  });
});

describe('formatPoints', () => {
  it('formats points without a currency sign or thousands separator', () => {
    expect(formatPoints(0)).toBe('0 pts');
    expect(formatPoints(340)).toBe('340 pts');
    expect(formatPoints(12500)).toBe('12500 pts');
    expect(formatPoints(12500)).not.toMatch(/R|,/);
  });

  it.each([-1, 1.5, Number.NaN])('rejects %d', (points) => {
    expect(() => formatPoints(points)).toThrow(RangeError);
  });
});
