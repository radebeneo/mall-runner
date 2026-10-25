import { describe, expect, it } from 'vitest';
import { planEventFunding } from '../src/events';
import { evaluateOffer } from '../src/offers';
import { projectAlternate } from '../src/repayment';
import { createRunRecord, summarizeRun } from '../src/run-summary';
import type { RunRecord } from '../src/types';
import { headphonesOffer, makeState, pharmacyEvent, statementFor } from './helpers';

describe('createRunRecord', () => {
  it('starts empty', () => {
    expect(createRunRecord()).toEqual({
      repayments: [],
      eventFundings: [],
      offerDecisions: [],
      quizAnswers: [],
    });
  });

  it('returns a fresh record each time', () => {
    expect(createRunRecord()).not.toBe(createRunRecord());
  });
});

describe('summarizeRun', () => {
  it('reports zeros for an empty run', () => {
    expect(summarizeRun(createRunRecord())).toEqual({
      statements: 0,
      statementsPaidInFull: 0,
      missedPayments: 0,
      totalRepaid: 0,
      interestCharged: 0,
      lateFees: 0,
      unexpectedCosts: 0,
      paidFromSavings: 0,
      paidFromSpending: 0,
      putOnCard: 0,
      offersAccepted: 0,
      offersDeclined: 0,
      newMonthlyCommitments: 0,
      totalPayableAccepted: 0,
      quizCorrect: 0,
      quizTotal: 0,
    });
  });

  it('totals every decision in a run', () => {
    const state = makeState();
    const statement = statementFor(state, undefined, [
      { id: 'mall-shopping', label: 'Mall shopping', amount: 124000 },
    ]);
    const full = projectAlternate(state, statement, 'FULL');
    const minimum = projectAlternate(state, statement, 'MINIMUM');
    const none = projectAlternate(state, statement, 'NONE');
    const impact = evaluateOffer(headphonesOffer, state);

    const record: RunRecord = {
      repayments: [full, minimum, none],
      eventFundings: [
        planEventFunding(state, pharmacyEvent, 'EMERGENCY_SAVINGS'),
        planEventFunding(state, pharmacyEvent, 'SPENDING_ACCOUNT'),
        planEventFunding(state, pharmacyEvent, 'CARD'),
      ],
      offerDecisions: [
        { accepted: true, impact },
        { accepted: false, impact },
      ],
      quizAnswers: [
        { questionId: 'closing-vs-due', correct: true },
        { questionId: 'minimum-payment', correct: false },
        { questionId: 'interest-free', correct: true },
      ],
    };

    const summary = summarizeRun(record);
    expect(summary.statements).toBe(3);
    expect(summary.statementsPaidInFull).toBe(1);
    expect(summary.missedPayments).toBe(1);
    expect(summary.totalRepaid).toBe(124000 + 6200);
    expect(summary.interestCharged).toBe(
      full.interestCharged + minimum.interestCharged + none.interestCharged,
    );
    expect(summary.interestCharged).toBeGreaterThan(0);
    expect(summary.lateFees).toBe(none.lateFee);
    expect(summary.unexpectedCosts).toBe(3 * 48000);
    expect(summary.paidFromSavings).toBe(48000);
    expect(summary.paidFromSpending).toBe(48000);
    expect(summary.putOnCard).toBe(48000);
    expect(summary.offersAccepted).toBe(1);
    expect(summary.offersDeclined).toBe(1);
    expect(summary.newMonthlyCommitments).toBe(25000);
    expect(summary.totalPayableAccepted).toBe(300000);
    expect(summary.quizCorrect).toBe(2);
    expect(summary.quizTotal).toBe(3);
  });
});
