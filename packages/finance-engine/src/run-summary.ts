import { sumCents } from './money';
import type { RunRecord, RunSummary } from './types';

export function createRunRecord(): RunRecord {
  return { repayments: [], eventFundings: [], offerDecisions: [], quizAnswers: [] };
}

/** Totals across a whole run, for the run summary screen. */
export function summarizeRun(record: RunRecord): RunSummary {
  const { repayments, eventFundings, offerDecisions, quizAnswers } = record;
  const accepted = offerDecisions.filter((decision) => decision.accepted);

  return {
    statements: repayments.length,
    statementsPaidInFull: repayments.filter((outcome) => outcome.interestFreeKept).length,
    missedPayments: repayments.filter((outcome) => outcome.missedPayment).length,
    totalRepaid: sumCents(repayments.map((outcome) => outcome.paid)),
    interestCharged: sumCents(repayments.map((outcome) => outcome.interestCharged)),
    lateFees: sumCents(repayments.map((outcome) => outcome.lateFee)),
    unexpectedCosts: sumCents(eventFundings.map((funding) => funding.cost)),
    paidFromSavings: sumCents(eventFundings.map((funding) => funding.fromSavings)),
    paidFromSpending: sumCents(eventFundings.map((funding) => funding.fromSpending)),
    putOnCard: sumCents(eventFundings.map((funding) => funding.toCard)),
    offersAccepted: accepted.length,
    offersDeclined: offerDecisions.length - accepted.length,
    newMonthlyCommitments: sumCents(accepted.map((decision) => decision.impact.monthlyCost)),
    totalPayableAccepted: sumCents(accepted.map((decision) => decision.impact.totalPayable)),
    quizCorrect: quizAnswers.filter((answer) => answer.correct).length,
    quizTotal: quizAnswers.length,
  };
}
