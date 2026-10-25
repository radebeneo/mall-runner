import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** A list of label and value rows, e.g. the lines of a statement. */
export function ValueList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-2">{children}</dl>;
}

export type ValueRowTone = 'plain' | 'mint';

export interface ValueRowProps {
  label: string;
  /** Display-ready value from the finance engine, e.g. "R1,240". */
  value: string;
  /** Extra context under the label. */
  note?: string;
  /** A small aside on the same line as the label, e.g. "(separate)". */
  hint?: string;
  /** A small unit after the value, e.g. "/ month". */
  unit?: string;
  /** Highlights a total such as the statement balance. */
  emphasis?: boolean;
  /** An icon before the label, as on the statement rows. */
  icon?: IconName;
  /** Tailwind text colour for the icon, e.g. "text-primary". */
  iconClassName?: string;
  /** "mint" picks out a row, e.g. the example minimum due. */
  tone?: ValueRowTone;
}

const ROW_TONES: Record<ValueRowTone, string> = {
  plain: 'border-line bg-white/70',
  mint: 'border-mint-line bg-mint',
};

export function ValueRow({
  label,
  value,
  note,
  hint,
  unit,
  emphasis = false,
  icon,
  iconClassName = 'text-primary',
  tone = 'plain',
}: ValueRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5 ${
        emphasis ? 'border-ink/15 bg-cream' : ROW_TONES[tone]
      }`}
    >
      <dt className={`min-w-0 leading-snug text-ink ${emphasis ? 'font-bold' : ''}`}>
        {icon !== undefined && (
          <Icon
            name={icon}
            className={`mr-3 inline-block size-6 align-[-0.4em] ${iconClassName}`}
          />
        )}
        {label}
        {hint !== undefined && <span className="ml-1 text-xs text-ink-muted">{hint}</span>}
        {note !== undefined && (
          <span className={`block text-sm text-ink-muted ${icon === undefined ? '' : 'pl-9'}`}>
            {note}
          </span>
        )}
      </dt>
      <dd
        className={`shrink-0 text-right tabular-nums text-ink ${emphasis ? 'text-xl font-extrabold' : 'font-bold'}`}
      >
        {value}
        {unit !== undefined && <span className="ml-1 text-sm font-normal">{unit}</span>}
      </dd>
    </div>
  );
}
