import { assertCents, assertRate } from './guards';
import { roundHalfUpCents } from './money';
import type { Cents } from './types';

/**
 * Interest for one month on an unpaid balance. Simplified for teaching: a flat monthly rate on
 * what is still owed after the repayment. The rate is a fictional scenario parameter.
 */
export function interestOn(balance: Cents, monthlyRate: number): Cents {
  assertCents(balance, 'Balance');
  assertRate(monthlyRate, 'Monthly interest rate');
  return roundHalfUpCents(balance * monthlyRate);
}
