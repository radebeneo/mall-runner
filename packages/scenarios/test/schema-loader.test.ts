import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import starter from '../data/starter-3-month.json';
import { ScenarioValidationError, loadScenarioModules, parseScenario } from '../src/loader';
import type { scenarioFileSchema } from '../src/schema';

type ScenarioFile = z.input<typeof scenarioFileSchema>;

/** A fresh, valid copy of the starter scenario that a test can safely change. */
const validFile = (): ScenarioFile => JSON.parse(JSON.stringify(starter)) as ScenarioFile;

/** The validation issues for some data, or an empty list when it is valid. */
function issuesFor(data: unknown): readonly string[] {
  try {
    parseScenario(data, 'test.json');
    return [];
  } catch (error) {
    if (error instanceof ScenarioValidationError) return error.issues;
    throw error;
  }
}

function withConfig(overrides: Record<string, unknown>): unknown {
  const file = validFile();
  return { ...file, config: { ...file.config, ...overrides } };
}

describe('parseScenario', () => {
  it('accepts the starter scenario', () => {
    const scenario = parseScenario(validFile());
    expect(scenario.config.id).toBe('starter-3-month');
    expect(scenario.config.months).toBe(3);
  });

  it('trims display text', () => {
    const file = validFile();
    file.title = '  Spaced title  ';
    expect(parseScenario(file).title).toBe('Spaced title');
  });

  it.each([
    ['fractional cents', { creditLimit: 500000.5 }, 'config.creditLimit'],
    ['money as text', { emergencySavings: '500' }, 'config.emergencySavings'],
    ['negative money', { latePaymentFee: -1 }, 'config.latePaymentFee'],
    ['a zero credit limit', { creditLimit: 0 }, 'config.creditLimit'],
    ['zero months', { months: 0 }, 'config.months'],
    ['a rate above 1', { minimumPaymentRate: 5 }, 'config.minimumPaymentRate'],
    ['a negative rate', { monthlyInterestRate: -0.01 }, 'config.monthlyInterestRate'],
    ['day 0', { statementCloseDay: 0 }, 'config.statementCloseDay'],
    ['day 32', { paymentDueDay: 32 }, 'config.paymentDueDay'],
    ['an id with spaces', { id: 'Starter Scenario' }, 'config.id'],
    [
      'commitments above the monthly money',
      { existingCommitments: 200000 },
      'config.existingCommitments',
    ],
  ])('rejects %s', (_name, overrides, path) => {
    const issues = issuesFor(withConfig(overrides));
    expect(issues.some((issue) => issue.startsWith(`${path}:`))).toBe(true);
  });

  it('rejects unknown fields, so typos are caught', () => {
    const issues = issuesFor(withConfig({ creditLimt: 500000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^config:/);
    expect(issues[0]).toContain('creditLimt');
  });

  it('rejects missing fields', () => {
    const file = validFile();
    const config: Partial<ScenarioFile['config']> = { ...file.config };
    delete config.latePaymentFee;
    const issues = issuesFor({ ...file, config });
    expect(issues.some((issue) => issue.startsWith('config.latePaymentFee:'))).toBe(true);
  });

  it('rejects an unsupported schema version', () => {
    const issues = issuesFor({ ...validFile(), schemaVersion: 2 });
    expect(issues.some((issue) => issue.startsWith('schemaVersion:'))).toBe(true);
  });

  it('rejects empty display text', () => {
    const issues = issuesFor({ ...validFile(), title: '   ' });
    expect(issues.some((issue) => issue.startsWith('title:'))).toBe(true);
  });

  it('reads the display-only commitments note', () => {
    expect(parseScenario(validFile()).commitmentsNote).toBe('clothing + phone');
  });

  it('allows the commitments note to be left out', () => {
    const file = validFile();
    delete file.commitmentsNote;
    expect(parseScenario(file).commitmentsNote).toBeUndefined();
  });

  it('rejects an empty commitments note', () => {
    const issues = issuesFor({ ...validFile(), commitmentsNote: '  ' });
    expect(issues.some((issue) => issue.startsWith('commitmentsNote:'))).toBe(true);
  });

  it('rejects data that is not an object', () => {
    expect(issuesFor(null)).toEqual([expect.stringMatching(/^\(file\):/)]);
    expect(issuesFor('starter')).toHaveLength(1);
  });

  it('rejects events and offers scheduled after the last month', () => {
    const file = validFile();
    const [firstEvent] = file.config.events;
    const [firstOffer] = file.config.offers;
    if (firstEvent === undefined || firstOffer === undefined) throw new Error('fixture changed');
    firstEvent.monthIndex = 3;
    firstOffer.monthIndex = 7;
    const issues = issuesFor(file);
    expect(issues.some((issue) => issue.startsWith('config.events.0.monthIndex:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('config.offers.0.monthIndex:'))).toBe(true);
  });

  it('rejects ids shared by an event and an offer', () => {
    const file = validFile();
    const [firstOffer] = file.config.offers;
    if (firstOffer === undefined) throw new Error('fixture changed');
    firstOffer.id = 'pharmacy';
    const issues = issuesFor(file);
    expect(issues).toEqual([expect.stringMatching(/^config\.offers\.0\.id: Duplicate id/)]);
  });

  it('reads the start month and scheduled purchases', () => {
    const scenario = parseScenario(validFile());
    expect(scenario.config.startMonth).toEqual({ year: 2026, month: 9 });
    expect(scenario.config.purchases[0]).toEqual({
      id: 'mall-shopping-1',
      monthIndex: 0,
      label: 'Earlier card purchases',
      amount: 76000,
    });
  });

  it.each([
    ['month 0', { year: 2026, month: 0 }, 'config.startMonth.month'],
    ['month 13', { year: 2026, month: 13 }, 'config.startMonth.month'],
    ['a fractional year', { year: 2026.5, month: 9 }, 'config.startMonth.year'],
    ['year 0', { year: 0, month: 9 }, 'config.startMonth.year'],
  ])('rejects a start month with %s', (_name, startMonth, path) => {
    const issues = issuesFor(withConfig({ startMonth }));
    expect(issues.some((issue) => issue.startsWith(`${path}:`))).toBe(true);
  });

  it('rejects a missing start month', () => {
    const file = validFile();
    const config: Partial<ScenarioFile['config']> = { ...file.config };
    delete config.startMonth;
    const issues = issuesFor({ ...file, config });
    expect(issues.some((issue) => issue.startsWith('config.startMonth:'))).toBe(true);
  });

  it('validates every purchase field', () => {
    const file = validFile();
    const [firstPurchase] = file.config.purchases;
    if (firstPurchase === undefined) throw new Error('fixture changed');
    firstPurchase.amount = 10.5;
    firstPurchase.label = ' ';
    firstPurchase.monthIndex = -1;
    const issues = issuesFor(file);
    expect(issues.some((issue) => issue.startsWith('config.purchases.0.amount:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('config.purchases.0.label:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('config.purchases.0.monthIndex:'))).toBe(true);
  });

  it('rejects a purchase scheduled after the last month', () => {
    const file = validFile();
    const [firstPurchase] = file.config.purchases;
    if (firstPurchase === undefined) throw new Error('fixture changed');
    firstPurchase.monthIndex = 3;
    const issues = issuesFor(file);
    expect(issues).toEqual([
      expect.stringMatching(/^config\.purchases\.0\.monthIndex: Must be less than months \(3\)/),
    ]);
  });

  it('rejects ids shared by a purchase and an event', () => {
    const file = validFile();
    const [firstEvent] = file.config.events;
    if (firstEvent === undefined) throw new Error('fixture changed');
    firstEvent.id = 'mall-shopping-1';
    const issues = issuesFor(file);
    expect(issues).toEqual([expect.stringMatching(/^config\.events\.0\.id: Duplicate id/)]);
  });

  it('validates every offer field', () => {
    const file = validFile();
    const [firstOffer] = file.config.offers;
    if (firstOffer === undefined) throw new Error('fixture changed');
    firstOffer.termMonths = 0;
    firstOffer.monthlyFee = 12.5;
    const issues = issuesFor(file);
    expect(issues.some((issue) => issue.startsWith('config.offers.0.termMonths:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('config.offers.0.monthlyFee:'))).toBe(true);
  });

  it('reports every problem at once with the source name', () => {
    const data = withConfig({ creditLimit: -5, months: 1.5, paymentDueDay: 40 });
    let caught: unknown;
    try {
      parseScenario(data, 'broken.json');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ScenarioValidationError);
    const error = caught as ScenarioValidationError;
    expect(error.source).toBe('broken.json');
    expect(error.issues.length).toBeGreaterThanOrEqual(3);
    expect(error.message).toContain('Invalid scenario "broken.json"');
    expect(error.message).toContain('config.paymentDueDay');
  });
});

describe('loadScenarioModules', () => {
  it('validates every module and returns them sorted by path', () => {
    const second = validFile();
    second.config.id = 'second-scenario';
    const loaded = loadScenarioModules({ '../data/b.json': second, '../data/a.json': validFile() });
    expect(loaded.map((scenario) => scenario.config.id)).toEqual([
      'starter-3-month',
      'second-scenario',
    ]);
  });

  it('rejects two files with the same scenario id', () => {
    expect(() =>
      loadScenarioModules({ '../data/a.json': validFile(), '../data/b.json': validFile() }),
    ).toThrow(/"starter-3-month" is already used by \.\.\/data\/a\.json/);
  });

  it('names the file that failed', () => {
    expect(() => loadScenarioModules({ '../data/bad.json': withConfig({ months: 0 }) })).toThrow(
      /Invalid scenario "\.\.\/data\/bad\.json"/,
    );
  });

  it('accepts an empty set', () => {
    expect(loadScenarioModules({})).toEqual([]);
  });
});
