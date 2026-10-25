import type { ReactNode } from 'react';

export type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  info: 'border-accent/30 bg-accent-soft',
  success: 'border-primary/30 bg-primary-soft',
  warning: 'border-warn/60 bg-warn-soft',
  danger: 'border-danger/40 bg-danger-soft',
};

export interface CalloutProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  /** Announce the content to screen readers, e.g. for the result of a choice. */
  live?: boolean;
}

/** A tinted box for tips, warnings and the result of a decision. */
export function Callout({ tone = 'info', title, children, live = false }: CalloutProps) {
  return (
    <div
      role={live ? 'status' : undefined}
      className={`rounded-2xl border px-4 py-3 text-ink ${TONE_CLASSES[tone]}`}
    >
      {title !== undefined && <p className="font-bold">{title}</p>}
      {children !== undefined && <div className="text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
