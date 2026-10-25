import { assertCents, assertNonNegativeInteger, assertPositiveInteger } from './guards';
import type { MonthState, OfferImpact, ScenarioOffer } from './types';

export function assertOffer(offer: ScenarioOffer): void {
  const label = `Offer "${offer.id}"`;
  assertNonNegativeInteger(offer.monthIndex, `${label} month`);
  assertCents(offer.cashPrice, `${label} cash price`);
  assertCents(offer.monthlyInstalment, `${label} monthly instalment`);
  assertPositiveInteger(offer.termMonths, `${label} term`);
  assertCents(offer.upfrontFee, `${label} upfront fee`);
  assertCents(offer.monthlyFee, `${label} monthly fee`);
}

/** What an instalment offer really costs, and what it leaves in the monthly budget. */
export function evaluateOffer(offer: ScenarioOffer, state: MonthState): OfferImpact {
  assertOffer(offer);
  const monthlyCost = offer.monthlyInstalment + offer.monthlyFee;
  const totalPayable = monthlyCost * offer.termMonths + offer.upfrontFee;
  const commitmentsAfter = state.commitments + monthlyCost;
  const budgetRemaining = state.monthlyAfterEssentials - commitmentsAfter;

  return {
    offerId: offer.id,
    monthlyCost,
    termMonths: offer.termMonths,
    totalPayable,
    totalFees: offer.upfrontFee + offer.monthlyFee * offer.termMonths,
    extraCostVsCash: totalPayable - offer.cashPrice,
    upfrontFee: offer.upfrontFee,
    commitmentsBefore: state.commitments,
    commitmentsAfter,
    budgetBefore: state.monthlyAfterEssentials - state.commitments,
    budgetRemaining,
    affordable: budgetRemaining >= 0,
  };
}

/**
 * Accepts an offer. Instalments start the following month, the monthly cost joins the fixed
 * commitments, and any upfront fee is charged to the card.
 */
export function acceptOffer(state: MonthState, offer: ScenarioOffer): MonthState {
  if (state.instalments.some((instalment) => instalment.offerId === offer.id)) {
    throw new Error(`Offer "${offer.id}" has already been accepted.`);
  }
  const impact = evaluateOffer(offer, state);
  return {
    ...state,
    commitments: impact.commitmentsAfter,
    cardBalance: state.cardBalance + offer.upfrontFee,
    instalments: [
      ...state.instalments,
      { offerId: offer.id, monthlyCost: impact.monthlyCost, monthsRemaining: offer.termMonths },
    ],
  };
}
