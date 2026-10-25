import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ScreenPanelProps {
  title: string;
  /** Small label above the title, e.g. "Unexpected expense". */
  badge?: string;
  /** A line or two under the title. */
  intro?: ReactNode;
  children: ReactNode;
}

/**
 * The cream card that holds one decision screen. Its heading takes focus when the screen
 * appears, so keyboard and screen-reader users start at the top of each new step.
 */
export function ScreenPanel({ title, badge, intro, children }: ScreenPanelProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={headingId} className="rounded-3xl bg-cream p-5 shadow-card sm:p-7">
      {badge !== undefined && (
        <p className="mb-3 inline-block rounded-xl bg-accent px-3 py-1 text-sm font-semibold text-white">
          {badge}
        </p>
      )}
      <h1
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-3xl font-extrabold leading-tight text-ink outline-none"
      >
        {title}
      </h1>
      {intro !== undefined && <div className="mt-2 text-base text-ink-muted">{intro}</div>}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export interface InfoCardProps {
  title: string;
  children: ReactNode;
}

/** A titled white card inside a screen, e.g. "Your statement". */
export function InfoCard({ title, children }: InfoCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-line bg-white/80 p-4">
      <h2 id={headingId} className="mb-2 text-lg font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}
