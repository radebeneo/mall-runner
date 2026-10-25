import { formatPoints, formatRand } from '@credit-runner/finance-engine';
import type { RepaymentOutcome } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  Disclaimer,
  InfoCard,
  ScreenPanel,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { Tone } from '@credit-runner/ui';
import { useState } from 'react';
import { isFinalMonth, monthLabel, requireRepayment } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { REPAYMENT_TITLES } from './labels';

function headline(outcome: RepaymentOutcome): { tone: Tone; title: string; body: string } {
  if (outcome.interestFreeKept) {
    return {
      tone: 'success',
      title: 'You cleared this statement.',
      body: 'You paid the full balance by the due date, so no interest was added.',
    };
  }
  if (outcome.missedPayment) {
    return {
      tone: 'danger',
      title: 'This payment was missed.',
      body: `You paid less than the minimum of ${formatRand(outcome.minimumDue)}. A late fee of ${formatRand(outcome.lateFee)} and interest of ${formatRand(outcome.interestCharged)} were added, so next month opens at ${formatRand(outcome.nextOpeningBalance)}.`,
    };
  }
  return {
    tone: 'warning',
    title: 'Payment made. Some debt carries over.',
    body: `${formatRand(outcome.remainingOwed)} is still owed. Interest of ${formatRand(outcome.interestCharged)} was added, so next month opens at ${formatRand(outcome.nextOpeningBalance)}.`,
  };
}

export function MonthSummaryScreen({ session }: { session: Session }) {
  const finishMonth = useGameStore((store) => store.finishMonth);
  const [showMinimum, setShowMinimum] = useState(false);
  const { outcome, comparison, minimumAlternative, pointsEarned } = requireRepayment(session);
  const result = headline(outcome);

  return (
    <ScreenPanel badge={`Month ${monthLabel(session)}`} title={result.title}>
      <Callout tone={result.tone} live>
        {result.body}
      </Callout>
      {outcome.shortfall > 0 && (
        <Callout tone="warning" title="You could not afford the whole payment.">
          Your spending account was {formatRand(outcome.shortfall)} short of this choice.
        </Callout>
      )}
      <InfoCard title="What happened">
        <ValueList>
          <ValueRow label="You paid" value={formatRand(outcome.paid)} />
          <ValueRow label="Still owed" value={formatRand(outcome.remainingOwed)} />
          <ValueRow label="Interest added" value={formatRand(outcome.interestCharged)} />
          <ValueRow label="Late fee" value={formatRand(outcome.lateFee)} />
          <ValueRow
            label="Next month opens at"
            value={formatRand(outcome.nextOpeningBalance)}
            emphasis
          />
          <ValueRow label="Spending account now" value={formatRand(outcome.spendingAccountAfter)} />
          <ValueRow label="Points for this decision" value={formatPoints(pointsEarned)} />
        </ValueList>
      </InfoCard>
      <InfoCard title="How the choices compare">
        <p className="mb-1 text-sm text-ink-muted">
          What next month would open at after each choice.
        </p>
        <ValueList>
          {comparison.map((option) => (
            <ValueRow
              key={option.choice}
              label={`${REPAYMENT_TITLES[option.choice]}${option.choice === outcome.choice ? ' (your choice)' : ''}`}
              note={`Pays ${formatRand(option.paid)}, interest ${formatRand(option.interestCharged)}`}
              value={formatRand(option.nextOpeningBalance)}
            />
          ))}
        </ValueList>
      </InfoCard>
      {outcome.choice !== 'MINIMUM' && (
        <Button
          variant="secondary"
          aria-expanded={showMinimum}
          onClick={() => {
            setShowMinimum((shown) => !shown);
          }}
        >
          What if I paid only the minimum?
        </Button>
      )}
      {showMinimum && (
        <Callout tone="info" title="If you had paid only the minimum">
          Paying {formatRand(minimumAlternative.paid)} would leave{' '}
          {formatRand(minimumAlternative.remainingOwed)} owed. Interest of{' '}
          {formatRand(minimumAlternative.interestCharged)} would be added, so next month would open
          at {formatRand(minimumAlternative.nextOpeningBalance)}.
        </Callout>
      )}
      <Button onClick={finishMonth}>
        {isFinalMonth(session) ? 'Take the final quiz' : 'Start next month'}
      </Button>
      <Disclaimer />
    </ScreenPanel>
  );
}
