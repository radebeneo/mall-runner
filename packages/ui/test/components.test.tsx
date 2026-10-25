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
  DateTimeline,
  Disclaimer,
  Disclosure,
  Hud,
  IconTile,
  InfoCard,
  OptionCard,
  ScreenPanel,
  SideCard,
  Switch,
  ToggleTile,
  UsageRing,
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

describe('IconTile', () => {
  it('uses a size-based radius by default and a full circle when round', () => {
    const { container, rerender } = render(<IconTile name="star" tone="green" />);
    const square = container.firstElementChild;
    expect(square?.className).toContain('rounded-2xl');
    expect(square?.className).not.toContain('rounded-full');

    rerender(<IconTile name="star" tone="green" size="xl" shape="round" />);
    const round = container.firstElementChild;
    expect(round?.className).toContain('rounded-full');
    expect(round?.className).not.toContain('rounded-3xl');
    expect(round?.className).toContain('size-20');
  });
});

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
        month="2/3"
        cardBalance="R760"
        points="1240 pts"
        statementCloses="30 Sep"
        paymentDue="25 Oct"
      />,
    );
    const hud = screen.getByRole('banner', { name: 'Game status' });
    expect(screen.getByText('Month').nextElementSibling?.textContent).toBe('2/3');
    expect(screen.getByText('Card balance').nextElementSibling?.textContent).toBe('R760');
    expect(screen.getByText('Points').nextElementSibling?.textContent).toBe('1240 pts');
    expect(screen.getByText('Statement closes').nextElementSibling?.textContent).toBe('30 Sep');
    expect(screen.getByText('Payment due').nextElementSibling?.textContent).toBe('25 Oct');
    expect(hud.textContent).toContain('You are here');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('shows the finished run in the bar HUD', () => {
    render(
      <Hud
        variant="bar"
        month="3/3"
        monthNote="Completed"
        complete
        cardBalance="R0"
        points="1240 pts"
        statementCloses="30 Nov"
        paymentDue="25 Dec"
      />,
    );
    const hud = screen.getByRole('banner', { name: 'Game status' });
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(hud.textContent).toContain('Simulation complete');
    // The timeline's dates and "Towards statement day" give way to the finished state.
    expect(hud.textContent).not.toContain('Towards statement day');
    expect(screen.queryByText('30 Nov')).toBeNull();
  });

  it('shows a pause button only when the game can be paused', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    render(
      <Hud
        month="1/3"
        cardBalance="R0"
        points="0 pts"
        statementCloses="30 Sep"
        paymentDue="25 Oct"
        progress={2}
        onPause={onPause}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('shows the same game status in the decision-screen bar', () => {
    render(
      <Hud
        variant="bar"
        month="1/3"
        cardBalance="R1,240"
        points="1240 pts"
        statementCloses="30 Sep"
        paymentDue="25 Oct"
        progress={0.5}
      />,
    );
    const hud = screen.getByRole('banner', { name: 'Game status' });
    expect(screen.getByText('Month').nextElementSibling?.textContent).toBe('1/3');
    expect(screen.getByText('Card balance').nextElementSibling?.textContent).toBe('R1,240');
    expect(screen.getByText('Points').nextElementSibling?.textContent).toBe('1240 pts');
    expect(screen.getByText('Statement closes').nextElementSibling?.textContent).toBe('30 Sep');
    expect(screen.getByText('Payment due').nextElementSibling?.textContent).toBe('25 Oct');
    expect(hud.textContent).toContain('Towards statement day');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });
});

describe('ScreenPanel titles', () => {
  it('reads a multi-line title as one sentence', () => {
    render(<ScreenPanel title={'Small monthly payment.\nLonger commitment.'}>Body</ScreenPanel>);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Small monthly payment. Longer commitment.' }),
    ).toBeTruthy();
  });
});

describe('ChoiceGroup tiles', () => {
  it('names each tile by its title, with the short line as its description', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceGroup<'ACCEPT' | 'DECLINE'>
        legend="What will you do?"
        legendHidden
        layout="tiles"
        selected={null}
        onChange={onChange}
        options={[
          {
            value: 'ACCEPT',
            title: 'Take the offer',
            description: 'Add this commitment to your plan.',
            icon: { name: 'cart', tone: 'green' },
          },
          {
            value: 'DECLINE',
            title: 'Not this month',
            description: 'Keep your budget as it is.',
            icon: { name: 'ban', tone: 'amber' },
          },
        ]}
      />,
    );
    const decline = screen.getByRole('radio', { name: 'Not this month' });
    expect(screen.getByRole('radio', { description: 'Keep your budget as it is.' })).toBe(decline);
    expect(screen.getByRole('group', { name: 'What will you do?' })).toBeTruthy();
    await user.click(screen.getByText('Take the offer'));
    expect(onChange).toHaveBeenCalledWith('ACCEPT');
  });
});

describe('ToggleTile', () => {
  it('shows and hides the content it controls without making a choice', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <ToggleTile
            title="Compare the commitment"
            description="See how it affects your next few months."
            icon={{ name: 'scale', tone: 'purple' }}
            expanded={open}
            controls="compare"
            onToggle={() => {
              setOpen((value) => !value);
            }}
          />
          <div id="compare" hidden={!open}>
            Comparison
          </div>
        </div>
      );
    }
    render(<Harness />);
    const tile = screen.getByRole('button', {
      name: 'Compare the commitment',
      description: 'See how it affects your next few months.',
    });
    expect(tile.getAttribute('aria-controls')).toBe('compare');
    expect(tile.getAttribute('aria-expanded')).toBe('false');
    await user.click(tile);
    expect(tile.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Comparison').hidden).toBe(false);
  });
});

describe('Switch', () => {
  it('is named by its label and flips aria-checked on click or keyboard', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(true);
      return (
        <div>
          <Switch label="View alternate outcome" checked={on} onChange={setOn} controls="alt" />
          <div id="alt" hidden={!on}>
            Alternate
          </div>
        </div>
      );
    }
    render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'View alternate outcome' });
    expect(toggle.getAttribute('aria-controls')).toBe('alt');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Alternate').hidden).toBe(true);
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});

describe('OptionCard', () => {
  function Card({ locked = false, onSelect }: { locked?: boolean; onSelect: () => void }) {
    return (
      <OptionCard
        title="Use emergency savings"
        icon={{ name: 'piggy', tone: 'green' }}
        facts={[
          { icon: 'wallet', tone: 'green', text: 'Savings: R500 → R20' },
          { icon: 'card', tone: 'purple', text: 'Card balance stays R760' },
        ]}
        actionLabel="Use savings"
        locked={locked}
        onSelect={onSelect}
      />
    );
  }

  it('lists its facts in a named region and reports the choice', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Card onSelect={onSelect} />);
    expect(screen.getByRole('region', { name: 'Use emergency savings' })).toBeTruthy();
    expect(screen.getByText('Savings: R500 → R20')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Use savings' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await user.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('stays focusable but ignores clicks once a choice is locked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Card locked onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: 'Use savings' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('DateTimeline, Disclosure, UsageRing and SideCard', () => {
  it('lists the closing date before the due date', () => {
    render(
      <DateTimeline
        from={{ date: '30 September', label: 'Statement closes' }}
        to={{ date: '25 October', label: 'Payment due' }}
        caption="Pay by the due date to keep the interest-free period."
      />,
    );
    const stops = screen.getAllByRole('listitem').filter((item) => item.textContent !== '');
    expect(stops.map((item) => item.textContent)).toEqual([
      '30 SeptemberStatement closes',
      '25 OctoberPayment due',
    ]);
    expect(screen.getByText(/interest-free period/)).toBeTruthy();
  });

  it('opens from outside when controlled', () => {
    const { container, rerender } = render(
      <Disclosure title="How interest works" summary="A one-line explanation." open={false}>
        Details
      </Disclosure>,
    );
    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    expect(screen.getByText('A one-line explanation.')).toBeTruthy();
    rerender(
      <Disclosure title="How interest works" summary="A one-line explanation." open>
        Details
      </Disclosure>,
    );
    expect(details?.open).toBe(true);
    expect(screen.getByText('How interest works')).toBeTruthy();
  });

  it('keeps the usage ring decorative', () => {
    const { container } = render(<UsageRing fraction={0.25} label="25%" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).toBe('25%');
  });

  it('names a side card by its title', () => {
    render(
      <SideCard title="Emergency savings" icon="piggy" value="R500">
        Kept for surprises.
      </SideCard>,
    );
    const card = screen.getByRole('region', { name: 'Emergency savings' });
    expect(card.textContent).toContain('R500');
    expect(card.textContent).toContain('Kept for surprises.');
  });
});
