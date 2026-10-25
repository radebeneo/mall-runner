import { describe, expect, it } from 'vitest';
import { buildStatement } from '../src/statement';
import { assertScenarioPurchase, pendingCardBalance, purchasesForMonth } from '../src/purchases';
import { mallPurchase, makeConfig, makeState, pharmacyEvent, starterTerms } from './helpers';

describe('assertScenarioPurchase', () => {
  it('accepts a valid purchase', () => {
    expect(() => {
      assertScenarioPurchase(mallPurchase);
    }).not.toThrow();
  });

  it.each([
    ['negative amount', { ...mallPurchase, amount: -1 }],
    ['fractional amount', { ...mallPurchase, amount: 10.5 }],
    ['negative month', { ...mallPurchase, monthIndex: -1 }],
    ['fractional month', { ...mallPurchase, monthIndex: 0.5 }],
  ])('rejects a %s', (_label, purchase) => {
    expect(() => {
      assertScenarioPurchase(purchase);
    }).toThrow(/mall-shopping/);
  });
});

describe('purchasesForMonth', () => {
  const config = makeConfig({
    purchases: [
      mallPurchase,
      { id: 'groceries-top-up', monthIndex: 0, label: 'Groceries top-up', amount: 12000 },
      { id: 'mall-shopping-2', monthIndex: 1, label: 'Mall shopping', amount: 54000 },
    ],
  });

  it("returns only that month's purchases, in scenario order, as statement purchases", () => {
    expect(purchasesForMonth(config, 0)).toEqual([
      { id: 'mall-shopping', label: 'Mall shopping', amount: 76000 },
      { id: 'groceries-top-up', label: 'Groceries top-up', amount: 12000 },
    ]);
    expect(purchasesForMonth(config, 1)).toEqual([
      { id: 'mall-shopping-2', label: 'Mall shopping', amount: 54000 },
    ]);
    expect(purchasesForMonth(config, 2)).toEqual([]);
  });

  it('rejects an invalid month', () => {
    expect(() => purchasesForMonth(config, -1)).toThrow();
  });

  it('builds the mockup statement: R760 shopping + R480 pharmacy = R1,240', () => {
    // The pharmacy event was charged to the card earlier in the month.
    const state = makeState({ cardBalance: pharmacyEvent.cost });
    const statement = buildStatement(state, purchasesForMonth(makeConfig(), 0), starterTerms);
    expect(statement.purchasesTotal).toBe(76000);
    expect(statement.balance).toBe(124000);
    expect(statement.minimumDue).toBe(6200);
    expect(statement.utilisationPercent).toBe(25);
  });
});

describe('pendingCardBalance', () => {
  it('adds unbilled purchases to the card balance', () => {
    const state = makeState({ cardBalance: 48000 });
    expect(pendingCardBalance(state, [])).toBe(48000);
    expect(
      pendingCardBalance(state, [{ id: 'mall-shopping', label: 'Mall shopping', amount: 76000 }]),
    ).toBe(124000);
  });

  it('rejects invalid amounts', () => {
    expect(() => pendingCardBalance(makeState({ cardBalance: -1 }), [])).toThrow();
    expect(() =>
      pendingCardBalance(makeState(), [{ id: 'bad', label: 'Bad', amount: -100 }]),
    ).toThrow(/bad/);
  });
});
