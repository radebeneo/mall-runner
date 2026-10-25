import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type Tone =
  'info' | 'success' | 'warning' | 'danger' | 'mint' | 'beige' | 'note' | 'solid' | 'card';

const TONE_CLASSES: Record<Tone, string> = {
  info: 'border-accent-line bg-accent-soft text-ink',
  success: 'border-primary/30 bg-primary-soft text-ink',
  warning: 'border-warn/60 bg-warn-soft text-ink',
  danger: 'border-danger/40 bg-danger-soft text-ink',
  // The "About your card use" panel.
  mint: 'border-mint-line bg-mint text-ink',
  // The minimum-payment note and other quiet tips.
  beige: 'border-line bg-cream-deep text-ink',
  // The pale blue information strip.
  note: 'border-info-line bg-info-soft text-ink',
  // The solid green result banner on the offer screen.
  solid: 'border-primary bg-primary text-white',
  // The white result note on the unexpected-bill screen.
  card: 'border-line bg-cream-card text-ink',
};

const ICON_CLASSES: Record<Tone, string> = {
  info: 'text-accent',
  success: 'text-primary',
  warning: 'text-warn',
  danger: 'text-danger',
  mint: 'text-primary',
  beige: 'text-warn',
  note: 'text-info',
  solid: 'text-white',
  card: 'text-primary',
};

export interface CalloutProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  /** Announce the content to screen readers, e.g. for the result of a choice. */
  live?: boolean;
  /** An icon on the left. */
  icon?: IconName;
  /** Custom content on the left in place of an icon, e.g. a usage ring or a coin. */
  media?: ReactNode;
}

/** A tinted box for tips, warnings and the result of a decision. */
export function Callout({
  tone = 'info',
  title,
  children,
  live = false,
  icon,
  media,
}: CalloutProps) {
  const solid = tone === 'solid';
  return (
    <div
      role={live ? 'status' : undefined}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${solid ? 'sm:px-5 sm:py-4' : ''} ${TONE_CLASSES[tone]}`}
    >
      {media ??
        (icon !== undefined && (
          <Icon name={icon} className={`mt-0.5 size-6 shrink-0 ${ICON_CLASSES[tone]}`} />
        ))}
      <div className="min-w-0 flex-1 self-center">
        {title !== undefined && (
          <p className={`font-bold ${solid ? 'text-lg leading-snug' : ''}`}>{title}</p>
        )}
        {children !== undefined && (
          <div
            className={solid ? 'text-base leading-snug text-white/90' : 'text-sm leading-relaxed'}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
