import { describe, expect, it } from 'vitest';
import { applyEvent, assertEvent, FUNDING_SOURCES, planEventFunding } from '../src/events';
import { acceptOffer, assertOffer, evaluateOffer } from '../src/offers';
import { compareRepaymentChoices } from '../src/repayment';
import { awardPoints, DECISION_SCORES, scoreDecision } from '../src/scoring';
import { headphonesOffer, makeOffer, makeState, pharmacyEvent, statementFor } from './helpers';

const offerWithFees = makeOffer({
  id: 'laptop-bag',
  cashPrice: 270000,
  monthlyInstalment: 25000,
  termMonths: 12,
  upfrontFee: 5000,
  monthlyFee: 1500,
});

describe('evaluateOffer', () => {
  it('includes every fee in the total payable', () => {
    const impact = evaluateOffer(offerWithFees, makeState());
    expect(impact.monthlyCost).toBe(26500);
    expect(impact.totalPayable).toBe(26500 * 12 + 5000);
    expect(impact.totalFees).toBe(5000 + 1500 * 12);
    expect(impact.extraCostVsCash).toBe(323000 - 270000);
    expect(impact.upfrontFee).toBe(5000);
    expect(impact.budgetBefore).toBe(132100);
    expect(impact.budgetRemaining).toBe(190000 - 57900 - 26500);
    expect(impact.affordable).toBe(true);
  });

  it('reports an offer the monthly budget cannot carry', () => {
    const impact = evaluateOffer(headphonesOffer, makeState({ commitments: 180000 }));
    expect(impact.budgetRemaining).toBe(-15000);
    expect(impact.affordable).toBe(false);
  });

  it('rejects invalid offers', () => {
    expect(() => {
      assertOffer(makeOffer({ termMonths: 0 }));
    }).toThrow(RangeError);
    expect(() => {
      assertOffer(makeOffer({ monthlyFee: -1 }));
    }).toThrow(RangeError);
    expect(() => evaluateOffer(makeOffer({ cashPrice: 1.5 }), makeState())).toThrow(RangeError);
  });
});

describe('acceptOffer', () => {
  it('adds the instalment to commitments and the upfront fee to the card', () => {
    const next = acceptOffer(makeState({ cardBalance: 1000 }), offerWithFees);
    expect(next.commitments).toBe(57900 + 26500);
    expect(next.cardBalance).toBe(6000);
    expect(next.instalments).toEqual([
      { offerId: 'laptop-bag', monthlyCost: 26500, monthsRemaining: 12 },
    ]);
    expect(next.spendingAccount).toBe(132100);
  });

  it('refuses to accept the same offer twice', () => {
    const once = acceptOffer(makeState(), headphonesOffer);
    expect(() => acceptOffer(once, headphonesOffer)).toThrow('already been accepted');
  });
});

describe('planEventFunding and applyEvent', () => {
  it('pays from emergency savings when they cover the cost', () => {
    const funding = planEventFunding(makeState(), pharmacyEvent, 'EMERGENCY_SAVINGS');
    expect(funding).toEqual({
      eventId: 'pharmacy',
      cost: 48000,
      source: 'EMERGENCY_SAVINGS',
      fromSavings: 48000,
      fromSpending: 0,
      toCard: 0,
      fellBackToCard: false,
    });
    const next = applyEvent(makeState(), pharmacyEvent, 'EMERGENCY_SAVINGS');
    expect(next.emergencySavings).toBe(2000);
    expect(next.cardBalance).toBe(0);
  });

  it('puts what savings cannot cover on the card and says so', () => {
    const state = makeState({ emergencySavings: 30000 });
    const funding = planEventFunding(state, pharmacyEvent, 'EMERGENCY_SAVINGS');
    expect(funding.fromSavings).toBe(30000);
    expect(funding.toCard).toBe(18000);
    expect(funding.fellBackToCard).toBe(true);
    const next = applyEvent(state, pharmacyEvent, 'EMERGENCY_SAVINGS');
    expect(next.emergencySavings).toBe(0);
    expect(next.cardBalance).toBe(18000);
  });

  it('pays from the spending account, falling back to the card', () => {
    const covered = planEventFunding(makeState(), pharmacyEvent, 'SPENDING_ACCOUNT');
    expect(covered.fromSpending).toBe(48000);
    expect(covered.fellBackToCard).toBe(false);
    expect(applyEvent(makeState(), pharmacyEvent, 'SPENDING_ACCOUNT').spendingAccount).toBe(84100);

    const short = planEventFunding(
      makeState({ spendingAccount: 8000 }),
      pharmacyEvent,
      'SPENDING_ACCOUNT',
    );
    expect(short.fromSpending).toBe(8000);
    expect(short.toCard).toBe(40000);
    expect(short.fellBackToCard).toBe(true);
  });

  it('charging the card directly is not a fallback', () => {
    const funding = planEventFunding(makeState(), pharmacyEvent, 'CARD');
    expect(funding.toCard).toBe(48000);
    expect(funding.fellBackToCard).toBe(false);
  });

  it('lists every funding source', () => {
    expect(FUNDING_SOURCES).toEqual(['EMERGENCY_SAVINGS', 'SPENDING_ACCOUNT', 'CARD']);
  });

  it('rejects invalid events', () => {
    expect(() => {
      assertEvent({ ...pharmacyEvent, cost: -1 });
    }).toThrow(RangeError);
    expect(() => {
      assertEvent({ ...pharmacyEvent, monthIndex: -1 });
    }).toThrow(RangeError);
    expect(() => planEventFunding(makeState(), { ...pharmacyEvent, cost: 0.5 }, 'CARD')).toThrow(
      RangeError,
    );
  });
});

describe('scoreDecision', () => {
  const state = makeState({ cardBalance: 124000 });
  const [full, half, minimum, none] = compareRepaymentChoices(state, statementFor(state));

  it('scores repayments from best to worst', () => {
    if (!full || !half || !minimum || !none) throw new Error('Expected four outcomes.');
    const scores = DECISION_SCORES.repayment;
    expect(scoreDecision({ kind: 'REPAYMENT', outcome: full })).toBe(scores.interestFree);
    expect(scoreDecision({ kind: 'REPAYMENT', outcome: half })).toBe(scores.halfOrMore);
    expect(scoreDecision({ kind: 'REPAYMENT', outcome: minimum })).toBe(scores.minimumMet);
    expect(scoreDecision({ kind: 'REPAYMENT', outcome: none })).toBe(scores.missed);
  });

  it('scores offer decisions', () => {
    const scores = DECISION_SCORES.offer;
    const noExtra = evaluateOffer(headphonesOffer, makeState());
    const withFees = evaluateOffer(offerWithFees, makeState());
    const unaffordable = evaluateOffer(headphonesOffer, makeState({ commitments: 180000 }));
    expect(scoreDecision({ kind: 'OFFER', accepted: false, impact: withFees })).toBe(
      scores.declined,
    );
    expect(scoreDecision({ kind: 'OFFER', accepted: true, impact: noExtra })).toBe(
      scores.acceptedNoExtraCost,
    );
    expect(scoreDecision({ kind: 'OFFER', accepted: true, impact: withFees })).toBe(
      scores.acceptedWithExtraCost,
    );
    expect(scoreDecision({ kind: 'OFFER', accepted: true, impact: unaffordable })).toBe(
      scores.unaffordable,
    );
  });

  it('scores how an unexpected expense was funded', () => {
    const scores = DECISION_SCORES.eventFunding;
    const fund = (state = makeState(), source: Parameters<typeof planEventFunding>[2]) =>
      scoreDecision({
        kind: 'EVENT_FUNDING',
        funding: planEventFunding(state, pharmacyEvent, source),
      });
    expect(fund(makeState(), 'EMERGENCY_SAVINGS')).toBe(scores.savings);
    expect(fund(makeState(), 'SPENDING_ACCOUNT')).toBe(scores.spending);
    expect(fund(makeState({ emergencySavings: 1000 }), 'EMERGENCY_SAVINGS')).toBe(
      scores.partlyBorrowed,
    );
    expect(fund(makeState(), 'CARD')).toBe(scores.borrowed);
  });

  it('scores quiz answers', () => {
    expect(scoreDecision({ kind: 'QUIZ', correct: true })).toBe(DECISION_SCORES.quiz.correct);
    expect(scoreDecision({ kind: 'QUIZ', correct: false })).toBe(DECISION_SCORES.quiz.incorrect);
  });
});

describe('awardPoints', () => {
  it('adds points without touching money', () => {
    const next = awardPoints(makeState({ points: 10 }), 15);
    expect(next.points).toBe(25);
    expect(next.spendingAccount).toBe(132100);
  });

  it('rejects negative or fractional points', () => {
    expect(() => awardPoints(makeState(), -1)).toThrow(RangeError);
    expect(() => awardPoints(makeState(), 0.5)).toThrow(RangeError);
  });
});
