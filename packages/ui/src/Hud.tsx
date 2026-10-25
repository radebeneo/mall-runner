export interface HudProps {
  /** e.g. "2 of 3". */
  month: string;
  /** e.g. "R1,240". */
  cardBalance: string;
  /** e.g. "340 pts". Never formatted like money. */
  points: string;
  /** e.g. "25 Sep". */
  statementCloses: string;
  /** e.g. "5 Oct". */
  paymentDue: string;
}

function HudItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-white/75">{label}</dt>
      <dd className="truncate text-base font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** The dark status bar across the top of the game. */
export function Hud({ month, cardBalance, points, statementCloses, paymentDue }: HudProps) {
  return (
    <header aria-label="Game status" className="bg-hud/95 text-white shadow-lg">
      <dl className="mx-auto grid max-w-2xl grid-cols-3 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-5">
        <HudItem label="Month" value={month} />
        <HudItem label="Card balance" value={cardBalance} />
        <HudItem label="Points" value={points} />
        <HudItem label="Statement closes" value={statementCloses} />
        <HudItem label="Payment due" value={paymentDue} />
      </dl>
    </header>
  );
}
