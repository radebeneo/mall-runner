// The left-hand rail from the statement and repayment mockups. Every figure comes from the
// session state (the finance engine); these components only format it.
import { formatRand } from '@credit-runner/finance-engine';
import { Icon, SideCard } from '@credit-runner/ui';
import type { IconName } from '@credit-runner/ui';
import type { ReactNode } from 'react';
import { commitmentsNote } from '../session/session';
import type { Session } from '../session/session';

/**
 * The main panel with a rail of cards on its left. On phones the rail follows the panel, so the
 * decision comes first; the DOM order matches, which keeps focus and reading order natural.
 */
export function RailLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-5">
      <div className="min-w-0 lg:order-2">{children}</div>
      <aside aria-label="Your money" className="flex min-w-0 flex-col gap-3 lg:order-1">
        {rail}
      </aside>
    </div>
  );
}

export function EssentialsCard({ session }: { session: Session }) {
  return (
    <SideCard title="Essentials already covered" icon="shield">
      <p>Rent, food, transport and other must-haves are budgeted.</p>
      <details className="group mt-3 border-t border-line pt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          See details
          <Icon
            name="chevron-down"
            strokeWidth={2.5}
            className="size-5 transition-transform group-open:rotate-180"
          />
        </summary>
        <p className="pb-1">
          They are paid before each month starts. You have{' '}
          {formatRand(session.state.monthlyAfterEssentials)} a month left after them.
        </p>
      </details>
    </SideCard>
  );
}

export function SavingsCard({ session }: { session: Session }) {
  return (
    <SideCard
      title="Emergency savings"
      icon="piggy"
      value={formatRand(session.state.emergencySavings)}
    >
      Separate and safe.
    </SideCard>
  );
}

function MoneyRow({
  icon,
  iconClassName,
  label,
  note,
  value,
  suffix,
}: {
  icon: IconName;
  iconClassName: string;
  label: string;
  note?: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon name={icon} className={`size-8 shrink-0 ${iconClassName}`} />
      <div className="min-w-0">
        <dt className="text-sm font-semibold leading-snug">
          {label}
          {note !== undefined && <span className="block font-normal">({note})</span>}
        </dt>
        <dd className="text-2xl font-extrabold tabular-nums">
          {value}
          {suffix !== undefined && (
            <span className="block text-sm font-normal leading-tight">{suffix}</span>
          )}
        </dd>
      </div>
    </div>
  );
}

/** The stacked money card from the repayment mockup. */
export function MoneyCard({ session }: { session: Session }) {
  const { state } = session;
  return (
    <section
      aria-label="Your money this month"
      className="rounded-2xl border border-white/70 bg-cream-card/95 p-4 text-ink shadow-pill"
    >
      <dl className="divide-y divide-line">
        <MoneyRow
          icon="wallet"
          iconClassName="text-primary"
          label="After essentials"
          value={formatRand(state.monthlyAfterEssentials)}
        />
        <MoneyRow
          icon="shirt"
          iconClassName="text-danger"
          label="Existing commitments"
          note={commitmentsNote(session)}
          value={`−${formatRand(state.commitments)}`}
          suffix="per month"
        />
        <MoneyRow
          icon="card"
          iconClassName="text-accent"
          label="Available for repayment"
          value={formatRand(state.spendingAccount)}
        />
        <MoneyRow
          icon="piggy"
          iconClassName="text-info"
          label="Emergency savings (separate)"
          value={formatRand(state.emergencySavings)}
        />
      </dl>
    </section>
  );
}

/** The small mint note under the money card. */
export function CoveredNote({ session }: { session: Session }) {
  return (
    <p className="flex items-start gap-3 rounded-2xl border border-mint-line bg-mint/95 p-4 text-sm leading-relaxed text-ink shadow-pill">
      <Icon name="info" className="mt-0.5 size-6 shrink-0 text-primary" />
      <span>
        Your essential expenses are already covered. Your{' '}
        {formatRand(session.state.emergencySavings)} emergency savings is separate.
      </span>
    </p>
  );
}
