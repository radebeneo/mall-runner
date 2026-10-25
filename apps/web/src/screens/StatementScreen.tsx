import { formatDate, formatRand, formatWholePercent } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  Disclaimer,
  InfoCard,
  ScreenPanel,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import { monthLabel, requireStatement } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

export function StatementScreen({ session }: { session: Session }) {
  const viewStatement = useGameStore((store) => store.viewStatement);
  const statement = requireStatement(session);

  return (
    <ScreenPanel
      badge={`Month ${monthLabel(session)}`}
      title="Your statement is ready."
      intro={`It closed on ${formatDate(statement.closeDate)}. Please pay by ${formatDate(statement.dueDate)}.`}
    >
      <InfoCard title="Your statement">
        <ValueList>
          <ValueRow
            label="Brought forward"
            note="From last month, including any interest and fees"
            value={formatRand(statement.openingBalance)}
          />
          <ValueRow
            label="New charges"
            note="Purchases and anything else put on the card"
            value={formatRand(statement.newCharges)}
          />
          <ValueRow label="Statement balance" value={formatRand(statement.balance)} emphasis />
          <ValueRow label="Minimum due" value={formatRand(statement.minimumDue)} />
        </ValueList>
      </InfoCard>
      <InfoCard title="Key dates">
        <ValueList>
          <ValueRow label="Statement closed" value={formatDate(statement.closeDate)} />
          <ValueRow label="Payment due" value={formatDate(statement.dueDate)} />
        </ValueList>
      </InfoCard>
      <Callout tone="info" title="Two different dates.">
        The closing date ends this statement period. The due date is your deadline to pay it.
      </Callout>
      <InfoCard title="Your credit limit">
        <ValueList>
          <ValueRow label="Credit limit" value={formatRand(statement.creditLimit)} />
          <ValueRow label="Available credit" value={formatRand(statement.availableCredit)} />
          <ValueRow label="Credit used" value={formatWholePercent(statement.utilisationPercent)} />
        </ValueList>
      </InfoCard>
      {statement.overLimit && (
        <Callout tone="danger" title="You are over your credit limit.">
          Your statement balance is more than your credit limit.
        </Callout>
      )}
      <Callout tone="info" title="Credit used is a guide, not a rule.">
        It shows how much of your limit you are using. Lower is generally easier to manage.
      </Callout>
      <Button onClick={viewStatement}>Plan my payment</Button>
      <Disclaimer />
    </ScreenPanel>
  );
}
