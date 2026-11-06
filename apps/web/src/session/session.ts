// A whole decisions-only run as plain data. Every function here is pure: it takes a session and
// returns a new one, driving the finance engine and the month-cycle state machine. Components
// read values from here and only format them (AGENTS.md section 7, rule 9).
import {
  FUNDING_SOURCES,
  REPAYMENT_CHOICES,
  acceptOffer,
  applyEvent,
  applyRepayment,
  awardPoints,
  buildStatement,
  compareRepaymentChoices,
  createCycle,
  createInitialState,
  createRunRecord,
  evaluateOffer,
  formatDate,
  itemiseStatement,
  pendingCardBalance,
  planEventFunding,
  projectAlternate,
  purchasesForMonth,
  repaymentAmount,
  scoreDecision,
  startNextMonth,
  statementDates,
  statementTerms,
  summarizeRun,
  transition,
} from '@credit-runner/finance-engine';
import type {
  CardCharge,
  Cents,
  CycleState,
  Decision,
  EventFunding,
  FundingSource,
  MonthState,
  OfferImpact,
  Purchase,
  QuizAnswer,
  RepaymentChoice,
  RepaymentOutcome,
  RunRecord,
  RunSummary,
  ScenarioEvent,
  ScenarioOffer,
  Statement,
  StatementDates,
  StatementLine,
  StatementTerms,
} from '@credit-runner/finance-engine';
import { STARTER_SCENARIO_ID, getScenario } from '@credit-runner/scenarios';
import type { Scenario } from '@credit-runner/scenarios';
import { QUIZ_QUESTIONS, findQuestion, isCorrectAnswer } from '../content/quiz';
import type { QuizDates, QuizQuestion } from '../content/quiz';

export interface RepaymentResult {
  outcome: RepaymentOutcome;
  /** Every choice's outcome from the same starting point. Revealed only after the player chose. */
  comparison: readonly RepaymentOutcome[];
  /** What paying only the minimum would have done. Powers "What if I paid only the minimum?". */
  minimumAlternative: RepaymentOutcome;
  pointsEarned: number;
}

export interface Session {
  scenario: Scenario;
  terms: StatementTerms;
  cycle: CycleState;
  state: MonthState;
  record: RunRecord;
  /** Offer IDs the player has accepted or declined. */
  decidedOffers: readonly string[];
  /** Event IDs the player has already paid for. */
  resolvedEvents: readonly string[];
  /** This month's statement, from STATEMENT_READY until the month summary is done. */
  statement: Statement | null;
  /** This month's repayment, shown on the month summary. */
  repayment: RepaymentResult | null;
  /** Commitments the latest month's money could not cover. */
  budgetShortfall: Cents;
  /**
   * Seconds of runner shopping banked this month. It survives crashes and the offer screen, and
   * the month's shopping ends once it reaches MONTH_RUN_SECONDS.
   */
  runSeconds: number;
}

/**
 * How long each month's shopping runs in runner mode, in seconds. AGENTS.md section 3 asks for
 * 60 to 90 seconds of running per month.
 */
export const MONTH_RUN_SECONDS = 75;

/** What the runner has collected since it was last banked. */
export interface RunProgress {
  /** Coin points, a separate scale from money. */
  points: number;
  /** Simulation seconds run. Paused and crashed time is not counted. */
  seconds: number;
}

export function loadStarterScenario(): Scenario {
  const scenario = getScenario(STARTER_SCENARIO_ID);
  if (scenario === undefined) throw new Error('The starter scenario is missing.');
  return scenario;
}

export function createSession(scenario: Scenario): Session {
  const { config } = scenario;
  return {
    scenario,
    terms: statementTerms(config),
    cycle: createCycle(config.months),
    state: createInitialState(config),
    record: createRunRecord(),
    decidedOffers: [],
    resolvedEvents: [],
    statement: null,
    repayment: null,
    budgetShortfall: 0,
    runSeconds: 0,
  };
}

function withPoints(state: MonthState, decision: Decision): { state: MonthState; points: number } {
  const points = scoreDecision(decision);
  return { state: awardPoints(state, points), points };
}

// ---------------------------------------------------------------------------------------------
// What the current month holds
// ---------------------------------------------------------------------------------------------

export function monthPurchases(session: Session): Purchase[] {
  return purchasesForMonth(session.scenario.config, session.cycle.monthIndex);
}

export function monthEvents(session: Session): ScenarioEvent[] {
  return session.scenario.config.events.filter(
    (event) => event.monthIndex === session.cycle.monthIndex,
  );
}

/** The next unexpected expense this month that has not been paid for yet. */
export function pendingEvent(session: Session): ScenarioEvent | undefined {
  return monthEvents(session).find((event) => !session.resolvedEvents.includes(event.id));
}

/** This month's instalment offer, if the player has not decided on it yet. */
export function pendingOffer(session: Session): ScenarioOffer | undefined {
  return session.scenario.config.offers.find(
    (offer) =>
      offer.monthIndex === session.cycle.monthIndex && !session.decidedOffers.includes(offer.id),
  );
}

export function requireStatement(session: Session): Statement {
  if (session.statement === null) throw new Error('No statement has closed this month.');
  return session.statement;
}

export function requireRepayment(session: Session): RepaymentResult {
  if (session.repayment === null) throw new Error('No repayment has been made this month.');
  return session.repayment;
}

// ---------------------------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------------------------

/**
 * Adds the runner's coin points to the run's total through the engine. Points are game points,
 * never money (AGENTS.md section 3).
 */
export function bankRunPoints(session: Session, points: number): Session {
  if (points === 0) return session;
  return { ...session, state: awardPoints(session.state, points) };
}

/** The HUD's points while running: the run's total plus coins collected but not yet banked. */
export function hudPointsWithRun(session: Session, runPoints: number): number {
  return awardPoints(session.state, runPoints).points;
}

/**
 * Banks what the runner collected: its coin points go to the run's total and its seconds to the
 * month's shopping time, which never goes past MONTH_RUN_SECONDS.
 */
export function bankRun(session: Session, progress: RunProgress): Session {
  const { seconds } = progress;
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('Run seconds must be a non-negative number.');
  }
  const banked = bankRunPoints(session, progress.points);
  if (seconds === 0) return banked;
  return { ...banked, runSeconds: Math.min(session.runSeconds + seconds, MONTH_RUN_SECONDS) };
}

/** Seconds of shopping left this month, counting `unbankedSeconds` the runner has not banked. */
export function runSecondsLeft(session: Session, unbankedSeconds = 0): number {
  return Math.max(MONTH_RUN_SECONDS - session.runSeconds - unbankedSeconds, 0);
}

/** True once the month's shopping time is used up and the statement should close. */
export function isMonthRunOver(session: Session, unbankedSeconds = 0): boolean {
  return runSecondsLeft(session, unbankedSeconds) === 0;
}

/** Whole seconds of shopping left, rounded up so the readout reaches 0:00 only at the end. */
export function wholeRunSecondsLeft(session: Session, unbankedSeconds = 0): number {
  return Math.max(Math.ceil(runSecondsLeft(session, unbankedSeconds) - 1e-9), 0);
}

/** Shopping time left as "1:15". Takes whole seconds from wholeRunSecondsLeft. */
export function formatRunTimeLeft(wholeSeconds: number): string {
  const seconds = Math.max(Math.floor(wholeSeconds), 0);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The player picked up the glowing shopping bag. */
export function openOffer(session: Session): Session {
  if (pendingOffer(session) === undefined) throw new Error('There is no offer this month.');
  return { ...session, cycle: transition(session.cycle, { type: 'OFFER_TRIGGERED' }) };
}

export function offerImpact(session: Session, offer: ScenarioOffer): OfferImpact {
  return evaluateOffer(offer, session.state);
}

/** How far an offer would push commitments past the money after essentials. 0 when it fits. */
export function offerShortfall(impact: OfferImpact): Cents {
  return impact.budgetRemaining < 0 ? -impact.budgetRemaining : 0;
}

export function decideOffer(session: Session, accepted: boolean): Session {
  const offer = pendingOffer(session);
  if (offer === undefined) throw new Error('There is no offer to decide on.');
  const cycle = transition(session.cycle, { type: 'OFFER_RESOLVED' });
  const impact = evaluateOffer(offer, session.state);
  const base = accepted ? acceptOffer(session.state, offer) : session.state;
  const { state } = withPoints(base, { kind: 'OFFER', accepted, impact });
  return {
    ...session,
    cycle,
    state,
    record: {
      ...session.record,
      offerDecisions: [...session.record.offerDecisions, { accepted, impact }],
    },
    decidedOffers: [...session.decidedOffers, offer.id],
  };
}

/** Builds the month's statement as soon as the cycle reaches STATEMENT_READY. */
function closeStatementIfReady(session: Session): Session {
  if (session.cycle.phase !== 'STATEMENT_READY') return session;
  return {
    ...session,
    statement: buildStatement(session.state, monthPurchases(session), session.terms),
  };
}

/** The month's shopping is over (in decisions-only mode this stands in for the runner). */
export function endMonthRun(session: Session): Session {
  const cycle = transition(session.cycle, {
    type: 'RUN_ENDED',
    eventCount: monthEvents(session).length,
  });
  return closeStatementIfReady({ ...session, cycle });
}

export interface EventOption {
  source: FundingSource;
  funding: EventFunding;
  /** The money state if this source were chosen. */
  after: MonthState;
  /** The card balance, including this month's purchases, if this source were chosen. */
  cardBalanceAfter: Cents;
}

export function eventOptions(session: Session, event: ScenarioEvent): EventOption[] {
  const purchases = monthPurchases(session);
  return FUNDING_SOURCES.map((source) => {
    const after = applyEvent(session.state, event, source);
    return {
      source,
      funding: planEventFunding(session.state, event, source),
      after,
      cardBalanceAfter: pendingCardBalance(after, purchases),
    };
  });
}

export function fundEvent(session: Session, source: FundingSource): Session {
  const event = pendingEvent(session);
  if (event === undefined) throw new Error('There is no unexpected expense to pay.');
  const cycle = transition(session.cycle, { type: 'EVENT_RESOLVED' });
  const funding = planEventFunding(session.state, event, source);
  const { state } = withPoints(applyEvent(session.state, event, source), {
    kind: 'EVENT_FUNDING',
    funding,
  });
  return closeStatementIfReady({
    ...session,
    cycle,
    state,
    record: { ...session.record, eventFundings: [...session.record.eventFundings, funding] },
    resolvedEvents: [...session.resolvedEvents, event.id],
  });
}

export function viewStatement(session: Session): Session {
  requireStatement(session);
  return { ...session, cycle: transition(session.cycle, { type: 'STATEMENT_VIEWED' }) };
}

export interface RepaymentOption {
  choice: RepaymentChoice;
  amount: Cents;
}

export function repaymentOptions(session: Session): RepaymentOption[] {
  const statement = requireStatement(session);
  return REPAYMENT_CHOICES.map((choice) => ({
    choice,
    amount: repaymentAmount(statement, choice),
  }));
}

/**
 * What each repayment choice would do right now, in REPAYMENT_CHOICES order. The pay-plan cards
 * show only the immediate facts from these (money left, amount still owed); interest and the
 * side-by-side comparison are revealed after the player confirms.
 */
export function repaymentPreviews(session: Session): readonly RepaymentOutcome[] {
  return compareRepaymentChoices(session.state, requireStatement(session));
}

export function confirmRepayment(session: Session, choice: RepaymentChoice): Session {
  const statement = requireStatement(session);
  const cycle = transition(session.cycle, { type: 'PAYMENT_CONFIRMED' });
  const comparison = compareRepaymentChoices(session.state, statement);
  const minimumAlternative = projectAlternate(session.state, statement, 'MINIMUM');
  const applied = applyRepayment(session.state, statement, choice);
  const { state, points } = withPoints(applied.next, {
    kind: 'REPAYMENT',
    outcome: applied.outcome,
  });
  return {
    ...session,
    cycle,
    state,
    record: { ...session.record, repayments: [...session.record.repayments, applied.outcome] },
    repayment: { outcome: applied.outcome, comparison, minimumAlternative, pointsEarned: points },
  };
}

/** Leaves the month summary: on to next month's money, or to the final quiz. */
export function finishMonth(session: Session): Session {
  const cycle = transition(session.cycle, { type: 'MONTH_SUMMARY_DONE' });
  const base: Session = { ...session, cycle, statement: null, repayment: null, runSeconds: 0 };
  if (cycle.phase !== 'RUNNING') return base;
  const started = startNextMonth(session.state);
  return { ...base, state: started.next, budgetShortfall: started.budgetShortfall };
}

export function answerQuiz(session: Session, questionId: string, optionId: string): Session {
  if (session.cycle.phase !== 'FINAL_QUIZ') throw new Error('The quiz is not open.');
  if (quizAnswerFor(session, questionId) !== undefined) {
    throw new Error(`Question "${questionId}" has already been answered.`);
  }
  const correct = isCorrectAnswer(findQuestion(questionId), optionId);
  const { state } = withPoints(session.state, { kind: 'QUIZ', correct });
  return {
    ...session,
    state,
    record: {
      ...session.record,
      quizAnswers: [...session.record.quizAnswers, { questionId, correct }],
    },
  };
}

export function completeQuiz(session: Session): Session {
  return { ...session, cycle: transition(session.cycle, { type: 'QUIZ_COMPLETED' }) };
}

// ---------------------------------------------------------------------------------------------
// Values for the screens
// ---------------------------------------------------------------------------------------------

/** "1 of 3". */
export function monthLabel(session: Session): string {
  return `${String(session.cycle.monthIndex + 1)} of ${String(session.cycle.months)}`;
}

/** "1/3", as on the HUD month pill. */
export function monthShortLabel(session: Session): string {
  return `${String(session.cycle.monthIndex + 1)}/${String(session.cycle.months)}`;
}

/**
 * Where the player sits on the HUD timeline, from statement close (0) to payment due (1).
 * Until the statement is out the marker waits at the start, planning the payment is midway and a
 * settled month reaches the due date. The runner does not move it: the month's shopping all
 * happens before the statement closes, so the time left is shown separately (formatRunTimeLeft).
 */
export function hudTimelineProgress(session: Session): number {
  switch (session.cycle.phase) {
    case 'RUNNING':
    case 'OFFER_CHECK':
    case 'EVENT':
    case 'STATEMENT_READY':
      return 0;
    case 'PLAN_PAYMENT':
      return 0.5;
    case 'MONTH_SUMMARY':
    case 'FINAL_QUIZ':
    case 'RUN_SUMMARY':
      return 1;
  }
}

/**
 * The scenario's note on what the existing commitments are, e.g. "clothing + phone". Hidden once
 * an instalment has been added, because the commitments then include more than the note says.
 */
export function commitmentsNote(session: Session): string | undefined {
  return session.state.instalments.length === 0 ? session.scenario.commitmentsNote : undefined;
}

/**
 * Emergency savings spent on this month's unexpected expenses, from the recorded engine results.
 * 0 means the savings stayed intact this month.
 */
export function monthSavingsUsed(session: Session): Cents {
  const { events } = session.scenario.config;
  const { monthIndex } = session.cycle;
  return session.record.eventFundings
    .filter((funding) =>
      events.some((event) => event.id === funding.eventId && event.monthIndex === monthIndex),
    )
    .reduce((total, funding) => total + funding.fromSavings, 0);
}

export function isFinalMonth(session: Session): boolean {
  return session.cycle.monthIndex + 1 >= session.cycle.months;
}

export function currentStatementDates(session: Session): StatementDates {
  return statementDates(session.terms, session.cycle.monthIndex);
}

/** The card balance for the HUD at this point in the month. */
export function hudCardBalance(session: Session): Cents {
  switch (session.cycle.phase) {
    case 'RUNNING':
    case 'OFFER_CHECK':
    case 'EVENT':
      return pendingCardBalance(session.state, monthPurchases(session));
    case 'STATEMENT_READY':
    case 'PLAN_PAYMENT':
      return requireStatement(session).balance;
    case 'MONTH_SUMMARY':
    case 'FINAL_QUIZ':
    case 'RUN_SUMMARY':
      return session.state.cardBalance;
  }
}

/**
 * This month's card charges that are not purchases: unexpected expenses put on the card and any
 * upfront offer fees. Amounts come straight from the recorded engine results.
 */
export function monthCardCharges(session: Session): CardCharge[] {
  const { events, offers } = session.scenario.config;
  const { monthIndex } = session.cycle;
  const charges: CardCharge[] = [];
  for (const funding of session.record.eventFundings) {
    const event = events.find(
      (candidate) => candidate.id === funding.eventId && candidate.monthIndex === monthIndex,
    );
    if (event !== undefined && funding.toCard > 0) {
      charges.push({
        id: `event-${event.id}`,
        label: event.statementLabel ?? event.title,
        amount: funding.toCard,
      });
    }
  }
  for (const decision of session.record.offerDecisions) {
    const offer = offers.find(
      (candidate) =>
        candidate.id === decision.impact.offerId && candidate.monthIndex === monthIndex,
    );
    if (offer !== undefined && decision.accepted && decision.impact.upfrontFee > 0) {
      charges.push({
        id: `offer-fee-${offer.id}`,
        label: `${offer.title} fee`,
        amount: decision.impact.upfrontFee,
      });
    }
  }
  return charges;
}

/** The lines of this month's statement. They always add up to the statement balance. */
export function statementLines(session: Session): StatementLine[] {
  return itemiseStatement(requireStatement(session), monthCardCharges(session));
}

export function quizAnswerFor(session: Session, questionId: string): QuizAnswer | undefined {
  return session.record.quizAnswers.find((answer) => answer.questionId === questionId);
}

export function nextQuizQuestion(session: Session): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((question) => quizAnswerFor(session, question.id) === undefined);
}

export function runSummary(session: Session): RunSummary {
  return summarizeRun(session.record);
}

/** True once every quiz question is answered and the run summary is showing. */
export function isRunFinished(session: Session): boolean {
  return session.cycle.phase === 'RUN_SUMMARY';
}

/**
 * The first statement's dates, e.g. "30 September" and "25 October". The finish screen uses them
 * as its worked example, as in the mockup.
 */
export function quizDates(session: Session): QuizDates {
  const { closes, due } = statementDates(session.terms, 0);
  return { statementCloses: formatDate(closes), paymentDue: formatDate(due) };
}

/** Changes whenever a new screen should appear, so React remounts it and focus moves to it. */
export function screenKey(session: Session): string {
  const { phase, monthIndex, pendingEvents } = session.cycle;
  // The quiz and the run summary share one screen, so finishing the quiz does not remount it.
  const view = phase === 'RUN_SUMMARY' ? 'FINAL_QUIZ' : phase;
  return `${view}-${String(monthIndex)}-${String(pendingEvents)}-${String(session.decidedOffers.length)}`;
}
