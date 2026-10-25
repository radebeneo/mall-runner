// Pure, deterministic finance logic. No UI, DOM or Three.js imports (AGENTS.md section 4).
export type * from './types';

export { formatPercent, formatPoints, formatRand, formatWholePercent, sumCents } from './money';
export { assertCalendarMonth, formatDate, formatShortDate, statementDates } from './calendar';
export { interestOn } from './interest';
export { assertStatementTerms, buildStatement, minimumDue, statementTerms } from './statement';
export { BROUGHT_FORWARD_LABEL, OTHER_CHARGES_LABEL, itemiseStatement } from './statement-lines';
export { assertScenarioPurchase, pendingCardBalance, purchasesForMonth } from './purchases';
export {
  REPAYMENT_CHOICES,
  applyRepayment,
  compareRepaymentChoices,
  projectAlternate,
  repaymentAmount,
} from './repayment';
export { acceptOffer, assertOffer, evaluateOffer } from './offers';
export { FUNDING_SOURCES, applyEvent, assertEvent, planEventFunding } from './events';
export { DECISION_SCORES, awardPoints, scoreDecision } from './scoring';
export { createRunRecord, summarizeRun } from './run-summary';
export {
  CYCLE_PHASES,
  InvalidTransitionError,
  canTransition,
  createCycle,
  createInitialState,
  startNextMonth,
  transition,
  validateScenarioConfig,
} from './month-cycle';
export type { CycleAction, CyclePhase, CycleState, MonthStartResult } from './month-cycle';
