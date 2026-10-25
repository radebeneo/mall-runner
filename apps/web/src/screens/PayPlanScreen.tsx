import { formatDate, formatPercent, formatRand } from '@credit-runner/finance-engine';
import type { RepaymentChoice, RepaymentOutcome } from '@credit-runner/finance-engine';
import { Button, ChoiceGroup, Disclaimer, Disclosure, ScreenPanel } from '@credit-runner/ui';
import { useState } from 'react';
import { repaymentPreviews, requireStatement } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { REPAYMENT_ICONS, REPAYMENT_TITLES } from './labels';
import { CoveredNote, EssentialsCard, MoneyCard, RailLayout } from './rail';

/**
 * The immediate facts of a choice, from the engine's projection. Interest amounts and the
 * comparison between choices stay hidden until the player confirms (AGENTS.md section 3).
 */
function repaymentFacts(outcome: RepaymentOutcome): string[] {
  const facts: string[] = [];
  if (outcome.choice === 'NONE') {
    facts.push('The payment will be missed if nothing is paid by the due date.');
  } else {
    facts.push(`${formatRand(outcome.spendingAccountAfter)} remains in your spending account.`);
  }
  if (outcome.remainingOwed === 0) {
    facts.push('This statement balance is cleared.');
  } else if (outcome.choice !== 'NONE') {
    facts.push(
      `${formatRand(outcome.remainingOwed)} of the statement balance remains owed and is charged interest.`,
    );
  }
  if (outcome.missedPayment) {
    facts.push(`A late fee of ${formatRand(outcome.lateFee)} and interest are added.`);
  }
  if (outcome.shortfall > 0) {
    facts.push(`Your spending account is ${formatRand(outcome.shortfall)} short of this amount.`);
  }
  return facts;
}

export function PayPlanScreen({ session }: { session: Session }) {
  const confirmRepayment = useGameStore((store) => store.confirmRepayment);
  const [choice, setChoice] = useState<RepaymentChoice | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const statement = requireStatement(session);
  const { terms } = statement;

  return (
    <RailLayout
      rail={
        <div className="flex flex-col gap-3">
          <EssentialsCard session={session} />
          <MoneyCard session={session} />
          <CoveredNote session={session} />
        </div>
      }
    >
      <ScreenPanel title={`What will you pay by ${formatDate(statement.dueDate)}?`}>
        <ChoiceGroup<RepaymentChoice>
          legend="Choose your repayment plan."
          selected={choice}
          onChange={setChoice}
          options={repaymentPreviews(session).map((outcome) => ({
            value: outcome.choice,
            title: REPAYMENT_TITLES[outcome.choice],
            amount: formatRand(outcome.requested),
            icon: REPAYMENT_ICONS[outcome.choice],
            details: repaymentFacts(outcome),
          }))}
        />

        <Disclosure
          title="How interest works"
          summary="Purchases stay interest-free only when the full statement balance is paid by the due date. Paying less means interest is charged on what remains."
          open={interestOpen}
          onOpenChange={setInterestOpen}
        >
          In this scenario, interest is {formatPercent(terms.monthlyInterestRate)} a month on the
          balance left after your payment. Paying less than the minimum also adds a late fee of{' '}
          {formatRand(terms.latePaymentFee)}. After you confirm, you will see what each choice means
          for next month.
        </Disclosure>

        <Disclaimer variant="info">
          {formatRand(statement.minimumDue)} is an example minimum for this fictional learning
          scenario: {formatPercent(terms.minimumPaymentRate)} of the statement balance. Real
          minimums, interest and fees vary.
        </Disclaimer>

        <Button
          disabled={choice === null}
          onClick={() => {
            if (choice !== null) confirmRepayment(choice);
          }}
        >
          Confirm payment plan
        </Button>
        <Button
          variant="link"
          onClick={() => {
            setInterestOpen(true);
          }}
        >
          Not sure yet? Explore examples
        </Button>
      </ScreenPanel>
    </RailLayout>
  );
}
