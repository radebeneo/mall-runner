import { assertCents } from './guards';
import { sumCents } from './money';
import type { CardCharge, Statement, StatementLine } from './types';

export const BROUGHT_FORWARD_LABEL = 'Brought forward';
export const OTHER_CHARGES_LABEL = 'Other card charges';

/**
 * Breaks a statement balance into labelled lines: the amount brought forward, each purchase,
 * each known card charge, and any remaining new charges as one "other" line. The lines always add
 * up to `statement.balance`, so a screen can list them without doing any arithmetic. Zero
 * amounts are left out.
 */
export function itemiseStatement(
  statement: Statement,
  charges: readonly CardCharge[],
): StatementLine[] {
  for (const charge of charges) {
    assertCents(charge.amount, `Charge "${charge.id}" amount`);
  }

  const listed = statement.purchasesTotal + sumCents(charges.map((charge) => charge.amount));
  if (listed > statement.newCharges) {
    throw new RangeError(
      `Itemised charges (${String(listed)}) exceed the statement's new charges (${String(statement.newCharges)}).`,
    );
  }

  const lines: StatementLine[] = [];
  if (statement.openingBalance > 0) {
    lines.push({
      id: 'brought-forward',
      kind: 'BROUGHT_FORWARD',
      label: BROUGHT_FORWARD_LABEL,
      amount: statement.openingBalance,
    });
  }
  for (const purchase of statement.purchases) {
    if (purchase.amount > 0) {
      lines.push({
        id: purchase.id,
        kind: 'PURCHASE',
        label: purchase.label,
        amount: purchase.amount,
      });
    }
  }
  for (const charge of charges) {
    if (charge.amount > 0) {
      lines.push({ id: charge.id, kind: 'CHARGE', label: charge.label, amount: charge.amount });
    }
  }
  const other = statement.newCharges - listed;
  if (other > 0) {
    lines.push({ id: 'other-charges', kind: 'OTHER', label: OTHER_CHARGES_LABEL, amount: other });
  }
  return lines;
}
