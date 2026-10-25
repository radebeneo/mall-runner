import { describe, expect, it } from 'vitest';
import { assertCalendarMonth, formatDate, formatShortDate, statementDates } from '../src/calendar';
import { starterTerms } from './helpers';

const terms = (
  startMonth: { year: number; month: number },
  statementCloseDay: number,
  paymentDueDay: number,
) => ({ startMonth, statementCloseDay, paymentDueDay });

describe('statementDates', () => {
  it('closes in the start month and is due the following month for the starter scenario', () => {
    expect(statementDates(starterTerms, 0)).toEqual({
      closes: { year: 2026, month: 9, day: 25 },
      due: { year: 2026, month: 10, day: 5 },
    });
  });

  it('moves forward one calendar month per scenario month', () => {
    expect(statementDates(starterTerms, 2)).toEqual({
      closes: { year: 2026, month: 11, day: 25 },
      due: { year: 2026, month: 12, day: 5 },
    });
  });

  it('crosses into the next year', () => {
    expect(statementDates(terms({ year: 2026, month: 11 }, 25, 5), 1)).toEqual({
      closes: { year: 2026, month: 12, day: 25 },
      due: { year: 2027, month: 1, day: 5 },
    });
    expect(statementDates(terms({ year: 2026, month: 11 }, 25, 5), 2).closes).toEqual({
      year: 2027,
      month: 1,
      day: 25,
    });
  });

  it('is due later the same month when the due day comes after the close day', () => {
    expect(statementDates(terms({ year: 2026, month: 9 }, 5, 25), 0)).toEqual({
      closes: { year: 2026, month: 9, day: 5 },
      due: { year: 2026, month: 9, day: 25 },
    });
  });

  it('is due the next month when the due day equals the close day', () => {
    expect(statementDates(terms({ year: 2026, month: 9 }, 15, 15), 0).due).toEqual({
      year: 2026,
      month: 10,
      day: 15,
    });
  });

  it('moves days past the end of a short month back to its last day', () => {
    expect(statementDates(terms({ year: 2026, month: 4 }, 31, 31), 0)).toEqual({
      closes: { year: 2026, month: 4, day: 30 },
      due: { year: 2026, month: 5, day: 31 },
    });
    expect(statementDates(terms({ year: 2027, month: 2 }, 31, 5), 0).closes.day).toBe(28);
  });

  it('applies leap-year rules to February', () => {
    expect(statementDates(terms({ year: 2028, month: 2 }, 30, 5), 0).closes.day).toBe(29);
    expect(statementDates(terms({ year: 2000, month: 2 }, 30, 5), 0).closes.day).toBe(29);
    expect(statementDates(terms({ year: 1900, month: 2 }, 30, 5), 0).closes.day).toBe(28);
  });

  it('rejects invalid input', () => {
    expect(() => statementDates(starterTerms, -1)).toThrow();
    expect(() => statementDates(starterTerms, 0.5)).toThrow();
    expect(() => statementDates(terms({ year: 2026, month: 13 }, 25, 5), 0)).toThrow();
    expect(() => statementDates(terms({ year: 2026, month: 9 }, 0, 5), 0)).toThrow();
    expect(() => statementDates(terms({ year: 2026, month: 9 }, 25, 32), 0)).toThrow();
  });
});

describe('assertCalendarMonth', () => {
  it('accepts months 1 to 12', () => {
    expect(() => {
      assertCalendarMonth({ year: 2026, month: 1 }, 'Start month');
      assertCalendarMonth({ year: 2026, month: 12 }, 'Start month');
    }).not.toThrow();
  });

  it.each([
    ['month 0', { year: 2026, month: 0 }],
    ['month 13', { year: 2026, month: 13 }],
    ['fractional month', { year: 2026, month: 1.5 }],
    ['year 0', { year: 0, month: 5 }],
  ])('rejects %s', (_label, value) => {
    expect(() => {
      assertCalendarMonth(value, 'Start month');
    }).toThrow(/Start month/);
  });
});

describe('formatDate and formatShortDate', () => {
  it('formats the day and month name', () => {
    expect(formatDate({ year: 2026, month: 9, day: 30 })).toBe('30 September');
    expect(formatDate({ year: 2026, month: 1, day: 1 })).toBe('1 January');
    expect(formatShortDate({ year: 2026, month: 10, day: 25 })).toBe('25 Oct');
    expect(formatShortDate({ year: 2026, month: 5, day: 3 })).toBe('3 May');
  });

  it('rejects an impossible month', () => {
    expect(() => formatDate({ year: 2026, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => formatShortDate({ year: 2026, month: 0, day: 1 })).toThrow(RangeError);
  });
});
