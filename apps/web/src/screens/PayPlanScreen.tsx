import { formatDate, formatRand } from '@credit-runner/finance-engine';
import type { RepaymentChoice } from '@credit-runner/finance-engine';
import { Button, Callout, ChoiceGroup, Disclaimer, ScreenPanel } from '@credit-runner/ui';
import { useState } from 'react';
import { monthLabel, repaymentOptions, requireStatement } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { REPAYMENT_TITLES } from './labels';

export function PayPlanScreen({ session }: { session: Session }) {
  const confirmRepayment = useGameStore((store) => store.confirmRepayment);
  const [choice, setChoice] = useState<RepaymentChoice | null>(null);
  const statement = requireStatement(session);

  return (
    <ScreenPanel
      badge={`Month ${monthLabel(session)}`}
      title="Choose your repayment."
      intro={`Pay by ${formatDate(statement.dueDate)}. Your spending account holds ${formatRand(session.state.spendingAccount)}.`}
    >
      <ChoiceGroup<RepaymentChoice>
        legend="How much will you pay?"
        selected={choice}
        onChange={setChoice}
        options={repaymentOptions(session).map((option) => ({
          value: option.choice,
          title: REPAYMENT_TITLES[option.choice],
          amount: formatRand(option.amount),
        }))}
      />
      <Callout tone="info">
        After you confirm, you will see what each choice would have meant for next month.
      </Callout>
      <Button
        disabled={choice === null}
        onClick={() => {
          if (choice !== null) confirmRepayment(choice);
        }}
      >
        Confirm payment
      </Button>
      <Disclaimer />
    </ScreenPanel>
  );
}
