import { formatPoints, formatRand } from '@credit-runner/finance-engine';
import { Button, Disclaimer, InfoCard, ScreenPanel, ValueList, ValueRow } from '@credit-runner/ui';
import { runSummary } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

function outOf(count: number, total: number): string {
  return `${String(count)} of ${String(total)}`;
}

export function RunSummaryScreen({ session }: { session: Session }) {
  const start = useGameStore((store) => store.start);
  const summary = runSummary(session);

  return (
    <ScreenPanel
      badge="Run complete"
      title="Finish with understanding."
      intro={`${session.scenario.title}: here is how your three decisions a month added up.`}
    >
      <InfoCard title="Your card repayments">
        <ValueList>
          <ValueRow
            label="Statements paid in full"
            value={outOf(summary.statementsPaidInFull, summary.statements)}
          />
          <ValueRow label="Missed payments" value={String(summary.missedPayments)} />
          <ValueRow label="Total repaid" value={formatRand(summary.totalRepaid)} />
          <ValueRow label="Interest charged" value={formatRand(summary.interestCharged)} />
          <ValueRow label="Late fees" value={formatRand(summary.lateFees)} />
          <ValueRow
            label="Card balance now"
            value={formatRand(session.state.cardBalance)}
            emphasis
          />
        </ValueList>
      </InfoCard>
      <InfoCard title="Unexpected expenses">
        <ValueList>
          <ValueRow label="Total cost" value={formatRand(summary.unexpectedCosts)} />
          <ValueRow label="Paid from savings" value={formatRand(summary.paidFromSavings)} />
          <ValueRow
            label="Paid from spending account"
            value={formatRand(summary.paidFromSpending)}
          />
          <ValueRow label="Put on the card" value={formatRand(summary.putOnCard)} />
        </ValueList>
      </InfoCard>
      <InfoCard title="Instalment offers">
        <ValueList>
          <ValueRow label="Accepted" value={String(summary.offersAccepted)} />
          <ValueRow label="Declined" value={String(summary.offersDeclined)} />
          <ValueRow
            label="New monthly commitments"
            value={formatRand(summary.newMonthlyCommitments)}
          />
          <ValueRow
            label="Total payable on accepted offers"
            value={formatRand(summary.totalPayableAccepted)}
          />
        </ValueList>
      </InfoCard>
      <InfoCard title="Quiz and points">
        <ValueList>
          <ValueRow label="Correct answers" value={outOf(summary.quizCorrect, summary.quizTotal)} />
          <ValueRow label="Points" value={formatPoints(session.state.points)} emphasis />
        </ValueList>
      </InfoCard>
      <Button onClick={start}>Play again</Button>
      <Disclaimer />
    </ScreenPanel>
  );
}
