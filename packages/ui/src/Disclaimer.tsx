import type { ReactNode } from 'react';
import { Icon } from './Icon';

export const DEFAULT_DISCLAIMER =
  'Fictional learning scenario. Amounts, dates and offers are for practice only and are not financial advice.';

/**
 * - `strip`: a full-width line at the bottom of a panel.
 * - `card`: the side-rail card with a bulb and a title ("This is a fictional learning scenario").
 * - `info`: the pale blue note with a round "i", as under the repayment choices.
 * - `mint`: the pale green note with a round "i", as on the unexpected-bill screen.
 * - `plain`: a quiet centred line, as at the foot of the offer screen.
 */
export type DisclaimerVariant = 'strip' | 'card' | 'info' | 'mint' | 'plain';

export interface DisclaimerProps {
  children?: ReactNode;
  variant?: DisclaimerVariant;
  /** Bold heading, used by the `card` variant. */
  title?: string;
}

/** Shown on every screen with money on it (AGENTS.md section 3). */
export function Disclaimer({ children, variant = 'strip', title }: DisclaimerProps) {
  const body = children ?? DEFAULT_DISCLAIMER;

  if (variant === 'card') {
    return (
      <div
        role="note"
        className="rounded-2xl border border-white/70 bg-cream-card/95 p-4 text-ink shadow-pill"
      >
        <div className="flex items-start gap-3">
          <Icon name="bulb" className="size-8 shrink-0 text-amber" />
          {title !== undefined && <p className="font-bold leading-snug">{title}</p>}
        </div>
        <p className="mt-2 text-sm leading-relaxed">{body}</p>
      </div>
    );
  }

  if (variant === 'info' || variant === 'mint') {
    const mint = variant === 'mint';
    return (
      <div
        role="note"
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm leading-snug text-ink ${
          mint ? 'border-mint-line bg-mint' : 'border-info-line bg-info-soft'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center justify-center rounded-full font-serif font-bold text-white ${
            mint ? 'size-7 bg-primary text-base' : 'size-9 bg-info text-lg'
          }`}
        >
          i
        </span>
        <span>{body}</span>
      </div>
    );
  }

  if (variant === 'plain') {
    return (
      <p role="note" className="text-center text-sm leading-snug text-ink-muted">
        {body}
      </p>
    );
  }

  return (
    <p
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-line bg-cream-card/95 px-4 py-3 text-sm leading-relaxed text-ink"
    >
      <Icon name="bulb" className="mt-0.5 size-5 shrink-0 text-amber" />
      <span>{body}</span>
    </p>
  );
}
