// RUNNING in decisions-only mode: the month's mall trip is planned for the player. There is no
// mockup for this screen, so it reuses the statement mockup's pieces: icon rows, the lavender
// date strip and the rail-style side cards. Every figure comes from the session and engine.
import { formatDate, formatRand } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  DateTimeline,
  Disclaimer,
  InfoCard,
  ScreenPanel,
  SideCard,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import {
  currentStatementDates,
  hudCardBalance,
  monthLabel,
  monthPurchases,
  pendingOffer,
} from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

export function MonthScreen({ session }: { session: Session }) {
  const openOffer = useGameStore((store) => store.openOffer);
  const endMonthRun = useGameStore((store) => store.endMonthRun);
  const { state } = session;
  const purchases = monthPurchases(session);
  const offer = pendingOffer(session);
  const dates = currentStatementDates(session);

  return (
    <ScreenPanel
      badge={`Month ${monthLabel(session)}`}
      icon={{ name: 'bag', tone: 'green' }}
      title="Shopping at the mall"
      intro="In decisions-only mode your mall trip is planned for you. These purchases go on your card."
    >
      {session.budgetShortfall > 0 && (
        <Callout tone="danger" icon="alert" title="Your budget came up short.">
          This month's money could not cover {formatRand(session.budgetShortfall)} of your fixed
          commitments.
        </Callout>
      )}

      <InfoCard title="Card purchases this month">
        <ValueList>
          {purchases.map((purchase) => (
            <ValueRow
              key={purchase.id}
              label={purchase.label}
              value={formatRand(purchase.amount)}
              icon="bag"
              iconClassName="text-primary"
            />
          ))}
          <ValueRow
            label="Card balance so far"
            value={formatRand(hudCardBalance(session))}
            emphasis
          />
        </ValueList>
      </InfoCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <SideCard
          title="Spending account"
          icon="wallet"
          tone="green"
          value={formatRand(state.spendingAccount)}
        />
        <SideCard
          title="Emergency savings"
          icon="piggy"
          tone="blue"
          value={formatRand(state.emergencySavings)}
        />
        <SideCard
          title="Fixed commitments"
          icon="calendar"
          tone="purple"
          value={formatRand(state.commitments)}
        />
      </div>

      <DateTimeline
        from={{ date: formatDate(dates.closes), label: 'Statement closes' }}
        to={{ date: formatDate(dates.due), label: 'Payment due' }}
      />

      {offer !== undefined && (
        <Callout tone="beige" icon="tag" title="You spotted a glowing shopping bag.">
          It holds an instalment offer. Take a look before you finish shopping.
        </Callout>
      )}

      {offer !== undefined ? (
        <Button onClick={openOffer}>See the offer</Button>
      ) : (
        <Button onClick={endMonthRun}>Finish shopping</Button>
      )}

      <Disclaimer variant="mint" />
    </ScreenPanel>
  );
}
