import { describe, expect, it } from 'vitest';
import {
  CYCLE_PHASES,
  InvalidTransitionError,
  canTransition,
  createCycle,
  createInitialState,
  startNextMonth,
  transition,
  validateScenarioConfig,
  type CycleAction,
  type CyclePhase,
  type CycleState,
} from '../src/month-cycle';
import { headphonesOffer, makeConfig, makeOffer, makeState, pharmacyEvent } from './helpers';

describe('validateScenarioConfig and createInitialState', () => {
  it('accepts the starter scenario', () => {
    expect(() => {
      validateScenarioConfig(makeConfig());
    }).not.toThrow();
  });

  it.each([
    ['zero months', makeConfig({ months: 0 })],
    ['fractional credit limit', makeConfig({ creditLimit: 1.5 })],
    ['interest rate above 1', makeConfig({ monthlyInterestRate: 1.5 })],
    ['due day 0', makeConfig({ paymentDueDay: 0 })],
    ['negative savings', makeConfig({ emergencySavings: -1 })],
    ['commitments above income', makeConfig({ existingCommitments: 200000 })],
    ['event after the last month', makeConfig({ events: [{ ...pharmacyEvent, monthIndex: 3 }] })],
    ['offer after the last month', makeConfig({ offers: [makeOffer({ monthIndex: 5 })] })],
    ['event with a negative cost', makeConfig({ events: [{ ...pharmacyEvent, cost: -1 }] })],
    ['offer with no term', makeConfig({ offers: [makeOffer({ termMonths: 0 })] })],
  ])('rejects %s', (_label, config) => {
    expect(() => {
      validateScenarioConfig(config);
    }).toThrow(RangeError);
  });

  it('starts month 0 with the budget left after commitments', () => {
    expect(createInitialState(makeConfig())).toEqual(makeState());
  });

  it('validates before creating state', () => {
    expect(() => createInitialState(makeConfig({ months: 0 }))).toThrow(RangeError);
  });
});

describe('startNextMonth', () => {
  it('pays in the new month, pays commitments and carries leftover money over', () => {
    const { next, budgetShortfall, completedInstalments } = startNextMonth(
      makeState({ spendingAccount: 8100 }),
    );
    expect(next.monthIndex).toBe(1);
    expect(next.spendingAccount).toBe(8100 + 190000 - 57900);
    expect(next.commitments).toBe(57900);
    expect(budgetShortfall).toBe(0);
    expect(completedInstalments).toEqual([]);
  });

  it('counts down instalments and drops finished ones from commitments', () => {
    const state = makeState({
      commitments: 57900 + 25000 + 10000,
      instalments: [
        { offerId: 'headphones', monthlyCost: 25000, monthsRemaining: 3 },
        { offerId: 'phone-case', monthlyCost: 10000, monthsRemaining: 1 },
      ],
    });
    const { next, completedInstalments } = startNextMonth(state);
    // The final payment for the phone case is made this month, then it drops off.
    expect(next.spendingAccount).toBe(132100 + 190000 - 92900);
    expect(next.commitments).toBe(57900 + 25000);
    expect(next.instalments).toEqual([
      { offerId: 'headphones', monthlyCost: 25000, monthsRemaining: 2 },
    ]);
    expect(completedInstalments).toEqual(['phone-case']);
  });

  it('reports commitments the month cannot cover instead of going negative', () => {
    const { next, budgetShortfall } = startNextMonth(
      makeState({ spendingAccount: 0, commitments: 200000 }),
    );
    expect(next.spendingAccount).toBe(0);
    expect(budgetShortfall).toBe(10000);
  });

  it('is consistent with accepting an offer', () => {
    const { next } = startNextMonth(
      makeState({
        commitments: 82900,
        instalments: [{ offerId: headphonesOffer.id, monthlyCost: 25000, monthsRemaining: 12 }],
      }),
    );
    expect(next.spendingAccount).toBe(132100 + 107100);
  });
});

describe('month cycle state machine', () => {
  const at = (phase: CyclePhase, overrides: Partial<CycleState> = {}): CycleState => ({
    phase,
    monthIndex: 0,
    months: 3,
    pendingEvents: 0,
    ...overrides,
  });

  it('starts running in month 0', () => {
    expect(createCycle(3)).toEqual(at('RUNNING'));
    expect(() => createCycle(0)).toThrow(RangeError);
  });

  it('runs a full three-month session through to the run summary', () => {
    let cycle = createCycle(3);
    const visited: CyclePhase[] = [cycle.phase];
    const step = (action: CycleAction) => {
      cycle = transition(cycle, action);
      visited.push(cycle.phase);
    };

    // Month 0: an offer pickup, then one unexpected expense.
    step({ type: 'OFFER_TRIGGERED' });
    step({ type: 'OFFER_RESOLVED' });
    step({ type: 'RUN_ENDED', eventCount: 1 });
    step({ type: 'EVENT_RESOLVED' });
    step({ type: 'STATEMENT_VIEWED' });
    step({ type: 'PAYMENT_CONFIRMED' });
    step({ type: 'MONTH_SUMMARY_DONE' });
    expect(cycle.monthIndex).toBe(1);

    // Months 1 and 2: no events.
    for (let month = 1; month < 3; month += 1) {
      step({ type: 'RUN_ENDED', eventCount: 0 });
      step({ type: 'STATEMENT_VIEWED' });
      step({ type: 'PAYMENT_CONFIRMED' });
      step({ type: 'MONTH_SUMMARY_DONE' });
    }
    expect(cycle.phase).toBe('FINAL_QUIZ');
    expect(cycle.monthIndex).toBe(2);

    step({ type: 'QUIZ_COMPLETED' });
    expect(visited).toEqual([
      'RUNNING',
      'OFFER_CHECK',
      'RUNNING',
      'EVENT',
      'STATEMENT_READY',
      'PLAN_PAYMENT',
      'MONTH_SUMMARY',
      'RUNNING',
      'STATEMENT_READY',
      'PLAN_PAYMENT',
      'MONTH_SUMMARY',
      'RUNNING',
      'STATEMENT_READY',
      'PLAN_PAYMENT',
      'MONTH_SUMMARY',
      'FINAL_QUIZ',
      'RUN_SUMMARY',
    ]);
  });

  it('stays on the event screen until every expense is resolved', () => {
    let cycle = transition(createCycle(3), { type: 'RUN_ENDED', eventCount: 2 });
    expect(cycle).toEqual(at('EVENT', { pendingEvents: 2 }));
    cycle = transition(cycle, { type: 'EVENT_RESOLVED' });
    expect(cycle).toEqual(at('EVENT', { pendingEvents: 1 }));
    cycle = transition(cycle, { type: 'EVENT_RESOLVED' });
    expect(cycle).toEqual(at('STATEMENT_READY'));
  });

  it('goes to the final quiz after a one-month scenario', () => {
    const cycle = transition(at('MONTH_SUMMARY', { months: 1 }), { type: 'MONTH_SUMMARY_DONE' });
    expect(cycle.phase).toBe('FINAL_QUIZ');
  });

  const invalid: Record<CyclePhase, CycleAction> = {
    RUNNING: { type: 'STATEMENT_VIEWED' },
    OFFER_CHECK: { type: 'RUN_ENDED', eventCount: 0 },
    EVENT: { type: 'STATEMENT_VIEWED' },
    STATEMENT_READY: { type: 'PAYMENT_CONFIRMED' },
    PLAN_PAYMENT: { type: 'MONTH_SUMMARY_DONE' },
    MONTH_SUMMARY: { type: 'QUIZ_COMPLETED' },
    FINAL_QUIZ: { type: 'MONTH_SUMMARY_DONE' },
    RUN_SUMMARY: { type: 'QUIZ_COMPLETED' },
  };

  it.each(CYCLE_PHASES)('rejects an out-of-order action in %s', (phase) => {
    const action = invalid[phase];
    expect(() => transition(at(phase), action)).toThrow(InvalidTransitionError);
    expect(canTransition(at(phase), action)).toBe(false);
  });

  it('describes the rejected transition', () => {
    try {
      transition(at('RUN_SUMMARY'), { type: 'OFFER_TRIGGERED' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      if (!(error instanceof InvalidTransitionError)) return;
      expect(error.name).toBe('InvalidTransitionError');
      expect(error.phase).toBe('RUN_SUMMARY');
      expect(error.actionType).toBe('OFFER_TRIGGERED');
      expect(error.message).toBe('Cannot handle OFFER_TRIGGERED while in RUN_SUMMARY.');
    }
  });

  it('canTransition accepts valid actions', () => {
    expect(canTransition(createCycle(3), { type: 'OFFER_TRIGGERED' })).toBe(true);
  });

  it('canTransition still surfaces bad input rather than hiding it', () => {
    expect(() => canTransition(createCycle(3), { type: 'RUN_ENDED', eventCount: -1 })).toThrow(
      RangeError,
    );
  });
});
