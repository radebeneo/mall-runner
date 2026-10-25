// The unexpected expense, following art-direction/unexpected-bill-screen.png: emergency savings
// against the card (learning goal 5). Every figure comes from the finance engine via the session.
// Neither option is marked as the better one; the result appears only once the player chooses.
import { formatRand } from '@credit-runner/finance-engine';
import type {
  Cents,
  EventFunding,
  FundingSource,
  ScenarioEvent,
} from '@credit-runner/finance-engine';
import { Button, Callout, Disclaimer, Icon, OptionCard, ScreenPanel } from '@credit-runner/ui';
import type { IconName, OptionActionTone, OptionFact, TileTone } from '@credit-runner/ui';
import { useState } from 'react';
import { eventOptions, hudCardBalance, pendingEvent } from '../session/session';
import type { EventOption, Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { eventArt } from './art';
import { FUNDING_TITLES } from './labels';

/** The two ways to pay shown in the mockup. */
type ShownSource = Extract<FundingSource, 'EMERGENCY_SAVINGS' | 'CARD'>;

const SHOWN_SOURCES: readonly ShownSource[] = ['EMERGENCY_SAVINGS', 'CARD'];

const CARD_STYLES: Record<
  ShownSource,
  { icon: { name: IconName; tone: TileTone }; action: string; actionTone: OptionActionTone }
> = {
  EMERGENCY_SAVINGS: {
    icon: { name: 'piggy', tone: 'green' },
    action: 'Use savings',
    actionTone: 'green',
  },
  CARD: { icon: { name: 'card', tone: 'amber' }, action: 'Use card', actionTone: 'amber' },
};

/** "An unexpected R480\npharmacy bill." The line break sits after the amount, as in the mockup. */
function eventHeadline(event: ScenarioEvent): string {
  return `An unexpected ${formatRand(event.cost)}\n${event.title.toLowerCase()}.`;
}

/** "Savings: R500 → R20" when the amount changes, "Savings stays R500" when it does not. */
function moneyFact(label: string, before: Cents, after: Cents): string {
  return before === after
    ? `${label} stays ${formatRand(before)}`
    : `${label}: ${formatRand(before)} → ${formatRand(after)}`;
}

function tradeOff(funding: EventFunding): string {
  if (funding.fellBackToCard) {
    return `Savings cover ${formatRand(funding.fromSavings)}. The other ${formatRand(funding.toCard)} goes on the card.`;
  }
  return funding.source === 'CARD'
    ? 'A larger repayment to plan for.'
    : 'Less savings available for another surprise.';
}

function optionFacts(option: EventOption, savingsBefore: Cents, cardBefore: Cents): OptionFact[] {
  const savingsAfter = option.after.emergencySavings;
  return [
    {
      icon: savingsAfter === savingsBefore ? 'shield' : 'wallet',
      tone: 'green',
      text: moneyFact('Savings', savingsBefore, savingsAfter),
    },
    {
      icon: 'card',
      tone: 'purple',
      text: moneyFact('Card balance', cardBefore, option.cardBalanceAfter),
    },
    { icon: 'info', tone: 'purple', text: tradeOff(option.funding) },
  ];
}

function fundingResult(option: EventOption): { title: string; body: string } {
  const { funding } = option;
  if (funding.source === 'CARD') {
    return {
      title: `${formatRand(funding.toCard)} added to your card.`,
      body: 'Review your repayment plan on statement day.',
    };
  }
  if (funding.fellBackToCard) {
    return {
      title: `${formatRand(funding.fromSavings)} from savings and ${formatRand(funding.toCard)} added to your card.`,
      body: 'Review your repayment plan on statement day.',
    };
  }
  return {
    title: `${formatRand(funding.fromSavings)} paid from your emergency savings.`,
    body: `${formatRand(option.after.emergencySavings)} is left for another surprise.`,
  };
}

function EssentialsNote() {
  return (
    <p className="flex items-center gap-3 rounded-xl border border-mint-line bg-mint px-3 py-2 text-sm leading-snug text-ink">
      <Icon name="shield" strokeWidth={2.5} className="size-7 shrink-0 text-primary" />
      <span>Your essentials are already covered this month.</span>
    </p>
  );
}

export function EventScreen({ session }: { session: Session }) {
  const fundEvent = useGameStore((store) => store.fundEvent);
  const [source, setSource] = useState<ShownSource | null>(null);

  const event = pendingEvent(session);
  if (event === undefined) throw new Error('The event screen needs an unexpected expense.');
  const options = eventOptions(session, event);
  const savingsBefore = session.state.emergencySavings;
  const cardBefore = hudCardBalance(session);
  const art = eventArt(event.id);
  const chosen = options.find((option) => option.source === source);
  const result = chosen === undefined ? null : fundingResult(chosen);

  return (
    <ScreenPanel
      badge="Unexpected expense"
      badgeTone="red"
      badgeIcon="alert"
      title={eventHeadline(event)}
      intro="You need it today. How will you cover it?"
      media={
        art === undefined ? undefined : (
          <img src={art} alt="" className="w-24 object-contain sm:w-52" />
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SHOWN_SOURCES.map((shown) => {
          const option = options.find((candidate) => candidate.source === shown);
          if (option === undefined) return null;
          const style = CARD_STYLES[shown];
          return (
            <OptionCard
              key={shown}
              title={FUNDING_TITLES[shown]}
              icon={style.icon}
              facts={optionFacts(option, savingsBefore, cardBefore)}
              note={shown === 'EMERGENCY_SAVINGS' ? <EssentialsNote /> : undefined}
              actionLabel={style.action}
              actionTone={style.actionTone}
              selected={source === shown}
              locked={source !== null}
              onSelect={() => {
                setSource(shown);
              }}
            />
          );
        })}
      </div>

      {result !== null && (
        <Callout
          tone="card"
          title={result.title}
          media={
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white"
            >
              <Icon name="check" strokeWidth={3} className="size-6" />
            </span>
          }
          live
        >
          {result.body}
        </Callout>
      )}

      {source !== null && (
        <Button
          onClick={() => {
            fundEvent(source);
          }}
        >
          Continue
        </Button>
      )}

      <Disclaimer variant="mint">
        This is a learning example. Amounts and dates are fictional and for practice only.
      </Disclaimer>
    </ScreenPanel>
  );
}
