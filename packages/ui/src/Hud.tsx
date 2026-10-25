import type { ReactNode } from 'react';
import { CoinIcon, Icon } from './Icon';

/**
 * - `gameplay`: the runner HUD, with stacked pills and a wide timeline carrying the avatar.
 * - `bar`: the decision-screen HUD, one row of pills with a "Towards statement day" bar.
 */
export type HudVariant = 'gameplay' | 'bar';

export interface HudProps {
  /** e.g. "2/3". Shown after the word "Month". */
  month: string;
  /** A line under the month, e.g. "Completed". */
  monthNote?: string;
  /**
   * The run is over: the bar layout's timeline fills and reads "Simulation complete" in place
   * of the statement dates, as on the finish mockup.
   */
  complete?: boolean;
  /** e.g. "R760". */
  cardBalance: string;
  /** e.g. "1240 pts". Never formatted like money. */
  points: string;
  /** e.g. "30 Sep". */
  statementCloses: string;
  /** e.g. "25 Oct". */
  paymentDue: string;
  /** Position on the timeline: 0 at statement close, 1 at payment due. */
  progress?: number;
  /** Image URL of the runner avatar that rides along the gameplay timeline. */
  avatarSrc?: string;
  /** Shows the pause button when given, e.g. while the runner is playing. */
  onPause?: () => void;
  variant?: HudVariant;
}

const PILL = 'rounded-2xl border border-white/15 bg-hud/90 text-white shadow-pill backdrop-blur-sm';

function toPosition(progress: number): string {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return `${String(Math.round(clamped * 100))}%`;
}

function StatPill({
  icon,
  label,
  value,
  inline = false,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** Label and value on one line, as in "Month 2/3". */
  inline?: boolean;
  /** A quieter line under the value, e.g. "Completed". */
  note?: string;
}) {
  return (
    <div className={`${PILL} flex min-w-0 items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5`}>
      <span className="shrink-0 max-sm:hidden">{icon}</span>
      <div className="min-w-0">
        <dl
          className={
            inline
              ? 'flex min-w-0 items-baseline gap-1.5 text-base font-extrabold sm:text-xl'
              : 'min-w-0'
          }
        >
          <dt className={inline ? '' : 'truncate text-xs text-white/85 sm:text-sm'}>{label}</dt>
          <dd
            className={`truncate tabular-nums ${inline ? '' : 'text-lg font-extrabold leading-tight sm:text-xl'}`}
          >
            {value}
          </dd>
        </dl>
        {note !== undefined && (
          <p className="truncate text-xs leading-tight text-white/85 sm:text-sm">{note}</p>
        )}
      </div>
    </div>
  );
}

function PauseButton({ onPause, className }: { onPause: () => void; className: string }) {
  return (
    <button
      type="button"
      aria-label="Pause"
      onClick={onPause}
      className={`${PILL} flex shrink-0 items-center justify-center transition-colors hover:bg-hud focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      <Icon name="pause" strokeWidth={3.5} className="size-7" />
    </button>
  );
}

function GameplayTimeline({
  statementCloses,
  paymentDue,
  progress,
  avatarSrc,
}: {
  statementCloses: string;
  paymentDue: string;
  progress: number;
  avatarSrc?: string;
}) {
  const position = toPosition(progress);

  return (
    <div className={`${PILL} min-w-0 px-4 pb-1.5 pt-2.5 sm:px-5`}>
      <dl className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <dt className="text-xs text-white/85 sm:text-sm">Statement closes</dt>
          <dd className="text-base font-extrabold sm:text-lg">{statementCloses}</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-xs text-white/85 sm:text-sm">Payment due</dt>
          <dd className="text-base font-extrabold sm:text-lg">{paymentDue}</dd>
        </div>
      </dl>

      {/* Decorative: the dates above already give screen readers the same information. */}
      <div
        aria-hidden="true"
        className={`relative mx-2 ${avatarSrc === undefined ? 'mt-1.5' : 'mt-9'} h-9`}
      >
        <div className="absolute inset-x-0 top-1.5 h-1.5 rounded-full bg-white" />
        <div
          className="absolute left-0 top-1.5 h-1.5 rounded-full bg-track"
          style={{ width: position }}
        />
        <span className="absolute right-0 top-0 size-[1.125rem] translate-x-1/2 rounded-full border-[3px] border-white bg-hud" />
        <span
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: position }}
        >
          {avatarSrc !== undefined && (
            <img
              src={avatarSrc}
              alt=""
              className="absolute bottom-full mb-0.5 h-9 w-auto max-w-none drop-shadow"
            />
          )}
          <span className="size-[1.125rem] rounded-full border-[3px] border-hud bg-white" />
          <span className="mt-0.5 whitespace-nowrap text-[0.7rem] leading-none text-white/85">
            You are here
          </span>
        </span>
      </div>
    </div>
  );
}

/** Points and the "Towards statement day" bar, sharing one pill as on the decision mockups. */
function PointsTimeline({
  points,
  statementCloses,
  paymentDue,
  progress,
  complete,
}: {
  points: string;
  statementCloses: string;
  paymentDue: string;
  progress: number;
  complete: boolean;
}) {
  const position = complete ? '100%' : toPosition(progress);

  return (
    <div className={`${PILL} min-w-0 px-3 pb-2 pt-2 sm:px-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CoinIcon className="size-9 shrink-0 sm:size-10" />
          <dl className="min-w-0">
            <dt className="text-xs text-white/85 sm:text-sm">Points</dt>
            <dd className="truncate text-lg font-extrabold leading-tight tabular-nums sm:text-xl">
              {points}
            </dd>
          </dl>
        </div>
        {complete ? (
          <p className="flex shrink-0 items-center gap-2 pt-0.5 text-xs sm:text-base">
            Simulation complete
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-white text-hud"
            >
              <Icon name="check" strokeWidth={3.5} className="size-3.5" />
            </span>
          </p>
        ) : (
          <p className="shrink-0 pt-0.5 text-xs text-white/85 sm:text-sm">Towards statement day</p>
        )}
      </div>

      {/* Decorative: the dates below (or "Simulation complete") say the same for screen readers. */}
      <div aria-hidden="true" className={`relative mx-2 h-2 ${complete ? 'mb-1 mt-3' : 'mt-3'}`}>
        <div className="absolute inset-0 rounded-full bg-white/90" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-track"
          style={{ width: position }}
        />
        {!complete && (
          <span className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white" />
        )}
        {!complete && (
          <span
            className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-hud bg-white text-hud"
            style={{ left: position }}
          >
            <Icon name="calendar" strokeWidth={2.5} className="size-5" />
          </span>
        )}
      </div>

      {!complete && (
        <dl className="mt-2.5 flex justify-between gap-4 text-xs font-semibold sm:text-sm">
          <div>
            <dt className="sr-only">Statement closes</dt>
            <dd>{statementCloses}</dd>
          </div>
          <div className="text-right">
            <dt className="sr-only">Payment due</dt>
            <dd>{paymentDue}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * The game status across the top of the screen. The gameplay layout matches the runner mockup;
 * the bar layout matches the statement and repayment mockups.
 */
export function Hud({
  month,
  monthNote,
  complete = false,
  cardBalance,
  points,
  statementCloses,
  paymentDue,
  progress = 0,
  avatarSrc,
  onPause,
  variant = 'gameplay',
}: HudProps) {
  const monthPill = (
    <StatPill
      inline
      label="Month"
      value={month}
      note={monthNote}
      icon={<Icon name="calendar" className="size-8" />}
    />
  );
  const cardPill = (
    <StatPill
      label="Card balance"
      value={cardBalance}
      icon={<Icon name="card" className="size-8" />}
    />
  );

  if (variant === 'bar') {
    return (
      <header
        aria-label="Game status"
        className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-5 sm:pt-5"
      >
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-4">
          {monthPill}
          {cardPill}
          <div className="col-span-2 min-w-0 sm:flex-1">
            <PointsTimeline
              points={points}
              statementCloses={statementCloses}
              paymentDue={paymentDue}
              progress={progress}
              complete={complete}
            />
          </div>
          {onPause !== undefined && (
            <PauseButton onPause={onPause} className="col-span-2 h-12 sm:h-auto sm:w-16" />
          )}
        </div>
      </header>
    );
  }

  return (
    <header aria-label="Game status" className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:gap-4">
        <div className="order-3 col-span-2 grid grid-cols-3 gap-2 sm:order-1 sm:col-span-1 sm:grid-cols-1 sm:gap-2.5">
          {monthPill}
          {cardPill}
          <StatPill label="Points" value={points} icon={<CoinIcon className="size-10" />} />
        </div>

        <div className="order-1 min-w-0 sm:order-2">
          <GameplayTimeline
            statementCloses={statementCloses}
            paymentDue={paymentDue}
            progress={progress}
            avatarSrc={avatarSrc}
          />
        </div>

        {onPause !== undefined && (
          <PauseButton onPause={onPause} className="order-2 size-14 sm:order-3 sm:size-16" />
        )}
      </div>
    </header>
  );
}
