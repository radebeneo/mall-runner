import { assertCents } from './guards';
import { interestOn } from './interest';
import { roundUpCents } from './money';
import type { Cents, MonthState, RepaymentChoice, RepaymentOutcome, Statement } from './types';

export const REPAYMENT_CHOICES: readonly RepaymentChoice[] = ['FULL', 'HALF', 'MINIMUM', 'NONE'];

/**
 * What a repayment choice asks the player to pay. "Half" rounds up to the cent and is never
 * less than the minimum.
 */
export function repaymentAmount(statement: Statement, choice: RepaymentChoice): Cents {
  switch (choice) {
    case 'FULL':
      return statement.balance;
    case 'HALF':
      return Math.max(statement.minimumDue, roundUpCents(statement.balance / 2));
    case 'MINIMUM':
      return statement.minimumDue;
    case 'NONE':
      return 0;
  }
}

function computeOutcome(
  state: MonthState,
  statement: Statement,
  choice: RepaymentChoice,
): RepaymentOutcome {
  if (statement.monthIndex !== state.monthIndex) {
    throw new RangeError(
      `Statement is for month ${String(statement.monthIndex)} but the state is month ${String(state.monthIndex)}.`,
    );
  }
  assertCents(state.spendingAccount, 'Spending account');

  const requested = repaymentAmount(statement, choice);
  const paid = Math.min(requested, state.spendingAccount);
  const remainingOwed = statement.balance - paid;
  const interestCharged = interestOn(remainingOwed, statement.terms.monthlyInterestRate);
  const missedPayment = paid < statement.minimumDue;
  const lateFee = missedPayment ? statement.terms.latePaymentFee : 0;

  return {
    choice,
    statementBalance: statement.balance,
    minimumDue: statement.minimumDue,
    requested,
    paid,
    shortfall: requested - paid,
    remainingOwed,
    interestFreeKept: remainingOwed === 0,
    interestCharged,
    missedPayment,
    lateFee,
    nextOpeningBalance: remainingOwed + interestCharged + lateFee,
    spendingAccountAfter: state.spendingAccount - paid,
  };
}

/**
 * Applies the player's repayment. Payment comes from the spending account and never exceeds it;
 * any gap is reported as `shortfall`. Interest and any late fee are posted immediately, so the
 * next month opens with a concrete balance.
 */
export function applyRepayment(
  state: MonthState,
  statement: Statement,
  choice: RepaymentChoice,
): { next: MonthState; outcome: RepaymentOutcome } {
  const outcome = computeOutcome(state, statement, choice);
  const next: MonthState = {
    ...state,
    spendingAccount: outcome.spendingAccountAfter,
    cardBalance: outcome.nextOpeningBalance,
    carriedForward: outcome.nextOpeningBalance,
  };
  return { next, outcome };
}

/** The outcome of a choice the player did not make. Powers "What if I paid only the minimum?". */
export function projectAlternate(
  state: MonthState,
  statement: Statement,
  choice: RepaymentChoice,
): RepaymentOutcome {
  return computeOutcome(state, statement, choice);
}

/** Outcomes for every choice, for the comparison shown after the player has chosen. */
export function compareRepaymentChoices(
  state: MonthState,
  statement: Statement,
): RepaymentOutcome[] {
  return REPAYMENT_CHOICES.map((choice) => computeOutcome(state, statement, choice));
}
