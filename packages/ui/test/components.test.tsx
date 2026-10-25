/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  Callout,
  ChoiceGroup,
  DEFAULT_DISCLAIMER,
  Disclaimer,
  Hud,
  InfoCard,
  ScreenPanel,
  ValueList,
  ValueRow,
} from '../src/index';

afterEach(cleanup);

type Plan = 'FULL' | 'MINIMUM';

function PlanPicker({ disabled = false }: { disabled?: boolean }) {
  const [selected, setSelected] = useState<Plan | null>(null);
  return (
    <ChoiceGroup<Plan>
      legend="Choose your plan"
      selected={selected}
      onChange={setSelected}
      disabled={disabled}
      options={[
        {
          value: 'FULL',
          title: 'Pay in full',
          amount: 'R1,240',
          details: ['R81 stays in your account.'],
        },
        { value: 'MINIMUM', title: 'Pay the minimum', amount: 'R62' },
      ]}
    />
  );
}

describe('ChoiceGroup', () => {
  it('names each option by its title and amount, with details as the description', () => {
    render(<PlanPicker />);
    const full = screen.getByRole('radio', { name: 'Pay in full R1,240' });
    expect(screen.getByRole('radio', { description: 'R81 stays in your account.' })).toBe(full);
    expect(screen.getByRole('group', { name: 'Choose your plan' })).toBeTruthy();
  });

  it('starts with nothing selected and selects by click or keyboard', async () => {
    const user = userEvent.setup();
    render(<PlanPicker />);
    const full = screen.getByRole<HTMLInputElement>('radio', { name: /Pay in full/ });
    const minimum = screen.getByRole<HTMLInputElement>('radio', { name: /Pay the minimum/ });
    expect(full.checked || minimum.checked).toBe(false);

    await user.click(screen.getByText('Pay the minimum'));
    expect(minimum.checked).toBe(true);
    expect(document.activeElement).toBe(minimum);

    await user.keyboard('{ArrowUp}');
    expect(full.checked).toBe(true);
    expect(minimum.checked).toBe(false);
  });

  it('cannot be changed while disabled', async () => {
    const user = userEvent.setup();
    render(<PlanPicker disabled />);
    const full = screen.getByRole<HTMLInputElement>('radio', { name: /Pay in full/ });
    await user.click(full);
    expect(full.checked).toBe(false);
    // The inputs are disabled through their fieldset, not their own `disabled` attribute.
    expect(screen.getByRole<HTMLFieldSetElement>('group').disabled).toBe(true);
    expect(full.matches(':disabled')).toBe(true);
  });
});

describe('ScreenPanel and InfoCard', () => {
  it('moves focus to the screen heading when it appears', () => {
    render(
      <ScreenPanel title="Statement ready." badge="Month 1 of 3" intro="Please pay by 5 October.">
        <InfoCard title="Your statement">
          <ValueList>
            <ValueRow label="Statement balance" value="R1,240" emphasis />
            <ValueRow label="Example minimum due" value="R62" note="Illustrative" />
          </ValueList>
        </InfoCard>
      </ScreenPanel>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Statement ready.' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('region', { name: 'Statement ready.' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Your statement' })).toBeTruthy();
    expect(screen.getByText('Statement balance').nextElementSibling?.textContent).toBe('R1,240');
    expect(screen.getByText('Month 1 of 3')).toBeTruthy();
    expect(screen.getByText('Illustrative')).toBeTruthy();
  });
});

describe('Button', () => {
  it('is a plain button by default and reports clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Plan my payment</Button>);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Plan my payment' });
    expect(button.type).toBe('button');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not report clicks while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="secondary" disabled onClick={onClick}>
        Confirm
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Callout, Disclaimer and Hud', () => {
  it('announces live callouts only', () => {
    render(
      <div>
        <Callout tone="success" title="You cleared this statement." live>
          No interest was added.
        </Callout>
        <Callout tone="warning">A quiet tip.</Callout>
      </div>,
    );
    expect(screen.getByRole('status').textContent).toContain('You cleared this statement.');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows the default fictional-scenario disclaimer, or custom text', () => {
    const { rerender } = render(<Disclaimer />);
    expect(screen.getByRole('note').textContent).toBe(DEFAULT_DISCLAIMER);
    rerender(<Disclaimer>This is a fictional offer.</Disclaimer>);
    expect(screen.getByRole('note').textContent).toBe('This is a fictional offer.');
  });

  it('shows the game status', () => {
    render(
      <Hud
        month="2 of 3"
        cardBalance="R1,240"
        points="340 pts"
        statementCloses="25 Oct"
        paymentDue="5 Nov"
      />,
    );
    const hud = screen.getByRole('banner', { name: 'Game status' });
    expect(hud.textContent).toContain('2 of 3');
    expect(screen.getByText('Card balance').nextElementSibling?.textContent).toBe('R1,240');
    expect(screen.getByText('Points').nextElementSibling?.textContent).toBe('340 pts');
  });
});
