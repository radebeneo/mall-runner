import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  applyRepayment,
  buildStatement,
  createInitialState,
  evaluateOffer,
  formatRand,
  projectAlternate,
} from '../src/index';
import { headphonesOffer, pharmacyEvent, starterConfig, starterTerms } from './helpers';

// Month 1 of the mockups: R760 of mall shopping on the card, plus a R480 pharmacy visit that the
// player puts on the card.
const initial = createInitialState(starterConfig);
const afterPharmacy = applyEvent(initial, pharmacyEvent, 'CARD');
const statement = buildStatement(
  afterPharmacy,
  [{ id: 'mall', label: 'Mall shopping', amount: 76000 }],
  starterTerms,
);

describe('mockup fixtures (AGENTS.md section 4)', () => {
  it('after essentials R1,900 minus commitments R579 leaves R1,321 available', () => {
    expect(initial.monthlyAfterEssentials).toBe(190000);
    expect(initial.commitments).toBe(57900);
    expect(initial.spendingAccount).toBe(132100);
    expect(formatRand(initial.spendingAccount)).toBe('R1,321');
  });

  it('card R760 plus pharmacy R480 gives a statement balance of R1,240', () => {
    expect(afterPharmacy.cardBalance).toBe(48000);
    expect(statement.purchasesTotal).toBe(76000);
    expect(statement.balance).toBe(124000);
    expect(formatRand(statement.balance)).toBe('R1,240');
  });

  it('minimum is 5% of R1,240 = R62, leaving R1,178 owed', () => {
    expect(statement.minimumDue).toBe(6200);
    expect(formatRand(statement.minimumDue)).toBe('R62');
    const outcome = projectAlternate(afterPharmacy, statement, 'MINIMUM');
    expect(outcome.paid).toBe(6200);
    expect(outcome.remainingOwed).toBe(117800);
    expect(formatRand(outcome.remainingOwed)).toBe('R1,178');
  });

  it('paying half is R620, leaving R620 owed', () => {
    const outcome = projectAlternate(afterPharmacy, statement, 'HALF');
    expect(outcome.paid).toBe(62000);
    expect(outcome.remainingOwed).toBe(62000);
    expect(formatRand(outcome.paid)).toBe('R620');
  });

  it('paying in full leaves R1,321 - R1,240 = R81 in the spending account', () => {
    const { next, outcome } = applyRepayment(afterPharmacy, statement, 'FULL');
    expect(outcome.interestFreeKept).toBe(true);
    expect(outcome.interestCharged).toBe(0);
    expect(next.spendingAccount).toBe(8100);
    expect(formatRand(next.spendingAccount)).toBe('R81');
    expect(next.cardBalance).toBe(0);
  });

  it('utilisation is R1,240 / R5,000, about 25%', () => {
    expect(statement.utilisation).toBeCloseTo(0.248, 10);
    expect(statement.utilisationPercent).toBe(25);
  });

  it('a R250 x 12 offer totals R3,000, raises commitments R579 -> R829 and leaves R1,071', () => {
    const impact = evaluateOffer(headphonesOffer, initial);
    expect(impact.monthlyCost).toBe(25000);
    expect(impact.totalPayable).toBe(300000);
    expect(formatRand(impact.totalPayable)).toBe('R3,000');
    expect(impact.commitmentsBefore).toBe(57900);
    expect(impact.commitmentsAfter).toBe(82900);
    expect(formatRand(impact.commitmentsAfter)).toBe('R829');
    expect(impact.budgetRemaining).toBe(107100);
    expect(formatRand(impact.budgetRemaining)).toBe('R1,071');
  });

  it('after a minimum-only payment, next month opens with a concrete balance', () => {
    const { next, outcome } = applyRepayment(afterPharmacy, statement, 'MINIMUM');
    expect(outcome.interestFreeKept).toBe(false);
    expect(outcome.missedPayment).toBe(false);
    expect(outcome.lateFee).toBe(0);
    // 2% fictional monthly rate on R1,178.
    expect(outcome.interestCharged).toBe(2356);
    expect(outcome.nextOpeningBalance).toBe(120156);
    expect(formatRand(outcome.nextOpeningBalance)).toBe('R1,201.56');
    expect(next.cardBalance).toBe(120156);
    expect(next.carriedForward).toBe(120156);
  });
});
