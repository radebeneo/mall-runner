import { formatDate, formatRand, formatWholePercent } from '@credit-runner/finance-engine';
import type { StatementLine } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  DateTimeline,
  Disclaimer,
  Disclosure,
  InfoCard,
  ScreenPanel,
  UsageRing,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { IconName } from '@credit-runner/ui';
import characterPortrait from '../assets/art/character-portrait.png';
import { requireStatement, statementLines } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';
import { EssentialsCard, RailLayout, SavingsCard } from './rail';

const LINE_ICONS: Record<StatementLine['kind'], { icon: IconName; className: string }> = {
  BROUGHT_FORWARD: { icon: 'document', className: 'text-accent' },
  PURCHASE: { icon: 'bag', className: 'text-primary' },
  CHARGE: { icon: 'plus', className: 'text-primary' },
  OTHER: { icon: 'info', className: 'text-info' },
};

function StatementRail({ session }: { session: Session }) {
  return (
    <div className="flex flex-col gap-3">
      <img
        src={characterPortrait}
        alt=""
        className="mx-auto h-auto w-full max-w-[13.5rem] drop-shadow-lg max-lg:hidden"
      />
      <EssentialsCard session={session} />
      <SavingsCard session={session} />
      <Disclaimer variant="card" title="This is a fictional learning scenario">
        Amounts and dates are for practice only. They are not a real product or financial advice.
      </Disclaimer>
    </div>
  );
}

export function StatementScreen({ session }: { session: Session }) {
  const viewStatement = useGameStore((store) => store.viewStatement);
  const statement = requireStatement(session);
  const { state } = session;
  const closes = formatDate(statement.closeDate);
  const due = formatDate(statement.dueDate);
  const used = formatWholePercent(statement.utilisationPercent);

  return (
    <RailLayout rail={<StatementRail session={session} />}>
      <ScreenPanel
        icon={{ name: 'document', tone: 'purple' }}
        title={'Statement ready.\nPayment comes next.'}
        intro={
          <span>
            This statement covers purchases up to {closes}.
            <br />
            Please pay by {due}.
          </span>
        }
      >
        <DateTimeline
          from={{ date: closes, label: 'Statement closes' }}
          to={{ date: due, label: 'Payment due' }}
          caption="This is an accelerated simulation for learning purposes."
        />

        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <InfoCard title="Your statement">
            <ValueList>
              {statementLines(session).map((line) => (
                <ValueRow
                  key={line.id}
                  label={line.label}
                  value={formatRand(line.amount)}
                  icon={LINE_ICONS[line.kind].icon}
                  iconClassName={LINE_ICONS[line.kind].className}
                />
              ))}
              <ValueRow label="Statement balance" value={formatRand(statement.balance)} emphasis />
              <ValueRow
                label="Example minimum due (illustrative)"
                value={formatRand(statement.minimumDue)}
                icon="info"
                tone="mint"
              />
            </ValueList>
            <Callout tone="beige" icon="info">
              This minimum is an example for learning only. Paying the minimum is not the same as
              missing a payment.
            </Callout>
            <ValueList>
              <ValueRow
                label="Payment due"
                value={due}
                icon="calendar"
                iconClassName="text-accent"
              />
            </ValueList>
          </InfoCard>

          <div className="flex min-w-0 flex-col gap-3">
            <InfoCard title="Your money summary">
              <ValueList>
                <ValueRow
                  label="After essentials"
                  value={formatRand(state.monthlyAfterEssentials)}
                  icon="wallet"
                />
                <ValueRow
                  label="Existing commitments"
                  value={`−${formatRand(state.commitments)}`}
                  icon="shirt"
                  iconClassName="text-danger"
                />
                <ValueRow
                  label="Available for repayment and other spending"
                  value={formatRand(state.spendingAccount)}
                  emphasis
                />
                <ValueRow
                  label="Emergency savings (separate)"
                  value={formatRand(state.emergencySavings)}
                  icon="piggy"
                />
              </ValueList>
            </InfoCard>

            <Disclosure title="About your card use" icon={null} tone="mint" defaultOpen>
              <div className="flex items-center gap-4">
                <UsageRing fraction={statement.utilisation} label={used} />
                <p>
                  You've used about {used} of your {formatRand(statement.creditLimit)} credit limit.
                  <span className="mt-1 block text-ink-muted">
                    Use this as a guide, not a rule.
                  </span>
                </p>
              </div>
            </Disclosure>
          </div>
        </div>

        {statement.overLimit && (
          <Callout tone="danger" title="You are over your credit limit." icon="info">
            Your statement balance is more than your credit limit.
          </Callout>
        )}

        <Disclosure
          title="What's next?"
          summary={`Your statement records the billing period. Your payment due date is the deadline for payment. Plan how much to pay by ${due}.`}
        >
          The statement closed on {closes}, so purchases after that date go on next month's
          statement. You have until {due} to pay this one.
        </Disclosure>

        <Button trailingIcon="chevron-right" onClick={viewStatement}>
          Plan my payment
        </Button>
      </ScreenPanel>
    </RailLayout>
  );
}
