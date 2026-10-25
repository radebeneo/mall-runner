// The instalment offer, following art-direction/check-offer-screen.png. Every figure comes from
// the finance engine's evaluateOffer via the session; this screen only formats it. No option is
// marked as the better one, and the result banner appears only after the player confirms.
import { formatRand } from '@credit-runner/finance-engine';
import type { OfferImpact, ScenarioOffer } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  ChoiceGroup,
  CoinIcon,
  Disclaimer,
  Icon,
  IconTile,
  InfoCard,
  ScreenPanel,
  ToggleTile,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { IconName, Tone } from '@credit-runner/ui';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import {
  commitmentsNote,
  isFinalMonth,
  offerImpact,
  offerShortfall,
  pendingOffer,
} from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { offerArt } from './art';

type OfferChoice = 'ACCEPT' | 'DECLINE';

interface OfferResult {
  tone: Tone;
  title: string;
  body: string;
  icon?: IconName;
}

function offerResult(session: Session, accepted: boolean, impact: OfferImpact): OfferResult {
  const monthly = formatRand(impact.monthlyCost);
  if (!accepted) {
    return {
      tone: 'solid',
      title: `You kept ${monthly} a month available.`,
      body: isFinalMonth(session)
        ? 'Would the purchase still fit your budget later?'
        : 'Would the purchase still fit next month?',
    };
  }
  const shortfall = offerShortfall(impact);
  if (shortfall > 0) {
    return {
      tone: 'danger',
      icon: 'alert',
      title: `This offer is ${formatRand(shortfall)} a month more than your budget.`,
      body: `Your commitments are now ${formatRand(impact.commitmentsAfter)} a month, more than the ${formatRand(session.state.monthlyAfterEssentials)} you have after essentials.`,
    };
  }
  const title = `You added ${monthly} a month for ${String(impact.termMonths)} months.`;
  const leaves = `That leaves ${formatRand(impact.budgetRemaining)} before card repayments and other spending.`;
  if (impact.extraCostVsCash > 0) {
    return {
      tone: 'warning',
      icon: 'alert',
      title,
      body: `${leaves} In total you will pay ${formatRand(impact.totalPayable)}, which is ${formatRand(impact.extraCostVsCash)} more than the cash price.`,
    };
  }
  return {
    tone: 'card',
    icon: 'check',
    title,
    body: `${leaves} In total you will pay ${formatRand(impact.totalPayable)}.`,
  };
}

/** The last line on the product card: what the offer costs on top of the cash price. */
function chargesNote(offer: ScenarioOffer, impact: OfferImpact): string {
  const cash = formatRand(offer.cashPrice);
  if (impact.totalFees > 0) {
    return `Includes ${formatRand(impact.totalFees)} in fees: ${formatRand(impact.extraCostVsCash)} more than the cash price of ${cash}`;
  }
  if (impact.extraCostVsCash > 0) {
    return `${formatRand(impact.extraCostVsCash)} more than the cash price of ${cash}`;
  }
  return 'No additional charges in this fictional offer';
}

/** The round purple "i" from the mockup. */
function InfoDot() {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-sm font-bold text-white"
    >
      i
    </span>
  );
}

function OfferFact({ icon, children }: { icon: IconName | null; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      {icon === null ? <InfoDot /> : <Icon name={icon} className="size-6 shrink-0 text-accent" />}
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function BudgetRow({
  label,
  note,
  value,
  divided = false,
}: {
  label: string;
  note?: string | undefined;
  value: string;
  divided?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${divided ? 'border-t border-dashed border-ink/25 pt-3' : ''}`}
    >
      <dt className="text-sm leading-snug text-ink">
        {label}
        {note !== undefined && <span className="block">({note})</span>}
      </dt>
      <dd className="shrink-0 text-right leading-tight">
        <span className="block text-lg font-extrabold tabular-nums text-ink">{value}</span>
        <span aria-hidden="true" className="block text-xs text-ink-muted">
          /month
        </span>
        <span className="sr-only"> a month</span>
      </dd>
    </div>
  );
}

export function OfferScreen({ session }: { session: Session }) {
  const decideOffer = useGameStore((store) => store.decideOffer);
  const [choice, setChoice] = useState<OfferChoice | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [comparing, setComparing] = useState(false);
  const id = useId();
  const compareId = `${id}-compare`;

  const offer = pendingOffer(session);
  if (offer === undefined) throw new Error('The offer screen needs an offer.');
  const impact = offerImpact(session, offer);
  const shortfall = offerShortfall(impact);
  const note = commitmentsNote(session);
  const art = offerArt(offer.id);
  const result =
    confirmed && choice !== null ? offerResult(session, choice === 'ACCEPT', impact) : null;
  const term = String(impact.termMonths);

  return (
    <ScreenPanel
      badge="Check the offer"
      badgeIcon="tag"
      title={'Small monthly payment.\nLonger commitment.'}
      intro="Take a moment to check how this fits your budget."
      // Closing keeps the budget as it is, unless the player has already confirmed taking it.
      onClose={() => {
        decideOffer(confirmed && choice === 'ACCEPT');
      }}
      closeLabel="Close offer"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section
          aria-labelledby={`${id}-product`}
          className="flex min-w-0 gap-4 rounded-2xl border border-line bg-cream-card p-3 sm:p-4"
        >
          {art === undefined ? (
            <IconTile name="bag" tone="purple" size="lg" />
          ) : (
            <img
              src={art}
              alt=""
              className="aspect-[3/4] w-28 shrink-0 rounded-xl object-cover sm:w-36"
            />
          )}
          <div className="min-w-0">
            <h2
              id={`${id}-product`}
              className="text-lg font-bold leading-tight text-ink sm:text-xl"
            >
              {offer.title}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-snug text-ink sm:text-base">
              <OfferFact icon="calendar">
                <strong className="font-extrabold">{formatRand(impact.monthlyCost)}</strong> per
                month
              </OfferFact>
              <OfferFact icon="calendar">
                <strong className="font-extrabold">{term}</strong> payments
              </OfferFact>
              <OfferFact icon="card">
                Total payable in this example:{' '}
                <span className="font-bold">{formatRand(impact.totalPayable)}</span>
              </OfferFact>
              <OfferFact icon={null}>{chargesNote(offer, impact)}</OfferFact>
            </ul>
          </div>
        </section>

        <section
          aria-labelledby={`${id}-budget`}
          className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-cream-deep/60 p-3 sm:p-4"
        >
          <div className="flex items-center gap-3">
            <IconTile name="calculator" tone="green" size="sm" />
            <h2 id={`${id}-budget`} className="text-lg font-bold leading-tight text-ink">
              Your budget impact
            </h2>
          </div>
          <dl className="flex flex-col gap-3">
            <BudgetRow
              label="Existing commitments"
              note={note}
              value={formatRand(impact.commitmentsBefore)}
            />
            <BudgetRow
              label="With this new offer"
              value={formatRand(impact.commitmentsAfter)}
              divided
            />
          </dl>
          <p
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm leading-snug text-ink ${
              shortfall > 0 ? 'border-danger/40 bg-danger-soft' : 'border-mint-line bg-mint'
            }`}
          >
            <IconTile name="wallet" tone={shortfall > 0 ? 'red' : 'green'} size="sm" />
            <span>
              {shortfall > 0
                ? `That is ${formatRand(shortfall)} a month more than you have after essentials.`
                : `That leaves ${formatRand(impact.budgetRemaining)} before card repayments and other spending.`}
            </span>
          </p>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 sm:col-span-2">
          <ChoiceGroup<OfferChoice>
            legend="What will you do?"
            legendHidden
            layout="tiles"
            selected={choice}
            onChange={setChoice}
            disabled={confirmed}
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
          />
        </div>
        <ToggleTile
          title="Compare the commitment"
          description="See how it affects your next few months."
          icon={{ name: 'scale', tone: 'purple' }}
          expanded={comparing}
          controls={compareId}
          onToggle={() => {
            setComparing((open) => !open);
          }}
        />
      </div>

      <div id={compareId} hidden={!comparing}>
        <InfoCard title="Your next few months">
          <ValueList>
            <ValueRow
              label="Left each month without it"
              note="Before card repayments"
              value={formatRand(impact.budgetBefore)}
            />
            <ValueRow
              label="Left each month with it"
              note={`For ${term} months, before card repayments`}
              value={
                shortfall > 0
                  ? `${formatRand(shortfall)} short`
                  : formatRand(impact.budgetRemaining)
              }
            />
            <ValueRow label="Cash price today" value={formatRand(offer.cashPrice)} />
            <ValueRow
              label="Total payable"
              note={`${term} payments, including any fees`}
              value={formatRand(impact.totalPayable)}
              emphasis
            />
          </ValueList>
        </InfoCard>
      </div>

      {result !== null && (
        <Callout
          tone={result.tone}
          title={result.title}
          icon={result.icon}
          media={
            result.tone === 'solid' ? (
              <span aria-hidden="true" className="shrink-0">
                <CoinIcon className="size-12" />
              </span>
            ) : undefined
          }
          live
        >
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

      <Disclaimer variant="plain">This is a fictional offer for learning purposes only.</Disclaimer>
    </ScreenPanel>
  );
}
