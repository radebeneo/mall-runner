import type { ReactNode } from 'react';

/** A list of label and value rows, e.g. the lines of a statement. */
export function ValueList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>;
}

export interface ValueRowProps {
  label: string;
  /** Display-ready value from the finance engine, e.g. "R1,240". */
  value: string;
  /** Extra context under the label. */
  note?: string;
  /** Highlights a total such as the statement balance. */
  emphasis?: boolean;
}

export function ValueRow({ label, value, note, emphasis = false }: ValueRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={emphasis ? 'font-bold text-ink' : 'text-ink-muted'}>
        {label}
        {note !== undefined && <span className="block text-sm text-ink-muted">{note}</span>}
      </dt>
      <dd
        className={`shrink-0 text-right tabular-nums text-ink ${emphasis ? 'text-xl font-extrabold' : 'font-semibold'}`}
      >
        {value}
      </dd>
    </div>
  );
}
