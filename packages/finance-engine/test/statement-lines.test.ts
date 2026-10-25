import { describe, expect, it } from 'vitest';
import { applyEvent } from '../src/events';
import { sumCents } from '../src/money';
import { buildStatement } from '../src/statement';
import { OTHER_CHARGES_LABEL, itemiseStatement } from '../src/statement-lines';
import { createRng, makeState, pharmacyEvent, randomInt, starterTerms } from './helpers';

describe('itemiseStatement', () => {
  it('lists the mockup statement: earlier purchases R760 and the pharmacy R480', () => {
    const state = applyEvent(makeState(), pharmacyEvent, 'CARD');
    const statement = buildStatement(
      state,
      [{ id: 'mall', label: 'Earlier card purchases', amount: 76000 }],
      starterTerms,
    );
    const lines = itemiseStatement(statement, [
      { id: 'pharmacy', label: 'Pharmacy purchase', amount: 48000 },
    ]);
    expect(lines).toEqual([
      { id: 'mall', kind: 'PURCHASE', label: 'Earlier card purchases', amount: 76000 },
      { id: 'pharmacy', kind: 'CHARGE', label: 'Pharmacy purchase', amount: 48000 },
    ]);
    expect(statement.balance).toBe(124000);
  });

  it('starts with the brought-forward balance when there is one', () => {
    const statement = buildStatement(
      makeState({ cardBalance: 62000, carriedForward: 62000 }),
      [{ id: 'shoes', label: 'Shoes', amount: 30000 }],
      starterTerms,
    );
    const lines = itemiseStatement(statement, []);
    expect(lines.map((line) => line.kind)).toEqual(['BROUGHT_FORWARD', 'PURCHASE']);
    expect(lines[0]?.amount).toBe(62000);
  });

  it('puts unlisted new charges on an "other" line so the lines still add up', () => {
    const statement = buildStatement(makeState({ cardBalance: 15000 }), [], starterTerms);
    expect(itemiseStatement(statement, [])).toEqual([
      { id: 'other-charges', kind: 'OTHER', label: OTHER_CHARGES_LABEL, amount: 15000 },
    ]);
  });

  it('leaves out zero amounts', () => {
    const statement = buildStatement(
      makeState(),
      [{ id: 'free', label: 'Free sample', amount: 0 }],
      starterTerms,
    );
    expect(itemiseStatement(statement, [{ id: 'none', label: 'Nothing', amount: 0 }])).toEqual([]);
  });

  it('rejects charges that are not on the statement', () => {
    const statement = buildStatement(makeState(), [], starterTerms);
    expect(() => itemiseStatement(statement, [{ id: 'x', label: 'X', amount: 100 }])).toThrow(
      RangeError,
    );
  });

  it('rejects invalid charge amounts', () => {
    const statement = buildStatement(makeState({ cardBalance: 1000 }), [], starterTerms);
    expect(() => itemiseStatement(statement, [{ id: 'x', label: 'X', amount: 1.5 }])).toThrow(
      RangeError,
    );
  });

  it('always adds up to the statement balance', () => {
    const rng = createRng(20261025);
    for (let run = 0; run < 200; run += 1) {
      const carriedForward = randomInt(rng, 0, 300000);
      const charge = randomInt(rng, 0, 100000);
      const unlisted = randomInt(rng, 0, 50000);
      const statement = buildStatement(
        makeState({ cardBalance: carriedForward + charge + unlisted, carriedForward }),
        [{ id: 'p', label: 'Purchase', amount: randomInt(rng, 0, 200000) }],
        starterTerms,
      );
      const lines = itemiseStatement(statement, [{ id: 'c', label: 'Charge', amount: charge }]);
      expect(sumCents(lines.map((line) => line.amount))).toBe(statement.balance);
    }
  });
});
