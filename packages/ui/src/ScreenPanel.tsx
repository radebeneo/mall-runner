import { Fragment, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon, IconTile } from './Icon';
import type { IconName, TileTone } from './Icon';

/** Purple for offers and statements, red for unexpected expenses. */
export type BadgeTone = 'purple' | 'red';

const BADGE_TONES: Record<BadgeTone, string> = {
  purple: 'bg-accent',
  red: 'bg-danger',
};

export interface ScreenPanelProps {
  title: string;
  /** Small label above the title, e.g. "Unexpected expense". */
  badge?: string;
  badgeTone?: BadgeTone;
  /** An icon at the start of the badge, e.g. the offer tag. */
  badgeIcon?: IconName;
  /** A line or two under the title. */
  intro?: ReactNode;
  /** The coloured tile beside the title, e.g. the purple statement document. */
  icon?: { name: IconName; tone: TileTone; round?: boolean };
  /** Artwork to the right of the title, e.g. the pharmacy bag. Should be decorative. */
  media?: ReactNode;
  /** Shows the dark close button in the top-right corner. */
  onClose?: () => void;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * The cream card that holds one decision screen. Its heading takes focus when the screen
 * appears, so keyboard and screen-reader users start at the top of each new step.
 */
export function ScreenPanel({
  title,
  badge,
  badgeTone = 'purple',
  badgeIcon,
  intro,
  icon,
  media,
  onClose,
  closeLabel = 'Close',
  children,
}: ScreenPanelProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={headingId}
      className="relative rounded-3xl border border-white/70 bg-cream p-4 shadow-card sm:p-6"
    >
      {onClose !== undefined && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-xl bg-hud text-white shadow-pill transition-colors hover:bg-ink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary sm:right-6 sm:top-6 sm:size-12"
        >
          <Icon name="close" strokeWidth={3} className="size-6" />
        </button>
      )}

      <div className={`flex items-start gap-4 sm:gap-5 ${onClose === undefined ? '' : 'pr-14'}`}>
        {icon !== undefined && (
          <span className="max-sm:hidden">
            <IconTile
              name={icon.name}
              tone={icon.tone}
              size="xl"
              shape={icon.round === true ? 'round' : 'square'}
            />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {badge !== undefined && (
            <p
              className={`mb-2 inline-flex items-center gap-2 rounded-xl px-3 py-1 text-sm font-semibold text-white sm:text-base ${BADGE_TONES[badgeTone]}`}
            >
              {badgeIcon !== undefined && (
                <Icon name={badgeIcon} strokeWidth={2.5} className="size-5 shrink-0" />
              )}
              {badge}
            </p>
          )}
          <h1
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-extrabold leading-tight text-ink outline-none sm:text-4xl"
          >
            {/* "\n" in the title starts a new visual line; the space keeps the accessible name readable. */}
            {title.split('\n').map((line, index) => (
              <Fragment key={`${String(index)}-${line}`}>
                {index > 0 && ' '}
                <span className="block">{line}</span>
              </Fragment>
            ))}
          </h1>
          {intro !== undefined && (
            <div className="mt-1.5 text-base leading-snug text-ink">{intro}</div>
          )}
        </div>
        {media !== undefined && <div className="shrink-0 self-center">{media}</div>}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:gap-4">{children}</div>
    </section>
  );
}

export interface InfoCardProps {
  title: string;
  /** Content beside the title, e.g. a collapse chevron. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A titled inner card, e.g. "Your statement" or "Your money summary". */
export function InfoCard({ title, aside, children }: InfoCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-2xl border border-line bg-cream-card p-3 sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-bold text-ink sm:text-xl">
          {title}
        </h2>
        {aside}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
