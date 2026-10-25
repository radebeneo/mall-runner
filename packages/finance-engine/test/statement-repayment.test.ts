import { describe, expect, it } from 'vitest';
import {
  REPAYMENT_CHOICES,
  applyRepayment,
  compareRepaymentChoices,
  projectAlternate,
  repaymentAmount,
} from '../src/repayment';
import { assertStatementTerms, buildStatement, minimumDue, statementTerms } from '../src/statement';
import { makeState, makeTerms, starterConfig, starterTerms, statementFor } from './helpers';

describe('statementTerms', () => {
  it('copies only the statement terms from a scenario', () => {
    expect(statementTerms(starterConfig)).toEqual({
      creditLimit: 500000,
      minimumPaymentRate: 0.05,
      monthlyInterestRate: 0.02,
      latePaymentFee: 15000,
      statementCloseDay: 25,
      paymentDueDay: 5,
      startMonth: { year: 2026, month: 9 },
    });
  });

  it('rejects invalid terms', () => {
    expect(() => {
      assertStatementTerms(makeTerms({ creditLimit: 0 }));
    }).toThrow(RangeError);
    expect(() => {
      assertStatementTerms(makeTerms({ paymentDueDay: 32 }));
    }).toThrow(RangeError);
    expect(() => {
      assertStatementTerms(makeTerms({ latePaymentFee: -1 }));
    }).toThrow(RangeError);
  });
});

describe('minimumDue', () => {
  it('is the rate times the balance, rounded up to the cent', () => {
    expect(minimumDue({ balance: 124000 }, 0.05)).toBe(6200);
    expect(minimumDue({ balance: 12345 }, 0.05)).toBe(618);
  });

  it('is never more than the balance, and zero on a zero balance', () => {
    expect(minimumDue({ balance: 1 }, 0.05)).toBe(1);
    expect(minimumDue({ balance: 0 }, 0.05)).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(() => minimumDue({ balance: -1 }, 0.05)).toThrow(RangeError);
    expect(() => minimumDue({ balance: 100 }, 2)).toThrow(RangeError);
  });
});

describe('buildStatement', () => {
  it('separates the carried-forward balance from new charges', () => {
    const state = makeState({ cardBalance: 150000, carriedForward: 120000 });
    const statement = buildStatement(
      state,
      [
        { id: 'a', label: 'Shoes', amount: 40000 },
        { id: 'b', label: 'Snack', amount: 5000 },
      ],
      starterTerms,
    );
    expect(statement.openingBalance).toBe(120000);
    expect(statement.purchasesTotal).toBe(45000);
    expect(statement.newCharges).toBe(75000);
    expect(statement.balance).toBe(195000);
    expect(statement.availableCredit).toBe(305000);
    expect(statement.overLimit).toBe(false);
    expect(statement.closeDay).toBe(25);
    expect(statement.dueDay).toBe(5);
  });

  it('flags an over-limit balance and reports no available credit', () => {
    const statement = statementFor(makeState({ cardBalance: 520000 }));
    expect(statement.overLimit).toBe(true);
    expect(statement.availableCredit).toBe(0);
    expect(statement.utilisationPercent).toBe(104);
  });

  it('copies purchases and terms so later changes cannot alter the statement', () => {
    const purchases = [{ id: 'a', label: 'Shoes', amount: 40000 }];
    const terms = makeTerms();
    const statement = buildStatement(makeState(), purchases, terms);
    expect(statement.purchases).toEqual(purchases);
    expect(statement.purchases[0]).not.toBe(purchases[0]);
    expect(statement.terms).not.toBe(terms);
  });

  it('rejects invalid purchases, balances and terms', () => {
    expect(() =>
      buildStatement(makeState(), [{ id: 'x', label: 'Bad', amount: 10.5 }], starterTerms),
    ).toThrow('Purchase "x" amount');
    expect(() => statementFor(makeState({ cardBalance: -1 }))).toThrow(RangeError);
    expect(() => statementFor(makeState({ carriedForward: -1 }))).toThrow(RangeError);
    expect(() => statementFor(makeState(), makeTerms({ minimumPaymentRate: 1.2 }))).toThrow(
      RangeError,
    );
  });
});

describe('repaymentAmount', () => {
  const statement = statementFor(makeState({ cardBalance: 124000 }));

  it('maps each choice to an amount', () => {
    expect(repaymentAmount(statement, 'FULL')).toBe(124000);
    expect(repaymentAmount(statement, 'HALF')).toBe(62000);
    expect(repaymentAmount(statement, 'MINIMUM')).toBe(6200);
    expect(repaymentAmount(statement, 'NONE')).toBe(0);
  });

  it('rounds half up to the cent', () => {
    expect(repaymentAmount(statementFor(makeState({ cardBalance: 12345 })), 'HALF')).toBe(6173);
  });

  it('never lets half fall below the minimum', () => {
    const highMinimum = statementFor(
      makeState({ cardBalance: 10000 }),
      makeTerms({ minimumPaymentRate: 0.6 }),
    );
    expect(highMinimum.minimumDue).toBe(6000);
    expect(repaymentAmount(highMinimum, 'HALF')).toBe(6000);
  });
});

describe('applyRepayment', () => {
  const state = makeState({ cardBalance: 124000 });
  const statement = statementFor(state);

  it('paying in full keeps the interest-free period', () => {
    const { next, outcome } = applyRepayment(state, statement, 'FULL');
    expect(outcome).toMatchObject({
      requested: 124000,
      paid: 124000,
      shortfall: 0,
      remainingOwed: 0,
      interestFreeKept: true,
      interestCharged: 0,
      missedPayment: false,
      lateFee: 0,
      nextOpeningBalance: 0,
      spendingAccountAfter: 8100,
    });
    expect(next.cardBalance).toBe(0);
    expect(next.carriedForward).toBe(0);
  });

  it('paying nothing is a missed payment with interest and a late fee', () => {
    const { next, outcome } = applyRepayment(state, statement, 'NONE');
    expect(outcome.missedPayment).toBe(true);
    expect(outcome.interestCharged).toBe(2480);
    expect(outcome.lateFee).toBe(15000);
    expect(outcome.nextOpeningBalance).toBe(141480);
    expect(next.spendingAccount).toBe(132100);
    expect(next.cardBalance).toBe(141480);
  });

  it('reports a shortfall instead of paying more than the spending account holds', () => {
    const poor = makeState({ cardBalance: 124000, spendingAccount: 50000 });
    const { next, outcome } = applyRepayment(poor, statementFor(poor), 'FULL');
    expect(outcome.requested).toBe(124000);
    expect(outcome.paid).toBe(50000);
    expect(outcome.shortfall).toBe(74000);
    expect(outcome.remainingOwed).toBe(74000);
    expect(outcome.interestFreeKept).toBe(false);
    expect(outcome.missedPayment).toBe(false);
    expect(next.spendingAccount).toBe(0);
  });

  it('counts a payment below the minimum as missed, even if something was paid', () => {
    const broke = makeState({ cardBalance: 124000, spendingAccount: 1000 });
    const { outcome } = applyRepayment(broke, statementFor(broke), 'MINIMUM');
    expect(outcome.paid).toBe(1000);
    expect(outcome.shortfall).toBe(5200);
    expect(outcome.missedPayment).toBe(true);
    expect(outcome.nextOpeningBalance).toBe(123000 + 2460 + 15000);
  });

  it('treats a zero balance as settled whatever the choice', () => {
    const clear = makeState();
    const { outcome } = applyRepayment(clear, statementFor(clear), 'NONE');
    expect(outcome.missedPayment).toBe(false);
    expect(outcome.interestFreeKept).toBe(true);
    expect(outcome.nextOpeningBalance).toBe(0);
  });

  it('keeps unrelated state untouched', () => {
    const { next } = applyRepayment(state, statement, 'HALF');
    expect(next.emergencySavings).toBe(state.emergencySavings);
    expect(next.commitments).toBe(state.commitments);
    expect(next.points).toBe(state.points);
    expect(next.monthIndex).toBe(state.monthIndex);
  });

  it('rejects a statement from a different month', () => {
    expect(() => applyRepayment(makeState({ monthIndex: 1 }), statement, 'FULL')).toThrow(
      'Statement is for month 0 but the state is month 1.',
    );
  });

  it('rejects an invalid spending account', () => {
    const bad = makeState({ cardBalance: 124000, spendingAccount: -1 });
    expect(() => applyRepayment(bad, statement, 'FULL')).toThrow(RangeError);
  });
});

describe('projectAlternate and compareRepaymentChoices', () => {
  const state = makeState({ cardBalance: 124000 });
  const statement = statementFor(state);

  it('projectAlternate matches the outcome applyRepayment would give', () => {
    for (const choice of REPAYMENT_CHOICES) {
      expect(projectAlternate(state, statement, choice)).toEqual(
        applyRepayment(state, statement, choice).outcome,
      );
    }
  });

  it('compareRepaymentChoices lists every choice in a fixed order', () => {
    const outcomes = compareRepaymentChoices(state, statement);
    expect(outcomes.map((outcome) => outcome.choice)).toEqual(['FULL', 'HALF', 'MINIMUM', 'NONE']);
    expect(outcomes.map((outcome) => outcome.nextOpeningBalance)).toEqual([
      0,
      62000 + 1240,
      117800 + 2356,
      124000 + 2480 + 15000,
    ]);
  });
});
