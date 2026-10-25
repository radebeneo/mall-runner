import { describe, expect, it } from 'vitest';
import {
  FUNDING_SOURCES,
  REPAYMENT_CHOICES,
  acceptOffer,
  applyEvent,
  applyRepayment,
  buildStatement,
  createInitialState,
  projectAlternate,
  startNextMonth,
  statementTerms,
  type MonthState,
  type Purchase,
  type ScenarioEvent,
  type ScenarioOffer,
  type StatementTerms,
} from '../src/index';
import { createRng, makeConfig, makeState, pick, randomInt, type Rng } from './helpers';

// Property tests use a seeded generator, so any failure can be replayed from its seed.
const CASES = 500;
const SIMULATIONS = 200;

function randomTerms(rng: Rng): StatementTerms {
  return {
    creditLimit: randomInt(rng, 100000, 2000000),
    minimumPaymentRate: randomInt(rng, 1, 30) / 100,
    monthlyInterestRate: randomInt(rng, 0, 50) / 1000,
    latePaymentFee: randomInt(rng, 0, 30000),
    statementCloseDay: randomInt(rng, 1, 28),
    paymentDueDay: randomInt(rng, 1, 28),
    startMonth: { year: randomInt(rng, 2025, 2030), month: randomInt(rng, 1, 12) },
  };
}

function randomState(rng: Rng): MonthState {
  const cardBalance = randomInt(rng, 0, 1500000);
  return makeState({
    cardBalance,
    carriedForward: randomInt(rng, 0, cardBalance),
    spendingAccount: randomInt(rng, 0, 600000),
    emergencySavings: randomInt(rng, 0, 200000),
  });
}

function randomPurchases(rng: Rng): Purchase[] {
  return Array.from({ length: randomInt(rng, 0, 4) }, (_, index) => ({
    id: `p${String(index)}`,
    label: 'Purchase',
    amount: randomInt(rng, 0, 250000),
  }));
}

function expectMoney(value: number): void {
  expect(Number.isSafeInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}

function expectValidState(state: MonthState): void {
  expectMoney(state.cardBalance);
  expectMoney(state.spendingAccount);
  expectMoney(state.emergencySavings);
  expectMoney(state.commitments);
  expectMoney(state.carriedForward);
  expect(state.carriedForward).toBeLessThanOrEqual(state.cardBalance);
  for (const instalment of state.instalments) {
    expect(instalment.monthsRemaining).toBeGreaterThan(0);
  }
}

describe('repayment properties', () => {
  it('never pays more than the spending account holds, and accounts for every cent', () => {
    const rng = createRng(20261025);
    for (let i = 0; i < CASES; i += 1) {
      const state = randomState(rng);
      const statement = buildStatement(state, randomPurchases(rng), randomTerms(rng));
      for (const choice of REPAYMENT_CHOICES) {
        const { next, outcome } = applyRepayment(state, statement, choice);
        expect(outcome.paid).toBeLessThanOrEqual(state.spendingAccount);
        expect(outcome.paid).toBeLessThanOrEqual(outcome.requested);
        expect(outcome.shortfall).toBe(outcome.requested - outcome.paid);
        expect(outcome.remainingOwed).toBe(statement.balance - outcome.paid);
        expect(outcome.interestFreeKept).toBe(outcome.paid === statement.balance);
        expect(outcome.nextOpeningBalance).toBe(
          outcome.remainingOwed + outcome.interestCharged + outcome.lateFee,
        );
        for (const value of [
          outcome.requested,
          outcome.paid,
          outcome.shortfall,
          outcome.remainingOwed,
          outcome.interestCharged,
          outcome.lateFee,
          outcome.nextOpeningBalance,
          outcome.spendingAccountAfter,
        ]) {
          expectMoney(value);
        }
        expect(outcome.spendingAccountAfter + outcome.paid).toBe(state.spendingAccount);
        expectValidState(next);
      }
    }
  });

  it('orders choices: paying more never leaves more owed', () => {
    const rng = createRng(7);
    for (let i = 0; i < CASES; i += 1) {
      const state = randomState(rng);
      const statement = buildStatement(state, randomPurchases(rng), randomTerms(rng));
      const owed = REPAYMENT_CHOICES.map(
        (choice) => projectAlternate(state, statement, choice).nextOpeningBalance,
      );
      for (let j = 1; j < owed.length; j += 1) {
        expect(owed[j]).toBeGreaterThanOrEqual(owed[j - 1] ?? 0);
      }
    }
  });

  it('is deterministic and does not mutate its inputs', () => {
    const rng = createRng(42);
    for (let i = 0; i < CASES; i += 1) {
      const state = randomState(rng);
      const statement = buildStatement(state, randomPurchases(rng), randomTerms(rng));
      const choice = pick(rng, REPAYMENT_CHOICES);
      const stateBefore = JSON.stringify(state);
      const statementBefore = JSON.stringify(statement);
      expect(applyRepayment(state, statement, choice)).toEqual(
        applyRepayment(state, statement, choice),
      );
      expect(JSON.stringify(state)).toBe(stateBefore);
      expect(JSON.stringify(statement)).toBe(statementBefore);
    }
  });
});

describe('event funding properties', () => {
  it('always pays the full cost from savings, spending and the card combined', () => {
    const rng = createRng(99);
    for (let i = 0; i < CASES; i += 1) {
      const state = randomState(rng);
      const event: ScenarioEvent = {
        id: 'e',
        monthIndex: 0,
        title: 'Event',
        cost: randomInt(rng, 0, 400000),
      };
      const source = pick(rng, FUNDING_SOURCES);
      const next = applyEvent(state, event, source);
      expectValidState(next);
      const paidFromCash =
        state.emergencySavings -
        next.emergencySavings +
        state.spendingAccount -
        next.spendingAccount;
      expect(paidFromCash + next.cardBalance - state.cardBalance).toBe(event.cost);
    }
  });
});

/** Plays a random scenario end to end and returns every intermediate state. */
function simulate(seed: number): MonthState[] {
  const rng = createRng(seed);
  const months = randomInt(rng, 1, 6);
  const monthlyAfterEssentials = randomInt(rng, 50000, 400000);
  const events: ScenarioEvent[] = [];
  const offers: ScenarioOffer[] = [];
  for (let month = 0; month < months; month += 1) {
    for (let e = randomInt(rng, 0, 2); e > 0; e -= 1) {
      events.push({
        id: `e${String(month)}-${String(e)}`,
        monthIndex: month,
        title: 'Event',
        cost: randomInt(rng, 0, 300000),
      });
    }
    if (rng() < 0.5) {
      offers.push({
        id: `o${String(month)}`,
        monthIndex: month,
        title: 'Offer',
        cashPrice: randomInt(rng, 10000, 500000),
        monthlyInstalment: randomInt(rng, 1000, 60000),
        termMonths: randomInt(rng, 1, 24),
        upfrontFee: randomInt(rng, 0, 10000),
        monthlyFee: randomInt(rng, 0, 3000),
      });
    }
  }

  const config = makeConfig({
    id: `sim-${String(seed)}`,
    months,
    creditLimit: randomInt(rng, 100000, 1000000),
    monthlyAfterEssentials,
    existingCommitments: randomInt(rng, 0, monthlyAfterEssentials),
    emergencySavings: randomInt(rng, 0, 200000),
    minimumPaymentRate: randomInt(rng, 1, 30) / 100,
    monthlyInterestRate: randomInt(rng, 0, 50) / 1000,
    latePaymentFee: randomInt(rng, 0, 30000),
    events,
    offers,
  });
  const terms = statementTerms(config);

  let state = createInitialState(config);
  const history: MonthState[] = [state];
  for (let month = 0; month < months; month += 1) {
    for (const offer of offers.filter((item) => item.monthIndex === month)) {
      if (rng() < 0.5) {
        state = acceptOffer(state, offer);
        history.push(state);
      }
    }
    for (const event of events.filter((item) => item.monthIndex === month)) {
      state = applyEvent(state, event, pick(rng, FUNDING_SOURCES));
      history.push(state);
    }
    const statement = buildStatement(state, randomPurchases(rng), terms);
    state = applyRepayment(state, statement, pick(rng, REPAYMENT_CHOICES)).next;
    history.push(state);
    state = startNextMonth(state).next;
    history.push(state);
  }
  return history;
}

describe('whole-scenario properties', () => {
  it('balances never go negative across random multi-month runs', () => {
    for (let seed = 1; seed <= SIMULATIONS; seed += 1) {
      for (const state of simulate(seed)) {
        expectValidState(state);
      }
    }
  });

  it('the same choices always produce the same run', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(simulate(seed)).toEqual(simulate(seed));
    }
  });
});
