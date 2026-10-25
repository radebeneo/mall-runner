import { formatPoints, formatRand } from '@credit-runner/finance-engine';
import {
  Button,
  Callout,
  Disclaimer,
  Icon,
  IconTile,
  InfoCard,
  ScreenPanel,
  ValueList,
  ValueRow,
} from '@credit-runner/ui';
import type { IconName, TileTone } from '@credit-runner/ui';
import { useId, useState } from 'react';
import characterFront from '../assets/art/character-front.png';
import { QUIZ_QUESTIONS, fillQuizText } from '../content/quiz';
import type { QuizDates, QuizQuestion } from '../content/quiz';
import { isRunFinished, quizAnswerFor, quizDates, runSummary } from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

// The final quiz and the run summary on one screen, as in finish-with-understanding-screen.png.
// Each question locks once answered and only then reveals which answer was right.

const DATES_QUESTION_ID = 'closing-vs-due';

interface QuestionCardProps {
  session: Session;
  question: QuizQuestion;
  number: number;
  dates: QuizDates;
}

function QuestionCard({ session, question, number, dates }: QuestionCardProps) {
  const answerQuiz = useGameStore((store) => store.answerQuiz);
  const [chosen, setChosen] = useState<string | null>(null);
  const promptId = useId();
  const answer = quizAnswerFor(session, question.id);
  const answered = answer !== undefined;

  return (
    <section
      aria-labelledby={promptId}
      className="rounded-2xl border border-line bg-cream-card p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white"
        >
          {number}
        </span>
        <h2 id={promptId} className="pt-1 text-lg font-bold leading-snug text-ink">
          <span className="sr-only">Question {number}: </span>
          {question.prompt}
        </h2>
      </div>

      <div
        role="group"
        aria-labelledby={promptId}
        className={`mt-3 grid gap-2.5 ${question.layout === 'pair' ? 'sm:grid-cols-2' : ''}`}
      >
        {question.options.map((option) => {
          const isChosen = option.id === chosen;
          const showCorrect = answered && option.id === question.correctOptionId;
          const showWrong = answered && isChosen && !showCorrect;
          const border = showCorrect
            ? 'border-primary'
            : showWrong
              ? 'border-danger'
              : 'border-line';
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isChosen}
              // aria-disabled rather than disabled, so focus stays on the chosen answer.
              aria-disabled={answered}
              onClick={() => {
                if (answered) return;
                setChosen(option.id);
                answerQuiz(question.id, option.id);
              }}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-white/80 px-3 py-2.5 text-left text-ink transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-default ${answered ? '' : 'hover:border-primary/60'} ${border}`}
            >
              <span
                aria-hidden="true"
                className="size-7 shrink-0 rounded-full border-2 border-ink-muted/40 bg-white"
              />
              <span className="min-w-0 flex-1 text-sm leading-snug sm:text-base">
                <span className={`block ${isChosen ? 'font-bold' : ''}`}>
                  {fillQuizText(option.text, dates)}
                </span>
                {option.detail !== undefined && <span className="block"> {option.detail}</span>}
                {showCorrect && <span className="sr-only"> (correct answer)</span>}
                {showWrong && <span className="sr-only"> (your answer, not correct)</span>}
              </span>
              {showCorrect && (
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                >
                  <Icon name="check" strokeWidth={3.5} className="size-5" />
                </span>
              )}
              {showWrong && (
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger text-white"
                >
                  <Icon name="close" strokeWidth={3.5} className="size-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answer !== undefined && (
        <p role="status" className="mt-3 text-sm leading-relaxed text-ink">
          <span className="font-bold">{answer.correct ? 'Correct. ' : 'Not quite. '}</span>
          {fillQuizText(question.explanation, dates)}
        </p>
      )}
    </section>
  );
}

function DateStop({ date, label, note }: { date: string; label: string; note: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon name="calendar" className="size-8 shrink-0 text-ink" />
      <div className="text-sm leading-snug text-ink">
        <p className="font-bold">{date}</p>
        <p>{label}</p>
        <p>{note}</p>
      </div>
    </div>
  );
}

/** "Statement date vs payment due date". Its facts appear once the dates question is answered. */
function DatesCard({ dates, revealed }: { dates: QuizDates; revealed: boolean }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-cream-card p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-2xl font-bold text-white"
        >
          i
        </span>
        <h2 id={headingId} className="text-lg font-bold leading-snug text-ink">
          <span className="block">Statement date</span>{' '}
          <span className="block">vs payment due date</span>
        </h2>
      </div>
      {revealed ? (
        <div className="flex flex-col gap-4">
          <DateStop
            date={dates.statementCloses}
            label="Statement closes"
            note="(end of billing period)"
          />
          <Icon name="arrow-down" strokeWidth={2.5} className="ml-2 size-5 text-ink" />
          <DateStop date={dates.paymentDue} label="Payment due" note="(deadline for payment)" />
          <p className="text-sm leading-relaxed text-ink">
            Your statement records purchases up to {dates.statementCloses}. Payment is due by{' '}
            {dates.paymentDue}.
          </p>
          <Callout
            tone="mint"
            media={
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white"
              >
                <Icon name="star" className="size-4" />
              </span>
            }
          >
            These dates are examples in an accelerated simulation.
          </Callout>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-ink-muted">
          Answer the question about the payment deadline to see how the two dates fit together.
        </p>
      )}
    </section>
  );
}

const PRACTISED: readonly { icon: IconName; tone: TileTone; title: string; text: string }[] = [
  {
    icon: 'tag',
    tone: 'green',
    title: 'Checked a commitment’s total cost',
    text: 'Looked beyond the monthly price.',
  },
  {
    icon: 'piggy',
    tone: 'amber',
    title: 'Compared savings with borrowing',
    text: 'Weighed up the trade-offs for you.',
  },
  {
    icon: 'calendar',
    tone: 'purple',
    title: 'Planned a payment before the due date',
    text: 'Gave yourself control over the outcome.',
  },
];

function PractisedStrip() {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-line bg-cream-deep p-4"
    >
      <h2 id={headingId} className="text-lg font-bold text-ink">
        What you practised
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line">
        {PRACTISED.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 sm:px-3 sm:first:pl-0 sm:last:pr-0"
          >
            <IconTile name={item.icon} tone={item.tone} size="sm" shape="round" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-snug text-ink">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function outOf(count: number, total: number): string {
  return `${String(count)} of ${String(total)}`;
}

/** "Explore credit costs and terms": the run's figures, all from the finance engine. */
function RunFigures({ session }: { session: Session }) {
  const summary = runSummary(session);
  return (
    <div className="grid gap-3 md:grid-cols-2">
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
    </div>
  );
}

export function FinishScreen({ session }: { session: Session }) {
  const start = useGameStore((store) => store.start);
  const [showFigures, setShowFigures] = useState(false);
  const figuresId = useId();
  const dates = quizDates(session);
  const finished = isRunFinished(session);
  const datesRevealed = quizAnswerFor(session, DATES_QUESTION_ID) !== undefined;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-5">
      <img
        src={characterFront}
        alt=""
        className="mx-auto h-auto w-full max-w-[13rem] drop-shadow-lg max-lg:hidden lg:sticky lg:top-6"
      />
      <ScreenPanel
        icon={{ name: 'star', tone: 'green', round: true }}
        title={'The run ends.\nThe learning stays.'}
        intro={
          <p>
            <span className="block">You finished month {session.cycle.months}.</span>{' '}
            <span className="block">Let’s check what you understand.</span>
          </p>
        }
      >
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            {QUIZ_QUESTIONS.map((question, index) => (
              <QuestionCard
                key={question.id}
                session={session}
                question={question}
                number={index + 1}
                dates={dates}
              />
            ))}
          </div>
          <div className="min-w-0 md:sticky md:top-4">
            <DatesCard dates={dates} revealed={datesRevealed} />
          </div>
        </div>

        <PractisedStrip />

        {finished ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              trailingIcon="chevron-right"
              onClick={() => {
                // Replays in the same mode as this run.
                start();
              }}
            >
              Try another scenario
            </Button>
            <Button
              variant="secondary"
              aria-expanded={showFigures}
              aria-controls={figuresId}
              className="px-4! text-lg!"
              onClick={() => {
                setShowFigures((shown) => !shown);
              }}
            >
              <span className="inline-flex items-center gap-3">
                <Icon name="book" className="size-6" />
                Explore credit costs and terms
              </span>
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-ink-muted">
            Answer all {QUIZ_QUESTIONS.length} questions to finish the run.
          </p>
        )}

        {finished && showFigures && (
          <div id={figuresId}>
            <RunFigures session={session} />
          </div>
        )}

        <Disclaimer variant="mint">
          This is a learning experience, not financial advice. Products, terms and amounts are
          fictional and for practice only.
        </Disclaimer>
      </ScreenPanel>
    </div>
  );
}
