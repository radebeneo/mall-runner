import { buildStatement, statementTerms } from '../src/statement';
import type {
  MonthState,
  Purchase,
  ScenarioConfig,
  ScenarioEvent,
  ScenarioOffer,
  ScenarioPurchase,
  Statement,
  StatementTerms,
} from '../src/types';

// ---------------------------------------------------------------------------------------------
// Fixture data matching the mockups (AGENTS.md section 4). All values are fictional.
// ---------------------------------------------------------------------------------------------

export const pharmacyEvent: ScenarioEvent = {
  id: 'pharmacy',
  monthIndex: 0,
  title: 'Pharmacy visit',
  cost: 48000,
};

export const headphonesOffer: ScenarioOffer = {
  id: 'headphones',
  monthIndex: 0,
  title: 'Wireless headphones',
  cashPrice: 300000,
  monthlyInstalment: 25000,
  termMonths: 12,
  upfrontFee: 0,
  monthlyFee: 0,
};

export const mallPurchase: ScenarioPurchase = {
  id: 'mall-shopping',
  monthIndex: 0,
  label: 'Mall shopping',
  amount: 76000,
};

export const starterConfig: ScenarioConfig = {
  id: 'test-starter',
  months: 3,
  startMonth: { year: 2026, month: 9 },
  purchases: [mallPurchase],
  creditLimit: 500000,
  monthlyAfterEssentials: 190000,
  existingCommitments: 57900,
  emergencySavings: 50000,
  minimumPaymentRate: 0.05,
  monthlyInterestRate: 0.02,
  latePaymentFee: 15000,
  statementCloseDay: 25,
  paymentDueDay: 5,
  events: [pharmacyEvent],
  offers: [headphonesOffer],
};

export const starterTerms: StatementTerms = statementTerms(starterConfig);

export function makeConfig(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return { ...starterConfig, ...overrides };
}

export function makeTerms(overrides: Partial<StatementTerms> = {}): StatementTerms {
  return { ...starterTerms, ...overrides };
}

export function makeOffer(overrides: Partial<ScenarioOffer> = {}): ScenarioOffer {
  return { ...headphonesOffer, ...overrides };
}

/** The state at the start of the starter scenario, before any spending. */
export function makeState(overrides: Partial<MonthState> = {}): MonthState {
  return {
    monthIndex: 0,
    monthlyAfterEssentials: 190000,
    cardBalance: 0,
    spendingAccount: 132100,
    emergencySavings: 50000,
    commitments: 57900,
    carriedForward: 0,
    instalments: [],
    points: 0,
    ...overrides,
  };
}

export function statementFor(
  state: MonthState,
  terms: StatementTerms = starterTerms,
  purchases: readonly Purchase[] = [],
): Statement {
  return buildStatement(state, purchases, terms);
}

// ---------------------------------------------------------------------------------------------
// Seeded randomness for property tests. Deterministic, so failures are reproducible.
// ---------------------------------------------------------------------------------------------

export type Rng = () => number;

/** mulberry32: a small, fast, seeded generator returning values in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from min to max, inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list.');
  return item;
}
