import type { ReactNode } from 'react';

export const DEFAULT_DISCLAIMER =
  'Fictional learning scenario. Amounts, dates and offers are for practice only and are not financial advice.';

/** Shown on every screen with money on it (AGENTS.md section 3). */
export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p role="note" className="rounded-xl bg-primary-soft px-4 py-3 text-center text-sm text-ink">
      {children ?? DEFAULT_DISCLAIMER}
    </p>
  );
}
