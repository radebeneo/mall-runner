import type { Cents } from './types';

// Rates are decimal fractions, so products such as 124000 * 0.05 can land a hair above or
// below the true value. The tolerance stops that noise from moving a result by a whole cent.
const EPSILON = 1e-7;

/** Rounds a non-negative cent amount up to the next whole cent. */
export function roundUpCents(value: number): Cents {
  return Math.max(0, Math.ceil(value - EPSILON));
}

/** Rounds a non-negative cent amount to the nearest whole cent, halves rounding up. */
export function roundHalfUpCents(value: number): Cents {
  return Math.max(0, Math.floor(value + 0.5 + EPSILON));
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Formats cents for display: 124000 -> "R1,240", 120156 -> "R1,201.56", -5000 -> "-R50".
 * Whole-rand amounts omit the cents.
 */
export function formatRand(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Cannot format ${String(cents)}: amounts must be whole cents.`);
  }
  const absolute = Math.abs(cents);
  const rands = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const remainder = absolute % 100;
  const fraction = remainder === 0 ? '' : `.${String(remainder).padStart(2, '0')}`;
  const sign = cents < 0 ? '-' : '';
  return `${sign}R${rands}${fraction}`;
}

/** Formats a rate (a fraction from 0 to 1) as a percentage: 0.02 -> "2%", 0.025 -> "2.5%". */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`Cannot format ${String(rate)}: rates must be between 0 and 1.`);
  }
  const hundredths = Math.round(rate * 10000);
  const whole = Math.floor(hundredths / 100);
  const remainder = hundredths % 100;
  const fraction =
    remainder === 0 ? '' : `.${String(remainder).padStart(2, '0').replace(/0$/, '')}`;
  return `${String(whole)}${fraction}%`;
}

/**
 * Formats a whole-number percentage the engine has already computed, such as
 * `Statement.utilisationPercent`: 25 -> "25%". Values above 100 are allowed, because a balance
 * can go over the credit limit.
 */
export function formatWholePercent(percent: number): string {
  if (!Number.isSafeInteger(percent) || percent < 0) {
    throw new RangeError(`Cannot format ${String(percent)}: percentages must be whole numbers.`);
  }
  return `${String(percent)}%`;
}

/**
 * Formats game points: 340 -> "340 pts". Points are a separate scale from money, so they never get
 * a currency sign or a thousands separator that could make them look like a rand amount.
 */
export function formatPoints(points: number): string {
  if (!Number.isSafeInteger(points) || points < 0) {
    throw new RangeError(`Cannot format ${String(points)}: points must be a whole number.`);
  }
  return `${String(points)} pts`;
}
