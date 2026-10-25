import { describe, expect, it } from 'vitest';
import {
  createSession,
  decideOffer,
  endMonthRun,
  fundEvent,
  loadStarterScenario,
  monthCardCharges,
  openOffer,
  requireStatement,
  statementLines,
} from './session';
import type { Session } from './session';

/** Month 1 of the starter up to the statement, paying the pharmacy bill from `source`. */
function toStatement(source: 'CARD' | 'EMERGENCY_SAVINGS', acceptOffer = false): Session {
  let session = createSession(loadStarterScenario());
  session = openOffer(session);
  session = decideOffer(session, acceptOffer);
  session = endMonthRun(session);
  return fundEvent(session, source);
}

describe('statement lines', () => {
  it('lists the mockup statement: earlier purchases R760 and the pharmacy R480', () => {
    const session = toStatement('CARD');
    expect(statementLines(session)).toEqual([
      { id: 'mall-shopping-1', kind: 'PURCHASE', label: 'Earlier card purchases', amount: 76000 },
      { id: 'event-pharmacy', kind: 'CHARGE', label: 'Pharmacy purchase', amount: 48000 },
    ]);
    expect(requireStatement(session).balance).toBe(124000);
  });

  it('leaves the pharmacy off the card when savings paid for it', () => {
    const session = toStatement('EMERGENCY_SAVINGS');
    expect(monthCardCharges(session)).toEqual([]);
    expect(statementLines(session).map((line) => line.label)).toEqual(['Earlier card purchases']);
  });

  it('has no offer fee line when the offer has no upfront fee', () => {
    const session = toStatement('CARD', true);
    expect(monthCardCharges(session).map((charge) => charge.id)).toEqual(['event-pharmacy']);
  });
});
