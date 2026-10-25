import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type SideCardTone = 'green' | 'blue' | 'amber' | 'red' | 'purple';

const ICON_TONES: Record<SideCardTone, string> = {
  green: 'text-primary',
  blue: 'text-info',
  amber: 'text-amber',
  red: 'text-danger',
  purple: 'text-accent',
};

export interface SideCardProps {
  title: string;
  icon: IconName;
  tone?: SideCardTone;
  /** A large figure under the title, e.g. "R500". */
  value?: string;
  children?: ReactNode;
}

/** The small cream cards in the left rail, e.g. "Essentials already covered". */
export function SideCard({ title, icon, tone = 'green', value, children }: SideCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-white/70 bg-cream-card/95 p-4 text-ink shadow-pill"
    >
      <div className="flex items-start gap-3">
        <Icon name={icon} className={`size-8 shrink-0 ${ICON_TONES[tone]}`} />
        <div className="min-w-0">
          <h2 id={headingId} className="font-bold leading-snug">
            {title}
          </h2>
          {value !== undefined && <p className="text-2xl font-extrabold tabular-nums">{value}</p>}
        </div>
      </div>
      {children !== undefined && <div className="mt-2 text-sm leading-relaxed">{children}</div>}
    </section>
  );
}
