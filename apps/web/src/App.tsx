import { formatPoints, formatRand, formatShortDate } from '@credit-runner/finance-engine';
import { Hud } from '@credit-runner/ui';
import { EventScreen } from './screens/EventScreen';
import { FinishScreen } from './screens/FinishScreen';
import { MonthScreen } from './screens/MonthScreen';
import { MonthSummaryScreen } from './screens/MonthSummaryScreen';
import { OfferScreen } from './screens/OfferScreen';
import { PayPlanScreen } from './screens/PayPlanScreen';
import { RunScreen } from './screens/RunScreen';
import { StatementScreen } from './screens/StatementScreen';
import { TitleScreen } from './screens/TitleScreen';
import {
  currentStatementDates,
  hudCardBalance,
  hudTimelineProgress,
  monthShortLabel,
  screenKey,
} from './session/session';
import type { Session } from './session/session';
import { useGameStore } from './store/game-store';

function GameHud({ session }: { session: Session }) {
  const dates = currentStatementDates(session);
  const { phase } = session.cycle;
  // All three months are played once the quiz opens, as on the finish mockup.
  const complete = phase === 'FINAL_QUIZ' || phase === 'RUN_SUMMARY';
  return (
    <Hud
      variant="bar"
      month={monthShortLabel(session)}
      monthNote={complete ? 'Completed' : undefined}
      complete={complete}
      cardBalance={formatRand(hudCardBalance(session))}
      points={formatPoints(session.state.points)}
      statementCloses={formatShortDate(dates.closes)}
      paymentDue={formatShortDate(dates.due)}
      progress={hudTimelineProgress(session)}
    />
  );
}

/** One screen per month-cycle phase (AGENTS.md section 3). */
function PhaseScreen({ session }: { session: Session }) {
  switch (session.cycle.phase) {
    case 'RUNNING':
      return <MonthScreen session={session} />;
    case 'OFFER_CHECK':
      return <OfferScreen session={session} />;
    case 'EVENT':
      return <EventScreen session={session} />;
    case 'STATEMENT_READY':
      return <StatementScreen session={session} />;
    case 'PLAN_PAYMENT':
      return <PayPlanScreen session={session} />;
    case 'MONTH_SUMMARY':
      return <MonthSummaryScreen session={session} />;
    case 'FINAL_QUIZ':
    case 'RUN_SUMMARY':
      return <FinishScreen session={session} />;
  }
}

/**
 * How wide each screen is, as in its mockup: the statement and pay plan carry a left-hand rail,
 * the offer and unexpected bill use a wide panel, and the rest a narrow one.
 */
function panelWidth(session: Session): string {
  switch (session.cycle.phase) {
    case 'STATEMENT_READY':
    case 'PLAN_PAYMENT':
    case 'MONTH_SUMMARY':
    case 'FINAL_QUIZ':
    case 'RUN_SUMMARY':
      return '';
    case 'OFFER_CHECK':
    case 'EVENT':
      return 'mx-auto max-w-3xl';
    case 'RUNNING':
      return 'mx-auto max-w-xl';
  }
}

export function App() {
  const session = useGameStore((store) => store.session);
  const mode = useGameStore((store) => store.mode);

  // Runner mode: the 3D mall takes the whole screen while the month's shopping runs. In
  // decisions-only mode the month screen stands in for it.
  if (session !== null && mode === 'RUNNER' && session.cycle.phase === 'RUNNING') {
    return <RunScreen key={screenKey(session)} session={session} />;
  }

  return (
    <div className="min-h-dvh pb-8">
      {session !== null && <GameHud session={session} />}
      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
        {session === null ? (
          <div className="mx-auto max-w-xl">
            <TitleScreen />
          </div>
        ) : (
          <div className={panelWidth(session)}>
            <PhaseScreen key={screenKey(session)} session={session} />
          </div>
        )}
      </main>
    </div>
  );
}
