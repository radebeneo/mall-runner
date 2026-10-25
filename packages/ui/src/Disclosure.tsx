import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type DisclosureTone = 'beige' | 'mint';

const TONE_CLASSES: Record<DisclosureTone, string> = {
  beige: 'border-line bg-cream-deep',
  mint: 'border-mint-line bg-mint',
};

export interface DisclosureProps {
  title: string;
  /** Always visible under the title, e.g. a one-line explanation. */
  summary?: ReactNode;
  /** Shown when the strip is expanded. */
  children?: ReactNode;
  /** The icon before the title. `null` shows none. */
  icon?: IconName | null;
  tone?: DisclosureTone;
  defaultOpen?: boolean;
  /** Controls the strip from outside, e.g. an "Explore examples" link that opens it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The expandable strip from the mockups ("What's next?", "How interest works", "About your card
 * use"). Built on native details and summary, so it works with the keyboard and needs no script.
 */
export function Disclosure({
  title,
  summary,
  children,
  icon = 'book',
  tone = 'beige',
  defaultOpen = false,
  open,
  onOpenChange,
}: DisclosureProps) {
  return (
    <details
      open={open ?? defaultOpen}
      onToggle={(event) => {
        onOpenChange?.(event.currentTarget.open);
      }}
      className={`group rounded-2xl border text-ink ${TONE_CLASSES[tone]}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {icon !== null && <Icon name={icon} className="size-9 shrink-0 text-warn" />}
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{title}</span>
          {summary !== undefined && <span className="block text-sm leading-snug">{summary}</span>}
        </span>
        <Icon
          name="chevron-down"
          strokeWidth={2.5}
          className="size-6 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      {children !== undefined && (
        <div className={`px-4 pb-4 text-sm leading-relaxed ${icon === null ? '' : 'sm:pl-16'}`}>
          {children}
        </div>
      )}
    </details>
  );
}
