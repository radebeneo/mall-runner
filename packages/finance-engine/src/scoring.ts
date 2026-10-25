import { assertNonNegativeInteger } from './guards';
import type { Decision, MonthState } from './types';

/**
 * Decision scores. Placeholder values until the owner settles the points scale
 * (AGENTS.md section 10). Points are never shown as currency.
 */
export const DECISION_SCORES = {
  repayment: { interestFree: 100, halfOrMore: 60, minimumMet: 30, missed: 0 },
  offer: { declined: 50, acceptedNoExtraCost: 50, acceptedWithExtraCost: 20, unaffordable: 0 },
  eventFunding: { savings: 50, spending: 40, partlyBorrowed: 20, borrowed: 10 },
  quiz: { correct: 25, incorrect: 0 },
} as const;

export function scoreDecision(decision: Decision): number {
  switch (decision.kind) {
    case 'REPAYMENT': {
      const { outcome } = decision;
      const scores = DECISION_SCORES.repayment;
      if (outcome.interestFreeKept) return scores.interestFree;
      if (outcome.missedPayment) return scores.missed;
      return outcome.paid * 2 >= outcome.statementBalance ? scores.halfOrMore : scores.minimumMet;
    }
    case 'OFFER': {
      const scores = DECISION_SCORES.offer;
      if (!decision.accepted) return scores.declined;
      if (!decision.impact.affordable) return scores.unaffordable;
      return decision.impact.extraCostVsCash > 0
        ? scores.acceptedWithExtraCost
        : scores.acceptedNoExtraCost;
    }
    case 'EVENT_FUNDING': {
      const { funding } = decision;
      const scores = DECISION_SCORES.eventFunding;
      if (funding.toCard === 0) return funding.fromSpending > 0 ? scores.spending : scores.savings;
      return funding.toCard < funding.cost ? scores.partlyBorrowed : scores.borrowed;
    }
    case 'QUIZ':
      return decision.correct ? DECISION_SCORES.quiz.correct : DECISION_SCORES.quiz.incorrect;
  }
}

/** Adds game points, for example from coins collected in the runner. */
export function awardPoints(state: MonthState, points: number): MonthState {
  assertNonNegativeInteger(points, 'Points');
  return { ...state, points: state.points + points };
}
