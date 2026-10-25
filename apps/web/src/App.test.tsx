/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { useGameStore } from './store/game-store';

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
    expect(screen.getByRole('heading', { level: 1, name: 'Wireless headphones' })).toBeTruthy();
    expect(screen.getAllByText('R3,000').length).toBeGreaterThan(0);
    expectDisclaimer();
    expectNoRecommendation();
    expect(screen.queryByRole('status')).toBeNull();
    const confirmOffer = screen.getByRole('button', { name: 'Confirm' });
    expect((confirmOffer as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: /Say no thanks/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status').textContent).toContain('You said no thanks.');
    await user.click(screen.getByRole('button', { name: 'Back to the mall' }));

    // Back at the mall, the offer is gone.
    expect(screen.queryByRole('button', { name: 'See the offer' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Finish shopping' }));

    // Unexpected expense.
    expect(screen.getByRole('heading', { level: 1, name: 'Pharmacy visit' })).toBeTruthy();
    expectDisclaimer();
    expectNoRecommendation();
    await user.click(screen.getByRole('radio', { name: /Put it on the card/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status').textContent).toContain('It is on your card.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Statement: R760 + R480 = R1,240, minimum R62.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your statement is ready.' }),
    ).toBeTruthy();
    expect(screen.getAllByText('R1,240').length).toBeGreaterThan(0);
    expect(screen.getByText('R62')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expectDisclaimer();
    await user.click(screen.getByRole('button', { name: 'Plan my payment' }));

    // Pay plan: four options, no comparison and no "Recommended" before choosing.
    expect(screen.getByRole('heading', { level: 1, name: 'Choose your repayment.' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByText('How the choices compare')).toBeNull();
    expectNoRecommendation();
    expectDisclaimer();
    await user.click(screen.getByRole('radio', { name: /Pay the minimum/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }));

    // Month summary: concrete consequences from the engine.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payment made. Some debt carries over.' }),
    ).toBeTruthy();
    expect(screen.getByText('How the choices compare')).toBeTruthy();
    expect(screen.getAllByText('R1,178').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R1,201.56').length).toBeGreaterThan(0);
    expect(screen.getByText(/\(your choice\)/)).toBeTruthy();
    expect(screen.queryByText(/before applicable interest/i)).toBeNull();
    expectDisclaimer();
    // The "only the minimum" toggle is hidden when the player already paid the minimum.
    expect(screen.queryByRole('button', { name: 'What if I paid only the minimum?' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start next month' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Shopping at the mall' })).toBeTruthy();
  });

  it('reveals the minimum-only alternative after paying in full', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'See the offer' }));
    await user.click(screen.getByRole('radio', { name: /Take the offer/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status').textContent).toContain('Offer accepted.');
    await user.click(screen.getByRole('button', { name: 'Back to the mall' }));
    await user.click(screen.getByRole('button', { name: 'Finish shopping' }));
    await user.click(screen.getByRole('radio', { name: /Use emergency savings/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Plan my payment' }));
    await user.click(screen.getByRole('radio', { name: /Pay the full balance/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'You cleared this statement.' }),
    ).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'What if I paid only the minimum?' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('If you had paid only the minimum')).toBeTruthy();
  });
});
