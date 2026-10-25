import { formatRand } from '@credit-runner/finance-engine';
import type { OfferImpact } from '@credit-runner/finance-engine';
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
import { offerImpact, pendingOffer } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

type OfferChoice = 'ACCEPT' | 'DECLINE';

function offerResult(
  accepted: boolean,
  impact: OfferImpact,
): { tone: Tone; title: string; body: string } {
  const months = String(impact.termMonths);
  if (!accepted) {
    return {
      tone: 'success',
      title: 'You said no thanks.',
      body: `Your monthly budget stays at ${formatRand(impact.budgetBefore)} before card repayments.`,
    };
  }
  if (!impact.affordable) {
    return {
      tone: 'danger',
      title: 'This offer is more than your budget can carry.',
      body: `Your commitments are now ${formatRand(impact.commitmentsAfter)} a month, which is more than your money after essentials.`,
    };
  }
  if (impact.extraCostVsCash > 0) {
    return {
      tone: 'warning',
      title: 'Offer accepted.',
      body: `Over ${months} months you will pay ${formatRand(impact.totalPayable)}, which is ${formatRand(impact.extraCostVsCash)} more than the cash price. You now have ${formatRand(impact.budgetRemaining)} a month before card repayments.`,
    };
  }
  return {
    tone: 'info',
    title: 'Offer accepted.',
    body: `It costs ${formatRand(impact.totalPayable)} in total, no more than the cash price, but adds ${formatRand(impact.monthlyCost)} to your commitments for ${months} months. You now have ${formatRand(impact.budgetRemaining)} a month before card repayments.`,
  };
}

export function OfferScreen({ session }: { session: Session }) {
  const decideOffer = useGameStore((store) => store.decideOffer);
  const [choice, setChoice] = useState<OfferChoice | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const offer = pendingOffer(session);
  if (offer === undefined) throw new Error('The offer screen needs an offer.');
  const impact = offerImpact(session, offer);
  const result = confirmed && choice !== null ? offerResult(choice === 'ACCEPT', impact) : null;

  return (
    <ScreenPanel
      badge="Instalment offer"
      title={offer.title}
      intro="You picked up a glowing shopping bag. Check the whole offer before you decide."
    >
      <InfoCard title="The offer">
        <ValueList>
          <ValueRow label="Cash price today" value={formatRand(offer.cashPrice)} />
          <ValueRow
            label="Monthly cost"
            note={`For ${String(impact.termMonths)} months, including fees`}
            value={formatRand(impact.monthlyCost)}
          />
          <ValueRow label="Upfront fee" value={formatRand(impact.upfrontFee)} />
          <ValueRow label="Total fees" value={formatRand(impact.totalFees)} />
          <ValueRow label="Total payable" value={formatRand(impact.totalPayable)} emphasis />
        </ValueList>
      </InfoCard>
      <InfoCard title="Your monthly budget">
        <ValueList>
          <ValueRow label="Commitments now" value={formatRand(impact.commitmentsBefore)} />
          <ValueRow
            label="Commitments with this offer"
            value={formatRand(impact.commitmentsAfter)}
          />
          <ValueRow
            label="Left each month now"
            note="Before card repayments"
            value={formatRand(impact.budgetBefore)}
          />
          <ValueRow
            label="Left each month with this offer"
            note="Before card repayments"
            value={formatRand(impact.budgetRemaining)}
          />
        </ValueList>
      </InfoCard>
      <ChoiceGroup<OfferChoice>
        legend="What will you do?"
        selected={choice}
        onChange={setChoice}
        disabled={confirmed}
        options={[
          { value: 'ACCEPT', title: 'Take the offer' },
          { value: 'DECLINE', title: 'Say no thanks' },
        ]}
      />
      {result !== null && (
        <Callout tone={result.tone} title={result.title} live>
          {result.body}
        </Callout>
      )}
      {confirmed && choice !== null ? (
        <Button
          onClick={() => {
            decideOffer(choice === 'ACCEPT');
          }}
        >
          Back to the mall
        </Button>
      ) : (
        <Button
          disabled={choice === null}
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
