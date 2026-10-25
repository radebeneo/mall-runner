import { assertCalendarMonth } from './calendar';
import { assertEvent } from './events';
import {
  assertCents,
  assertDayOfMonth,
  assertNonNegativeInteger,
  assertPositiveInteger,
  assertRate,
} from './guards';
import { sumCents } from './money';
import { assertOffer } from './offers';
import { assertScenarioPurchase } from './purchases';
import type { Cents, MonthState, ScenarioConfig } from './types';

// ---------------------------------------------------------------------------------------------
// Money state across months
// ---------------------------------------------------------------------------------------------

export function validateScenarioConfig(config: ScenarioConfig): void {
  assertPositiveInteger(config.months, 'Months');
  assertPositiveInteger(config.creditLimit, 'Credit limit');
  assertCents(config.monthlyAfterEssentials, 'Monthly money after essentials');
  assertCents(config.existingCommitments, 'Existing commitments');
  assertCents(config.emergencySavings, 'Emergency savings');
  assertRate(config.minimumPaymentRate, 'Minimum payment rate');
  assertRate(config.monthlyInterestRate, 'Monthly interest rate');
  assertCents(config.latePaymentFee, 'Late payment fee');
  assertDayOfMonth(config.statementCloseDay, 'Statement close day');
  assertDayOfMonth(config.paymentDueDay, 'Payment due day');
  assertCalendarMonth(config.startMonth, 'Start month');
  if (config.existingCommitments > config.monthlyAfterEssentials) {
    throw new RangeError('Existing commitments are larger than the money left after essentials.');
  }
  for (const item of [...config.purchases, ...config.events, ...config.offers]) {
    if (item.monthIndex >= config.months) {
      throw new RangeError(`"${item.id}" is set for a month outside the scenario.`);
    }
  }
  config.purchases.forEach((purchase) => {
    assertScenarioPurchase(purchase);
  });
  config.events.forEach((event) => {
    assertEvent(event);
  });
  config.offers.forEach((offer) => {
    assertOffer(offer);
  });
}

/** The state at the start of month 0. The first month's budget is already in the spending account. */
export function createInitialState(config: ScenarioConfig): MonthState {
  validateScenarioConfig(config);
  return {
    monthIndex: 0,
    monthlyAfterEssentials: config.monthlyAfterEssentials,
    cardBalance: 0,
    spendingAccount: config.monthlyAfterEssentials - config.existingCommitments,
    emergencySavings: config.emergencySavings,
    commitments: config.existingCommitments,
    carriedForward: 0,
    instalments: [],
    points: 0,
  };
}

export interface MonthStartResult {
  next: MonthState;
  /** Commitments the month's money could not cover. Zero in a healthy budget. */
  budgetShortfall: Cents;
  /** Offer IDs whose final instalment was paid this month. */
  completedInstalments: string[];
}

/**
 * Moves to the next month: the month's money after essentials arrives, commitments (including
 * instalments) are paid, and finished instalments drop off. Leftover spending money carries over.
 */
export function startNextMonth(state: MonthState): MonthStartResult {
  const funds = state.spendingAccount + state.monthlyAfterEssentials - state.commitments;
  const ticked = state.instalments.map((instalment) => ({
    ...instalment,
    monthsRemaining: instalment.monthsRemaining - 1,
  }));
  const completed = ticked.filter((instalment) => instalment.monthsRemaining <= 0);
  const freed = sumCents(completed.map((instalment) => instalment.monthlyCost));

  return {
    next: {
      ...state,
      monthIndex: state.monthIndex + 1,
      spendingAccount: Math.max(0, funds),
      commitments: state.commitments - freed,
      instalments: ticked.filter((instalment) => instalment.monthsRemaining > 0),
    },
    budgetShortfall: Math.max(0, -funds),
    completedInstalments: completed.map((instalment) => instalment.offerId),
  };
}

// ---------------------------------------------------------------------------------------------
// Screen flow state machine (AGENTS.md section 3)
// ---------------------------------------------------------------------------------------------

export const CYCLE_PHASES = [
  'RUNNING',
  'OFFER_CHECK',
  'EVENT',
  'STATEMENT_READY',
  'PLAN_PAYMENT',
  'MONTH_SUMMARY',
  'FINAL_QUIZ',
  'RUN_SUMMARY',
] as const;

export type CyclePhase = (typeof CYCLE_PHASES)[number];

export interface CycleState {
  phase: CyclePhase;
  monthIndex: number;
  months: number;
  /** Unexpected expenses still to resolve this month. */
  pendingEvents: number;
}

export type CycleAction =
  /** The player picked up a glowing shopping bag. */
  | { type: 'OFFER_TRIGGERED' }
  | { type: 'OFFER_RESOLVED' }
  /** The month's running ended (or was skipped in decisions-only mode). */
  | { type: 'RUN_ENDED'; eventCount: number }
  | { type: 'EVENT_RESOLVED' }
  | { type: 'STATEMENT_VIEWED' }
  | { type: 'PAYMENT_CONFIRMED' }
  | { type: 'MONTH_SUMMARY_DONE' }
  | { type: 'QUIZ_COMPLETED' };

export class InvalidTransitionError extends Error {
  override name = 'InvalidTransitionError';

  constructor(
    readonly phase: CyclePhase,
    readonly actionType: CycleAction['type'],
  ) {
    super(`Cannot handle ${actionType} while in ${phase}.`);
  }
}

export function createCycle(months: number): CycleState {
  assertPositiveInteger(months, 'Months');
  return { phase: 'RUNNING', monthIndex: 0, months, pendingEvents: 0 };
}

export function transition(state: CycleState, action: CycleAction): CycleState {
  switch (state.phase) {
    case 'RUNNING':
      if (action.type === 'OFFER_TRIGGERED') return { ...state, phase: 'OFFER_CHECK' };
      if (action.type === 'RUN_ENDED') {
        assertNonNegativeInteger(action.eventCount, 'Event count');
        return action.eventCount > 0
          ? { ...state, phase: 'EVENT', pendingEvents: action.eventCount }
          : { ...state, phase: 'STATEMENT_READY', pendingEvents: 0 };
      }
      break;
    case 'OFFER_CHECK':
      if (action.type === 'OFFER_RESOLVED') return { ...state, phase: 'RUNNING' };
      break;
    case 'EVENT':
      if (action.type === 'EVENT_RESOLVED') {
        const pendingEvents = state.pendingEvents - 1;
        return pendingEvents > 0
          ? { ...state, pendingEvents }
          : { ...state, phase: 'STATEMENT_READY', pendingEvents: 0 };
      }
      break;
    case 'STATEMENT_READY':
      if (action.type === 'STATEMENT_VIEWED') return { ...state, phase: 'PLAN_PAYMENT' };
      break;
    case 'PLAN_PAYMENT':
      if (action.type === 'PAYMENT_CONFIRMED') return { ...state, phase: 'MONTH_SUMMARY' };
      break;
    case 'MONTH_SUMMARY':
      if (action.type === 'MONTH_SUMMARY_DONE') {
        return state.monthIndex + 1 < state.months
          ? { ...state, phase: 'RUNNING', monthIndex: state.monthIndex + 1 }
          : { ...state, phase: 'FINAL_QUIZ' };
      }
      break;
    case 'FINAL_QUIZ':
      if (action.type === 'QUIZ_COMPLETED') return { ...state, phase: 'RUN_SUMMARY' };
      break;
    case 'RUN_SUMMARY':
      break;
  }
  throw new InvalidTransitionError(state.phase, action.type);
}

export function canTransition(state: CycleState, action: CycleAction): boolean {
  try {
    transition(state, action);
    return true;
  } catch (error) {
    if (error instanceof InvalidTransitionError) return false;
    throw error;
  }
}
