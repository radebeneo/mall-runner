import { formatRand } from '@credit-runner/finance-engine';
import type { RepaymentOutcome } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  Disclaimer,
  Icon,
  InfoCard,
  ScreenPanel,
  Switch,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { IconName, TileTone } from '@credit-runner/ui';
import { useId, useState } from 'react';
import characterFront from '../assets/art/character-front.png';
import { isFinalMonth, monthSavingsUsed, requireRepayment } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { REPAYMENT_TITLES } from './labels';

interface Headline {
  icon: { name: IconName; tone: TileTone };
  title: string;
  intro: string;
}

function headline(outcome: RepaymentOutcome): Headline {
  if (outcome.interestFreeKept) {
    return {
      icon: { name: 'check', tone: 'green' },
      title: 'You cleared this statement.',
      intro: 'Great planning! You paid by the due date.',
    };
  }
  if (outcome.missedPayment) {
    return {
      icon: { name: 'alert', tone: 'red' },
      title: 'This payment was missed.',
      intro: `You paid less than the minimum of ${formatRand(outcome.minimumDue)}, so a late fee was added.`,
    };
  }
  return {
    icon: { name: 'alert', tone: 'amber' },
    title: 'Payment made. Some debt carries over.',
    intro: `${formatRand(outcome.remainingOwed)} is still owed and is charged interest.`,
  };
}

/** The tile-free row from the mockup's "Less room in next month's budget" line. */
function TextRow({
  icon,
  iconClassName,
  label,
  text,
}: {
  icon: IconName;
  iconClassName: string;
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white/70 px-3 py-2.5">
      <dt className="min-w-0 leading-snug text-ink">
        <Icon name={icon} className={`mr-3 inline-block size-6 align-[-0.4em] ${iconClassName}`} />
        {label}
      </dt>
      <dd className="max-w-[55%] text-right text-sm leading-snug text-ink">{text}</dd>
    </div>
  );
}

export function MonthSummaryScreen({ session }: { session: Session }) {
  const finishMonth = useGameStore((store) => store.finishMonth);
  const [showAlternate, setShowAlternate] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const alternateId = useId();
  const reviewId = useId();
  const { outcome, comparison, minimumAlternative } = requireRepayment(session);
  const { state } = session;
  const result = headline(outcome);
  const savingsUsed = monthSavingsUsed(session);

  return (
    <div className="grid items-end gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-5">
      <img
        src={characterFront}
        alt=""
        className="mx-auto h-auto w-full max-w-[13rem] self-center drop-shadow-lg max-lg:hidden"
      />
      <ScreenPanel icon={result.icon} title={result.title} intro={result.intro}>
        {outcome.shortfall > 0 && (
          <Callout tone="warning" title="You could not afford the whole payment.">
            Your spending account was {formatRand(outcome.shortfall)} short of this choice.
          </Callout>
        )}

        <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section
            aria-label="What happened"
            className="min-w-0 rounded-2xl border border-line bg-cream-card p-3 sm:p-4"
          >
            <ValueList>
              <ValueRow label="Paid" value={formatRand(outcome.paid)} icon="card" />
              <ValueRow
                label="Remaining statement balance"
                value={formatRand(outcome.remainingOwed)}
                icon="card"
                iconClassName="text-accent"
              />
              {outcome.interestCharged > 0 && (
                <ValueRow
                  label="Interest charged"
                  value={formatRand(outcome.interestCharged)}
                  icon="plus"
                  iconClassName="text-danger"
                />
              )}
              {outcome.lateFee > 0 && (
                <ValueRow
                  label="Late fee"
                  value={formatRand(outcome.lateFee)}
                  icon="calendar-x"
                  iconClassName="text-danger"
                />
              )}
              {!outcome.interestFreeKept && (
                <ValueRow
                  label="Next month opens at"
                  value={formatRand(outcome.nextOpeningBalance)}
                  emphasis
                />
              )}
              <ValueRow
                label="Spending money left"
                value={formatRand(outcome.spendingAccountAfter)}
                icon="wallet"
              />
              <ValueRow
                label="Emergency savings"
                hint="(separate)"
                value={formatRand(state.emergencySavings)}
                icon="piggy"
                iconClassName="text-info"
              />
              <ValueRow
                label="Existing commitments continue"
                value={formatRand(state.commitments)}
                unit="/ month"
                icon="shirt"
                iconClassName="text-danger"
              />
            </ValueList>
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            <section
              aria-label="Your essentials"
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 text-center"
            >
              <Icon name="shield" strokeWidth={2.5} className="size-16 text-primary" />
              <p className="text-lg font-bold leading-snug text-ink">
                {savingsUsed === 0
                  ? 'Your essentials stayed covered, and your emergency savings stayed intact.'
                  : `Your essentials stayed covered. ${formatRand(savingsUsed)} of your emergency savings paid for this month's unexpected cost.`}
              </p>
            </section>
            <Callout tone="mint" icon="info">
              {outcome.interestFreeKept
                ? 'This scenario assumes eligible purchases and that all interest-free conditions were met.'
                : `The interest-free period applies only when the full statement is paid by the due date. The ${formatRand(outcome.remainingOwed)} still owed is charged interest.`}
            </Callout>
          </div>
        </div>

        {outcome.choice !== 'MINIMUM' && (
          <InfoCard
            title="What if I paid only the minimum?"
            aside={
              <Switch
                label="View alternate outcome"
                checked={showAlternate}
                onChange={setShowAlternate}
                controls={alternateId}
              />
            }
          >
            {showAlternate && (
              <div
                id={alternateId}
                className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
              >
                <ValueList>
                  <ValueRow
                    label="Carried forward and charged interest"
                    value={formatRand(minimumAlternative.remainingOwed)}
                    icon="card"
                    iconClassName="text-warn"
                  />
                  <ValueRow
                    label="Next month would open at"
                    note={`Includes ${formatRand(minimumAlternative.interestCharged)} interest`}
                    value={formatRand(minimumAlternative.nextOpeningBalance)}
                    icon="document"
                    iconClassName="text-accent"
                  />
                  <ValueRow
                    label="Existing commitments still continue"
                    value={formatRand(state.commitments)}
                    unit="/ month"
                    icon="calendar"
                    iconClassName="text-accent"
                  />
                  <TextRow
                    icon="pie"
                    iconClassName="text-danger"
                    label="Less room in next month's budget"
                    text="More of your money would go to repayments next month."
                  />
                </ValueList>
                <Callout tone="beige" icon="alert">
                  Paying only the minimum on time avoids missing the required payment, but the{' '}
                  {formatRand(minimumAlternative.remainingOwed)} still owed is charged interest.
                </Callout>
              </div>
            )}
          </InfoCard>
        )}

        <Callout tone="mint" icon="info">
          Staying on top of payments gives you more choices and more breathing room for the next
          month.
        </Callout>

        {showReview && (
          <div id={reviewId}>
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
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Button trailingIcon="chevron-right" onClick={finishMonth}>
            {isFinalMonth(session) ? 'Take the final quiz' : 'Start the next month'}
          </Button>
          <Button
            variant="secondary"
            aria-expanded={showReview}
            aria-controls={reviewId}
            className="px-4! text-lg!"
            onClick={() => {
              setShowReview((shown) => !shown);
            }}
          >
            <span className="inline-flex items-center gap-3">
              <Icon name="document" className="size-6" />
              Review your plan
            </span>
          </Button>
        </div>

        <Disclaimer />
      </ScreenPanel>
    </div>
  );
}
