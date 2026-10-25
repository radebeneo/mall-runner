import { assertCalendarMonth, statementDates } from './calendar';
import { assertCents, assertDayOfMonth, assertPositiveInteger, assertRate } from './guards';
import { roundUpCents, sumCents } from './money';
import type {
  Cents,
  MonthState,
  Purchase,
  ScenarioConfig,
  Statement,
  StatementTerms,
} from './types';

/** Picks the terms a statement needs from a scenario. */
export function statementTerms(config: ScenarioConfig): StatementTerms {
  return {
    creditLimit: config.creditLimit,
    minimumPaymentRate: config.minimumPaymentRate,
    monthlyInterestRate: config.monthlyInterestRate,
    latePaymentFee: config.latePaymentFee,
    statementCloseDay: config.statementCloseDay,
    paymentDueDay: config.paymentDueDay,
    startMonth: { ...config.startMonth },
  };
}

export function assertStatementTerms(terms: StatementTerms): void {
  assertPositiveInteger(terms.creditLimit, 'Credit limit');
  assertRate(terms.minimumPaymentRate, 'Minimum payment rate');
  assertRate(terms.monthlyInterestRate, 'Monthly interest rate');
  assertCents(terms.latePaymentFee, 'Late payment fee');
  assertDayOfMonth(terms.statementCloseDay, 'Statement close day');
  assertDayOfMonth(terms.paymentDueDay, 'Payment due day');
  assertCalendarMonth(terms.startMonth, 'Start month');
}

/** Minimum payment: the rate times the balance, rounded up to the cent, never above the balance. */
export function minimumDue(statement: Pick<Statement, 'balance'>, rate: number): Cents {
  assertCents(statement.balance, 'Statement balance');
  assertRate(rate, 'Minimum payment rate');
  return Math.min(statement.balance, roundUpCents(statement.balance * rate));
}

/**
 * Closes the month's statement. The balance is everything already on the card
 * (`state.cardBalance`, which includes the carried-forward amount and any events charged to the
 * card) plus this month's purchases.
 */
export function buildStatement(
  state: MonthState,
  purchases: readonly Purchase[],
  terms: StatementTerms,
): Statement {
  assertStatementTerms(terms);
  assertCents(state.cardBalance, 'Card balance');
  assertCents(state.carriedForward, 'Carried-forward balance');
  for (const purchase of purchases) {
    assertCents(purchase.amount, `Purchase "${purchase.id}" amount`);
  }

  const purchasesTotal = sumCents(purchases.map((purchase) => purchase.amount));
  const balance = state.cardBalance + purchasesTotal;
  const utilisation = balance / terms.creditLimit;
  const dates = statementDates(terms, state.monthIndex);

  return {
    monthIndex: state.monthIndex,
    openingBalance: state.carriedForward,
    purchases: purchases.map((purchase) => ({ ...purchase })),
    purchasesTotal,
    newCharges: balance - state.carriedForward,
    balance,
    minimumDue: minimumDue({ balance }, terms.minimumPaymentRate),
    creditLimit: terms.creditLimit,
    availableCredit: Math.max(0, terms.creditLimit - balance),
    utilisation,
    utilisationPercent: Math.round(utilisation * 100),
    overLimit: balance > terms.creditLimit,
    closeDay: terms.statementCloseDay,
    dueDay: terms.paymentDueDay,
    closeDate: dates.closes,
    dueDate: dates.due,
    terms: { ...terms, startMonth: { ...terms.startMonth } },
  };
}
