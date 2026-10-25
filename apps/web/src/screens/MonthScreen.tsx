import { formatDate, formatRand } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  Disclaimer,
  InfoCard,
  ScreenPanel,
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

/** RUNNING in decisions-only mode: the month's mall trip is planned for the player. */
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
      title="Shopping at the mall"
      intro="In decisions-only mode your mall trip is planned for you. These purchases go on your card."
    >
      {session.budgetShortfall > 0 && (
        <Callout tone="danger" title="Your budget came up short.">
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
            />
          ))}
          <ValueRow
            label="Card balance so far"
            value={formatRand(hudCardBalance(session))}
            emphasis
          />
        </ValueList>
      </InfoCard>
      <InfoCard title="Your money">
        <ValueList>
          <ValueRow label="Spending account" value={formatRand(state.spendingAccount)} />
          <ValueRow label="Emergency savings" value={formatRand(state.emergencySavings)} />
          <ValueRow label="Fixed monthly commitments" value={formatRand(state.commitments)} />
        </ValueList>
      </InfoCard>
      <Callout tone="info" title="Key dates">
        This statement closes on {formatDate(dates.closes)}. Payment is due by{' '}
        {formatDate(dates.due)}.
      </Callout>
      {offer !== undefined && (
        <Callout tone="warning" title="You spotted a glowing shopping bag.">
          It holds an instalment offer. Take a look before you finish shopping.
        </Callout>
      )}
      {offer !== undefined ? (
        <Button onClick={openOffer}>See the offer</Button>
      ) : (
        <Button onClick={endMonthRun}>Finish shopping</Button>
      )}
      <Disclaimer />
    </ScreenPanel>
  );
}
