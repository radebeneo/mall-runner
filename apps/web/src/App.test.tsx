/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { QUIZ_QUESTIONS } from './content/quiz';
import {
  confirmRepayment,
  createSession,
  decideOffer,
  endMonthRun,
  finishMonth,
  fundEvent,
  loadStarterScenario,
  openOffer,
  pendingOffer,
  viewStatement,
} from './session/session';
import type { Session } from './session/session';
import { useGameStore } from './store/game-store';

/** Plays all three starter months (decline offers, savings for bills, pay in full). */
function toFinalQuiz(): Session {
  let session = createSession(loadStarterScenario());
  for (let month = 0; month < 3; month += 1) {
    if (pendingOffer(session) !== undefined) {
      session = decideOffer(openOffer(session), false);
    }
    session = endMonthRun(session);
    while (session.cycle.phase === 'EVENT') {
      session = fundEvent(session, 'EMERGENCY_SAVINGS');
    }
    session = finishMonth(confirmRepayment(viewStatement(session), 'FULL'));
  }
  return session;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The answer buttons of one question card, found by its prompt. */
function answerButtons(prompt: string): HTMLElement[] {
  const group = screen.getByRole('group', { name: new RegExp(escapeRegExp(prompt)) });
  return within(group).getAllByRole('button');
}

beforeEach(() => {
  useGameStore.setState({ session: null });
});

afterEach(() => {
  cleanup();
});

function expectDisclaimer(): void {
  expect(screen.getAllByRole('note').length).toBeGreaterThan(0);
}

function expectNoRecommendation(): void {
  expect(screen.queryByText(/recommended/i)).toBeNull();
}

describe('decisions-only app', () => {
  it('plays month 1 from the title screen to the month summary', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Title
    expectDisclaimer();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // Month 1: the mall trip, with an offer waiting.
    expect(screen.getByRole('heading', { level: 1, name: 'Shopping at the mall' })).toBeTruthy();
    expect(screen.getByRole('banner', { name: 'Game status' })).toBeTruthy();
    expectDisclaimer();
    await user.click(screen.getByRole('button', { name: 'See the offer' }));

    // Offer: total payable is shown before choosing; no result until confirmed.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Small monthly payment. Longer commitment.' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Modern 2-seater sofa' })).toBeTruthy();
    expect(screen.getAllByText('R3,000').length).toBeGreaterThan(0);
    expect(screen.getByText(/That leaves R1,071 before card repayments/)).toBeTruthy();
    expectDisclaimer();
    expectNoRecommendation();
    expect(screen.queryByRole('status')).toBeNull();
    const confirmOffer = screen.getByRole('button', { name: 'Confirm' });
    expect((confirmOffer as HTMLButtonElement).disabled).toBe(true);
    // "Compare the commitment" shows detail without making a choice.
    const compare = screen.getByRole('button', { name: 'Compare the commitment' });
    expect(compare.getAttribute('aria-expanded')).toBe('false');
    await user.click(compare);
    expect(compare.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /Not this month/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status').textContent).toContain('You kept R250 a month available.');
    await user.click(screen.getByRole('button', { name: 'Back to the mall' }));

    // Back at the mall, the offer is gone.
    expect(screen.queryByRole('button', { name: 'See the offer' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Finish shopping' }));

    // Unexpected expense.
    expect(
      screen.getByRole('heading', { level: 1, name: 'An unexpected R480 pharmacy bill.' }),
    ).toBeTruthy();
    // Before and after figures from the engine: savings R500 → R20, card R760 → R1,240.
    expect(screen.getByText('Savings: R500 → R20')).toBeTruthy();
    expect(screen.getByText('Card balance: R760 → R1,240')).toBeTruthy();
    expectDisclaimer();
    expectNoRecommendation();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Use card' }));
    expect(screen.getByRole('status').textContent).toContain('R480 added to your card.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Statement: R760 + R480 = R1,240, minimum R62.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Statement ready. Payment comes next.' }),
    ).toBeTruthy();
    expect(screen.getByText('Earlier card purchases')).toBeTruthy();
    expect(screen.getAllByText('R1,240').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R1,321').length).toBeGreaterThan(0);
    expect(screen.getByText('R62')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expectDisclaimer();
    await user.click(screen.getByRole('button', { name: 'Plan my payment' }));

    // Pay plan: four options, no comparison and no "Recommended" before choosing.
    expect(
      screen.getByRole('heading', { level: 1, name: 'What will you pay by 25 October?' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByText('How the choices compare')).toBeNull();
    // Immediate facts come from the engine: R1,321 - R1,240 = R81 left after paying in full.
    expect(screen.getByText('R81 remains in your spending account.')).toBeTruthy();
    expect(screen.queryByText(/before applicable interest/i)).toBeNull();
    expectNoRecommendation();
    expectDisclaimer();
    await user.click(screen.getByRole('radio', { name: /Pay the example minimum/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm payment plan' }));

    // Month summary: concrete consequences from the engine.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payment made. Some debt carries over.' }),
    ).toBeTruthy();
    expect(screen.getAllByText('R1,178').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R1,201.56').length).toBeGreaterThan(0);
    expect(screen.queryByText(/before applicable interest/i)).toBeNull();
    expectDisclaimer();
    // The comparison opens from "Review your plan", after the player has chosen.
    expect(screen.queryByText('How the choices compare')).toBeNull();
    const review = screen.getByRole('button', { name: 'Review your plan' });
    expect(review.getAttribute('aria-expanded')).toBe('false');
    await user.click(review);
    expect(review.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('How the choices compare')).toBeTruthy();
    expect(screen.getByText(/\(your choice\)/)).toBeTruthy();
    // The "only the minimum" switch is hidden when the player already paid the minimum.
    expect(screen.queryByRole('switch', { name: 'View alternate outcome' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start the next month' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Shopping at the mall' })).toBeTruthy();
  });

  it('reveals the minimum-only alternative after paying in full', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'See the offer' }));
    await user.click(screen.getByRole('radio', { name: /Take the offer/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status').textContent).toContain(
      'You added R250 a month for 12 months.',
    );
    await user.click(screen.getByRole('button', { name: 'Back to the mall' }));
    await user.click(screen.getByRole('button', { name: 'Finish shopping' }));
    await user.click(screen.getByRole('button', { name: 'Use savings' }));
    expect(screen.getByRole('status').textContent).toContain(
      'R480 paid from your emergency savings.',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Plan my payment' }));
    await user.click(screen.getByRole('radio', { name: /Pay the statement in full/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm payment plan' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'You cleared this statement.' }),
    ).toBeTruthy();
    expect(screen.getByText('What if I paid only the minimum?')).toBeTruthy();
    // As in the mockup, the alternate outcome starts switched on and can be hidden.
    const toggle = screen.getByRole('switch', { name: 'View alternate outcome' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Carried forward and charged interest')).toBeTruthy();
    // Savings paid the pharmacy, so the statement is R760; minimum R38 leaves R722 owed.
    expect(screen.getAllByText('R722').length).toBeGreaterThan(0);
    expect(screen.queryByText(/before applicable interest/i)).toBeNull();
    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText('Carried forward and charged interest')).toBeNull();
  });

  it('runs the final quiz and the run summary on one screen', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ session: toFinalQuiz() });
    render(<App />);

    const heading = screen.getByRole('heading', { level: 1, name: /The run ends\./ });
    expect(screen.getByText('Simulation complete')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expectDisclaimer();
    expectNoRecommendation();
    // No marks and no summary actions before answering.
    expect(screen.queryByText(/\(correct answer\)/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Try another scenario/ })).toBeNull();
    expect(screen.queryByText('These dates are examples in an accelerated simulation.')).toBeNull();

    // A wrong answer locks the card and reveals both marks.
    const [first, ...rest] = QUIZ_QUESTIONS;
    const firstButtons = answerButtons(first!.prompt);
    await user.click(firstButtons[1]!);
    expect(firstButtons[1]!.textContent).toContain('(your answer, not correct)');
    expect(firstButtons[0]!.textContent).toContain('(correct answer)');
    expect(firstButtons.every((button) => button.getAttribute('aria-disabled') === 'true')).toBe(
      true,
    );
    // Clicking a locked answer changes nothing.
    await user.click(firstButtons[0]!);
    expect(screen.getAllByText(/Not quite\./)).toHaveLength(1);

    // The dates question uses the engine's statement dates.
    const dateButtons = answerButtons('Which date is the deadline for payment?');
    expect(dateButtons[0]!.textContent).toContain('30 September');
    expect(dateButtons[1]!.textContent).toContain('25 October');

    for (const question of rest) {
      const index = question.options.findIndex((option) => option.id === question.correctOptionId);
      await user.click(answerButtons(question.prompt)[index]!);
    }
    expect(screen.getByText('These dates are examples in an accelerated simulation.')).toBeTruthy();

    // The summary appears in place: the same heading element, no remount.
    expect(screen.getByRole('heading', { level: 1, name: /The run ends\./ })).toBe(heading);
    const explore = screen.getByRole('button', { name: /Explore credit costs and terms/ });
    expect(explore.getAttribute('aria-expanded')).toBe('false');
    await user.click(explore);
    expect(explore.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Your card repayments')).toBeTruthy();
    expect(screen.getByText(`5 of ${String(QUIZ_QUESTIONS.length)}`)).toBeTruthy();
    expect(screen.getByText('3 of 3')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Try another scenario/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Shopping at the mall' })).toBeTruthy();
  });
});
