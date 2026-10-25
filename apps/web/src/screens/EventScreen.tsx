import { formatRand } from '@credit-runner/finance-engine';
import type { EventFunding, FundingSource } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  ChoiceGroup,
  Disclaimer,
  InfoCard,
  ScreenPanel,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { Tone } from '@credit-runner/ui';
import { useState } from 'react';
import { eventOptions, pendingEvent } from '../session/session';
import type { EventOption, Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { FUNDING_TITLES } from './labels';

function optionDetails(option: EventOption): string[] {
  const { funding, after } = option;
  const details: string[] = [];
  if (funding.source === 'EMERGENCY_SAVINGS') {
    details.push(`Emergency savings left: ${formatRand(after.emergencySavings)}`);
  }
  if (funding.source === 'SPENDING_ACCOUNT') {
    details.push(`Spending account left: ${formatRand(after.spendingAccount)}`);
  }
  if (funding.toCard > 0) details.push(`Goes on the card: ${formatRand(funding.toCard)}`);
  details.push(`Card balance: ${formatRand(option.cardBalanceAfter)}`);
  return details;
}

function fundingResult(funding: EventFunding): { tone: Tone; title: string; body: string } {
  if (funding.fellBackToCard) {
    const covered =
      funding.source === 'EMERGENCY_SAVINGS'
        ? `Your emergency savings covered ${formatRand(funding.fromSavings)}`
        : `Your spending account covered ${formatRand(funding.fromSpending)}`;
    return {
      tone: 'warning',
      title: 'Part of it went on the card.',
      body: `${covered}. The other ${formatRand(funding.toCard)} went on your card.`,
    };
  }
  switch (funding.source) {
    case 'CARD':
      return {
        tone: 'info',
        title: 'It is on your card.',
        body: `${formatRand(funding.toCard)} joins this month's statement. If you don't pay the full statement balance by the due date, it can attract interest.`,
      };
    case 'EMERGENCY_SAVINGS':
      return {
        tone: 'success',
        title: 'Paid from your emergency savings.',
        body: 'No new debt. This is what an emergency fund is for.',
      };
    case 'SPENDING_ACCOUNT':
      return {
        tone: 'success',
        title: 'Paid from your spending account.',
        body: 'No new debt, but there is less money left for your card repayment.',
      };
  }
}

export function EventScreen({ session }: { session: Session }) {
  const fundEvent = useGameStore((store) => store.fundEvent);
  const [source, setSource] = useState<FundingSource | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const event = pendingEvent(session);
  if (event === undefined) throw new Error('The event screen needs an unexpected expense.');
  const options = eventOptions(session, event);
  const chosen = options.find((option) => option.source === source);
  const result = confirmed && chosen !== undefined ? fundingResult(chosen.funding) : null;

  return (
    <ScreenPanel
      badge="Unexpected expense"
      title={event.title}
      intro="A cost you did not plan for. How will you pay for it?"
    >
      <InfoCard title="The bill">
        <ValueList>
          <ValueRow label="Amount to pay" value={formatRand(event.cost)} emphasis />
          <ValueRow label="Emergency savings" value={formatRand(session.state.emergencySavings)} />
          <ValueRow label="Spending account" value={formatRand(session.state.spendingAccount)} />
        </ValueList>
      </InfoCard>
      <ChoiceGroup<FundingSource>
        legend="Choose how to pay"
        selected={source}
        onChange={setSource}
        disabled={confirmed}
        options={options.map((option) => ({
          value: option.source,
          title: FUNDING_TITLES[option.source],
          details: optionDetails(option),
        }))}
      />
      {result !== null && (
        <Callout tone={result.tone} title={result.title} live>
          {result.body}
        </Callout>
      )}
      {confirmed && source !== null ? (
        <Button
          onClick={() => {
            fundEvent(source);
          }}
        >
          Continue
        </Button>
      ) : (
        <Button
          disabled={source === null}
          onClick={() => {
            setConfirmed(true);
          }}
        >
          Confirm
        </Button>
      )}
      <Disclaimer />
    </ScreenPanel>
  );
}
