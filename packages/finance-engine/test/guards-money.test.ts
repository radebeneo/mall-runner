import { describe, expect, it } from 'vitest';
import {
  assertCents,
  assertDayOfMonth,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertRate,
} from '../src/guards';
import { interestOn } from '../src/interest';
import { formatRand, roundHalfUpCents, roundUpCents, sumCents } from '../src/money';

describe('guards', () => {
  it.each([0, 1, 124000])('assertCents accepts %s', (value) => {
    expect(() => {
      assertCents(value, 'Amount');
    }).not.toThrow();
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    'assertCents rejects %s',
    (value) => {
      expect(() => {
        assertCents(value, 'Amount');
      }).toThrow(RangeError);
    },
  );

  it('names the offending value in the message', () => {
    expect(() => {
      assertCents(-5, 'Card balance');
    }).toThrow('Card balance must be a non-negative whole number of cents (got -5).');
  });

  it('assertNonNegativeInteger accepts 0 and rejects negatives and fractions', () => {
    expect(() => {
      assertNonNegativeInteger(0, 'Count');
    }).not.toThrow();
    expect(() => {
      assertNonNegativeInteger(-1, 'Count');
    }).toThrow(RangeError);
    expect(() => {
      assertNonNegativeInteger(1.5, 'Count');
    }).toThrow(RangeError);
  });

  it('assertPositiveInteger rejects 0', () => {
    expect(() => {
      assertPositiveInteger(1, 'Months');
    }).not.toThrow();
    expect(() => {
      assertPositiveInteger(0, 'Months');
    }).toThrow(RangeError);
  });

  it.each([0, 0.05, 1])('assertRate accepts %s', (value) => {
    expect(() => {
      assertRate(value, 'Rate');
    }).not.toThrow();
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('assertRate rejects %s', (value) => {
    expect(() => {
      assertRate(value, 'Rate');
    }).toThrow(RangeError);
  });

  it.each([1, 15, 31])('assertDayOfMonth accepts %s', (value) => {
    expect(() => {
      assertDayOfMonth(value, 'Day');
    }).not.toThrow();
  });

  it.each([0, 32, 2.5])('assertDayOfMonth rejects %s', (value) => {
    expect(() => {
      assertDayOfMonth(value, 'Day');
    }).toThrow(RangeError);
  });
});

describe('money', () => {
  it('roundUpCents ignores floating-point noise but rounds real fractions up', () => {
    expect(roundUpCents(124000 * 0.05)).toBe(6200);
    expect(roundUpCents(6200.000000000001)).toBe(6200);
    expect(roundUpCents(6200.4)).toBe(6201);
    expect(roundUpCents(617.25)).toBe(618);
    expect(roundUpCents(-5)).toBe(0);
  });

  it('roundHalfUpCents rounds halves up and clamps at zero', () => {
    expect(roundHalfUpCents(2355.5)).toBe(2356);
    expect(roundHalfUpCents(2355.49)).toBe(2355);
    expect(roundHalfUpCents(117800 * 0.02)).toBe(2356);
    expect(roundHalfUpCents(-1)).toBe(0);
  });

  it('sumCents adds amounts and returns 0 for an empty list', () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([76000, 48000])).toBe(124000);
  });

  it.each([
    [0, 'R0'],
    [5, 'R0.05'],
    [8100, 'R81'],
    [124000, 'R1,240'],
    [120156, 'R1,201.56'],
    [123456789, 'R1,234,567.89'],
    [-5000, '-R50'],
    [-120156, '-R1,201.56'],
  ])('formatRand(%s) is %s', (cents, expected) => {
    expect(formatRand(cents)).toBe(expected);
  });

  it('formatRand refuses fractional cents', () => {
    expect(() => formatRand(1.5)).toThrow(RangeError);
  });
});

describe('interestOn', () => {
  it('applies the monthly rate to the unpaid balance', () => {
    expect(interestOn(117800, 0.02)).toBe(2356);
    expect(interestOn(0, 0.02)).toBe(0);
    expect(interestOn(117800, 0)).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(() => interestOn(-1, 0.02)).toThrow(RangeError);
    expect(() => interestOn(100, 1.5)).toThrow(RangeError);
  });
});
