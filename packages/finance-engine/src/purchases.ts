import { assertCents, assertNonNegativeInteger } from './guards';
import { sumCents } from './money';
import type { Cents, MonthState, Purchase, ScenarioConfig, ScenarioPurchase } from './types';

export function assertScenarioPurchase(purchase: ScenarioPurchase): void {
  assertNonNegativeInteger(purchase.monthIndex, `Purchase "${purchase.id}" month`);
  assertCents(purchase.amount, `Purchase "${purchase.id}" amount`);
}

/** The scenario's scheduled card purchases for one month, ready for `buildStatement`. */
export function purchasesForMonth(
  config: Pick<ScenarioConfig, 'purchases'>,
  monthIndex: number,
): Purchase[] {
  assertNonNegativeInteger(monthIndex, 'Month');
  return config.purchases
    .filter((purchase) => purchase.monthIndex === monthIndex)
    .map(({ id, label, amount }) => ({ id, label, amount }));
}

/**
 * The card balance including this month's purchases that are not on a statement yet. Shown in
 * the HUD while the month is in progress.
 */
export function pendingCardBalance(state: MonthState, purchases: readonly Purchase[]): Cents {
  assertCents(state.cardBalance, 'Card balance');
  for (const purchase of purchases) {
    assertCents(purchase.amount, `Purchase "${purchase.id}" amount`);
  }
  return state.cardBalance + sumCents(purchases.map((purchase) => purchase.amount));
}
