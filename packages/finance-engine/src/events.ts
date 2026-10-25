import { assertCents, assertNonNegativeInteger } from './guards';
import type { EventFunding, FundingSource, MonthState, ScenarioEvent } from './types';

export const FUNDING_SOURCES: readonly FundingSource[] = [
  'EMERGENCY_SAVINGS',
  'SPENDING_ACCOUNT',
  'CARD',
];

export function assertEvent(event: ScenarioEvent): void {
  assertNonNegativeInteger(event.monthIndex, `Event "${event.id}" month`);
  assertCents(event.cost, `Event "${event.id}" cost`);
}

/**
 * How an unexpected expense would be paid. The chosen source pays as much as it holds; anything
 * it cannot cover goes on the card, and that fallback is reported explicitly.
 */
export function planEventFunding(
  state: MonthState,
  event: ScenarioEvent,
  source: FundingSource,
): EventFunding {
  assertEvent(event);
  const fromSavings =
    source === 'EMERGENCY_SAVINGS' ? Math.min(event.cost, state.emergencySavings) : 0;
  const fromSpending =
    source === 'SPENDING_ACCOUNT' ? Math.min(event.cost, state.spendingAccount) : 0;
  const toCard = event.cost - fromSavings - fromSpending;

  return {
    eventId: event.id,
    cost: event.cost,
    source,
    fromSavings,
    fromSpending,
    toCard,
    fellBackToCard: source !== 'CARD' && toCard > 0,
  };
}

export function applyEvent(
  state: MonthState,
  event: ScenarioEvent,
  fundingSource: FundingSource,
): MonthState {
  const funding = planEventFunding(state, event, fundingSource);
  return {
    ...state,
    emergencySavings: state.emergencySavings - funding.fromSavings,
    spendingAccount: state.spendingAccount - funding.fromSpending,
    cardBalance: state.cardBalance + funding.toCard,
  };
}
