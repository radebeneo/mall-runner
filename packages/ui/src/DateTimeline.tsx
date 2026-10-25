import { Icon } from './Icon';

export interface TimelineStop {
  /** e.g. "30 September". */
  date: string;
  /** e.g. "Statement closes". */
  label: string;
}

function Stop({ date, label }: TimelineStop) {
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <Icon name="calendar" className="size-8 shrink-0 text-accent sm:size-9" />
      <span className="min-w-0">
        <span className="block font-extrabold leading-tight text-ink">{date}</span>
        <span className="block text-sm leading-tight text-ink">{label}</span>
      </span>
    </li>
  );
}

/** The lavender strip from the statement mockup: closing date, an arrow, then the due date. */
export function DateTimeline({
  from,
  to,
  caption,
}: {
  from: TimelineStop;
  to: TimelineStop;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-accent-line bg-accent-soft px-3 py-3 sm:px-6">
      <ol className="flex items-center justify-between gap-2 sm:gap-4">
        <Stop {...from} />
        <li aria-hidden="true" className="flex min-w-6 flex-1 items-center text-accent">
          <span className="size-2.5 shrink-0 rounded-full bg-accent" />
          <span className="h-0.5 flex-1 bg-accent" />
          <svg viewBox="0 0 10 12" className="-ml-px h-3 w-2.5 shrink-0 fill-current">
            <path d="M0 0 10 6 0 12Z" />
          </svg>
        </li>
        <Stop {...to} />
      </ol>
      {caption !== undefined && (
        <p className="mt-2 text-center text-xs text-ink-muted sm:text-sm">{caption}</p>
      )}
    </div>
  );
}
