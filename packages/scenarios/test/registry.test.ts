import {
  applyEvent,
  applyRepayment,
  buildStatement,
  createInitialState,
  evaluateOffer,
  purchasesForMonth,
  startNextMonth,
  statementTerms,
} from '@credit-runner/finance-engine';
import { describe, expect, it } from 'vitest';
import { STARTER_SCENARIO_ID, getScenario, scenarios } from '../src/registry';

describe('scenario registry', () => {
  it('bundles every data file with unique ids', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    const ids = scenarios.map((scenario) => scenario.config.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds scenarios by id', () => {
    expect(getScenario(STARTER_SCENARIO_ID)?.config.id).toBe(STARTER_SCENARIO_ID);
    expect(getScenario('does-not-exist')).toBeUndefined();
  });

  it.each(scenarios.map((scenario) => [scenario.config.id, scenario] as const))(
    '%s starts a valid engine run',
    (_id, scenario) => {
      expect(() => createInitialState(scenario.config)).not.toThrow();
    },
  );
});

describe('starter-3-month scenario', () => {
  const scenario = getScenario(STARTER_SCENARIO_ID);
  if (scenario === undefined) throw new Error('The starter scenario is missing.');
  const { config } = scenario;

  it('is three months long', () => {
    expect(config.months).toBe(3);
  });

  it('matches the mockup figures (AGENTS.md section 4)', () => {
    const state = createInitialState(config);
    // 1,900 after essentials - 579 commitments = 1,321 available.
    expect(state.spendingAccount).toBe(132100);

    const pharmacy = config.events.find((event) => event.id === 'pharmacy');
    if (pharmacy === undefined) throw new Error('The pharmacy event is missing.');
    // Card 760 (month-0 mall shopping) + pharmacy 480 = 1,240.
    const purchases = purchasesForMonth(config, 0);
    expect(purchases.map((purchase) => purchase.amount)).toEqual([76000]);
    const charged = applyEvent(state, pharmacy, 'CARD');
    const statement = buildStatement(charged, purchases, statementTerms(config));
    expect(statement.balance).toBe(124000);
    expect(statement.minimumDue).toBe(6200);
    expect(statement.utilisationPercent).toBe(25);

    const full = applyRepayment(charged, statement, 'FULL');
    expect(full.next.spendingAccount).toBe(8100);

    const sofa = config.offers.find((offer) => offer.id === 'sofa');
    if (sofa === undefined) throw new Error('The sofa offer is missing.');
    const impact = evaluateOffer(sofa, state);
    expect(impact.totalPayable).toBe(300000);
    expect(impact.commitmentsAfter).toBe(82900);
    expect(impact.budgetRemaining).toBe(107100);
  });

  it('schedules at least one event every month and offers within the run', () => {
    for (let month = 0; month < config.months; month += 1) {
      expect(config.events.some((event) => event.monthIndex === month)).toBe(true);
    }
    expect(config.offers.every((offer) => offer.monthIndex < config.months)).toBe(true);
  });

  it('survives a cautious three-month run without shortfalls', () => {
    let state = createInitialState(config);
    for (let month = 0; month < config.months; month += 1) {
      for (const event of config.events.filter((item) => item.monthIndex === month)) {
        state = applyEvent(state, event, 'CARD');
      }
      const statement = buildStatement(
        state,
        purchasesForMonth(config, month),
        statementTerms(config),
      );
      const { next, outcome } = applyRepayment(state, statement, 'FULL');
      expect(outcome.shortfall).toBe(0);
      expect(outcome.interestCharged).toBe(0);
      state = next;
      if (month + 1 < config.months) {
        const started = startNextMonth(state);
        expect(started.budgetShortfall).toBe(0);
        state = started.next;
      }
    }
    expect(state.cardBalance).toBe(0);
  });
});
