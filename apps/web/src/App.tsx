import { formatPoints, formatRand, formatShortDate } from '@credit-runner/finance-engine';
import { Hud } from '@credit-runner/ui';
import { EventScreen } from './screens/EventScreen';
import { MonthScreen } from './screens/MonthScreen';
import { MonthSummaryScreen } from './screens/MonthSummaryScreen';
import { OfferScreen } from './screens/OfferScreen';
import { PayPlanScreen } from './screens/PayPlanScreen';
import { QuizScreen } from './screens/QuizScreen';
import { RunSummaryScreen } from './screens/RunSummaryScreen';
import { StatementScreen } from './screens/StatementScreen';
import { TitleScreen } from './screens/TitleScreen';
import { currentStatementDates, hudCardBalance, monthLabel, screenKey } from './session/session';
import type { Session } from './session/session';
import { useGameStore } from './store/game-store';

function GameHud({ session }: { session: Session }) {
  const dates = currentStatementDates(session);
  return (
    <Hud
      month={monthLabel(session)}
      cardBalance={formatRand(hudCardBalance(session))}
      points={formatPoints(session.state.points)}
      statementCloses={formatShortDate(dates.closes)}
      paymentDue={formatShortDate(dates.due)}
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
      return <QuizScreen session={session} />;
    case 'RUN_SUMMARY':
      return <RunSummaryScreen session={session} />;
  }
}

// Decisions-only mode (milestone 4). The runner arrives in milestone 5.
export function App() {
  const session = useGameStore((store) => store.session);

  return (
    <div className="min-h-dvh">
      {session !== null && <GameHud session={session} />}
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        {session === null ? (
          <TitleScreen />
        ) : (
          <PhaseScreen key={screenKey(session)} session={session} />
        )}
      </main>
    </div>
  );
}
