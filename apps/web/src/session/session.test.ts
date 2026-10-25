import { describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS, fillQuizText } from '../content/quiz';
import {
  answerQuiz,
  completeQuiz,
  confirmRepayment,
  createSession,
  decideOffer,
  endMonthRun,
  eventOptions,
  finishMonth,
  fundEvent,
  hudCardBalance,
  isFinalMonth,
  isRunFinished,
  loadStarterScenario,
  monthLabel,
  nextQuizQuestion,
  offerImpact,
  openOffer,
  pendingEvent,
  pendingOffer,
  quizDates,
  repaymentOptions,
  requireRepayment,
  requireStatement,
  runSummary,
  screenKey,
  viewStatement,
} from './session';
import type { Session } from './session';

function newSession(): Session {
  return createSession(loadStarterScenario());
}

/** Month 1 of the starter: decline the offer, put the pharmacy bill on the card. */
function toStatement(): Session {
  let session = newSession();
  session = openOffer(session);
  session = decideOffer(session, false);
  session = endMonthRun(session);
  session = fundEvent(session, 'CARD');
  return session;
}

describe('decisions-only session', () => {
  it('starts in month 1 with the money from the mockups', () => {
    const session = newSession();
    expect(session.cycle.phase).toBe('RUNNING');
    expect(monthLabel(session)).toBe('1 of 3');
    // After essentials 1,900 - commitments 579 = available 1,321.
    expect(session.state.spendingAccount).toBe(132100);
    expect(hudCardBalance(session)).toBe(76000);
    expect(pendingOffer(session)?.id).toBe('sofa');
  });

  it('shows the offer impact from the mockups', () => {
    const session = openOffer(newSession());
    expect(session.cycle.phase).toBe('OFFER_CHECK');
    const offer = pendingOffer(session);
    if (offer === undefined) throw new Error('expected an offer');
    const impact = offerImpact(session, offer);
    expect(impact.totalPayable).toBe(300000);
    expect(impact.commitmentsAfter).toBe(82900);
    expect(impact.budgetRemaining).toBe(107100);
  });

  it('records an offer decision only once', () => {
    const session = decideOffer(openOffer(newSession()), false);
    expect(session.cycle.phase).toBe('RUNNING');
    expect(pendingOffer(session)).toBeUndefined();
    expect(session.record.offerDecisions).toHaveLength(1);
    expect(() => openOffer(session)).toThrow();
  });

  it('accepting an offer adds its monthly cost to commitments', () => {
    const session = decideOffer(openOffer(newSession()), true);
    expect(session.state.commitments).toBe(82900);
  });

  it('builds the R1,240 statement after the pharmacy bill goes on the card', () => {
    const atEvent = endMonthRun(decideOffer(openOffer(newSession()), false));
    expect(atEvent.cycle.phase).toBe('EVENT');
    expect(pendingEvent(atEvent)?.id).toBe('pharmacy');
    const card = eventOptions(atEvent, pendingEvent(atEvent)!).find(
      (option) => option.source === 'CARD',
    );
    expect(card?.cardBalanceAfter).toBe(124000);

    const session = toStatement();
    expect(session.cycle.phase).toBe('STATEMENT_READY');
    const statement = requireStatement(session);
    expect(statement.balance).toBe(124000);
    expect(statement.minimumDue).toBe(6200);
    expect(hudCardBalance(session)).toBe(124000);
  });

  it('offers full, half, minimum and none at the engine amounts', () => {
    const session = viewStatement(toStatement());
    expect(session.cycle.phase).toBe('PLAN_PAYMENT');
    expect(repaymentOptions(session)).toEqual([
      { choice: 'FULL', amount: 124000 },
      { choice: 'HALF', amount: 62000 },
      { choice: 'MINIMUM', amount: 6200 },
      { choice: 'NONE', amount: 0 },
    ]);
  });

  it('paying in full leaves 81 in the spending account and keeps the interest-free period', () => {
    const session = confirmRepayment(viewStatement(toStatement()), 'FULL');
    expect(session.cycle.phase).toBe('MONTH_SUMMARY');
    const { outcome, comparison, minimumAlternative } = requireRepayment(session);
    expect(outcome.interestFreeKept).toBe(true);
    expect(outcome.spendingAccountAfter).toBe(8100);
    expect(comparison.map((option) => option.choice)).toEqual(['FULL', 'HALF', 'MINIMUM', 'NONE']);
    // Minimum 62 leaves 1,178 owed.
    expect(minimumAlternative.remainingOwed).toBe(117800);
  });

  it('paying the minimum shows next month opening with interest', () => {
    const session = confirmRepayment(viewStatement(toStatement()), 'MINIMUM');
    const { outcome } = requireRepayment(session);
    expect(outcome.remainingOwed).toBe(117800);
    expect(outcome.interestCharged).toBe(2356);
    expect(outcome.nextOpeningBalance).toBe(120156);
  });

  it('gives each new screen a new key', () => {
    const start = newSession();
    const offer = openOffer(start);
    const back = decideOffer(offer, false);
    const keys = [screenKey(start), screenKey(offer), screenKey(back)];
    expect(new Set(keys).size).toBe(3);
  });

  it('plays a whole run through to the summary', () => {
    let session = newSession();
    for (let month = 0; month < 3; month += 1) {
      if (pendingOffer(session) !== undefined) {
        session = decideOffer(openOffer(session), false);
      }
      session = endMonthRun(session);
      while (session.cycle.phase === 'EVENT') {
        session = fundEvent(session, 'EMERGENCY_SAVINGS');
      }
      session = confirmRepayment(viewStatement(session), 'FULL');
      expect(isFinalMonth(session)).toBe(month === 2);
      session = finishMonth(session);
    }
    expect(session.cycle.phase).toBe('FINAL_QUIZ');
    expect(session.state.monthIndex).toBe(2);

    for (const question of QUIZ_QUESTIONS) {
      expect(nextQuizQuestion(session)?.id).toBe(question.id);
      session = answerQuiz(session, question.id, question.correctOptionId);
    }
    expect(nextQuizQuestion(session)).toBeUndefined();
    expect(() => answerQuiz(session, QUIZ_QUESTIONS[0]!.id, 'a')).toThrow();

    const quizKey = screenKey(session);
    expect(isRunFinished(session)).toBe(false);
    session = completeQuiz(session);
    expect(session.cycle.phase).toBe('RUN_SUMMARY');
    expect(isRunFinished(session)).toBe(true);
    // The quiz and the summary share one screen, so finishing does not remount it.
    expect(screenKey(session)).toBe(quizKey);
    const summary = runSummary(session);
    expect(summary.statements).toBe(3);
    expect(summary.statementsPaidInFull).toBe(3);
    expect(summary.offersDeclined).toBe(2);
    expect(summary.quizCorrect).toBe(QUIZ_QUESTIONS.length);
  });

  it('refuses quiz answers before the quiz opens', () => {
    expect(() => answerQuiz(newSession(), QUIZ_QUESTIONS[0]!.id, 'a')).toThrow();
  });

  it('fills the quiz dates from the first statement', () => {
    const dates = quizDates(newSession());
    expect(dates).toEqual({ statementCloses: '30 September', paymentDue: '25 October' });
    expect(fillQuizText('Pay by {paymentDue}, not {statementCloses}.', dates)).toBe(
      'Pay by 25 October, not 30 September.',
    );
  });

  it('covers every learning goal once in the quiz', () => {
    const goals = QUIZ_QUESTIONS.map((question) => question.goal);
    expect(new Set(goals).size).toBe(6);
    expect(goals).toHaveLength(6);
  });
});
