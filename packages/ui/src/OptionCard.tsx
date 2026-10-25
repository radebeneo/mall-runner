import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon, IconTile } from './Icon';
import type { IconName, TileTone } from './Icon';

/** One short fact on an option card, e.g. "Savings: R500 → R20". Display-ready text. */
export interface OptionFact {
  icon: IconName;
  tone: TileTone;
  text: string;
}

export type OptionActionTone = 'green' | 'amber';

export interface OptionCardProps {
  title: string;
  icon: { name: IconName; tone: TileTone };
  facts: readonly OptionFact[];
  /** Extra content above the button, e.g. the "essentials already covered" note. */
  note?: ReactNode;
  /** The button text, e.g. "Use card". */
  actionLabel: string;
  actionTone?: OptionActionTone;
  /** This option was chosen. Shown with a check on the button and a green border. */
  selected?: boolean;
  /** A choice has been made, so the button no longer reports clicks. It stays focusable. */
  locked?: boolean;
  onSelect: () => void;
}

const ACTION_CLASSES: Record<OptionActionTone, string> = {
  green:
    'bg-primary shadow-[0_6px_14px_rgb(31_122_63/0.35),inset_0_-3px_0_rgb(0_0_0/0.18)] enabled:aria-[disabled=false]:hover:bg-primary-dark',
  amber:
    'bg-amber-strong shadow-[0_6px_14px_rgb(201_130_16/0.35),inset_0_-3px_0_rgb(0_0_0/0.18)] enabled:aria-[disabled=false]:hover:bg-warn',
};

/**
 * A card describing one way to handle a decision, with its own action button, as on the
 * unexpected-bill screen. The button is a toggle (`aria-pressed`) so the chosen card is clear.
 */
export function OptionCard({
  title,
  icon,
  facts,
  note,
  actionLabel,
  actionTone = 'green',
  selected = false,
  locked = false,
  onSelect,
}: OptionCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col gap-4 rounded-2xl border-2 bg-cream-card p-4 transition-opacity ${
        selected ? 'border-primary' : 'border-line'
      } ${locked && !selected ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <IconTile name={icon.name} tone={icon.tone} />
        <h2 id={headingId} className="text-lg font-bold leading-tight text-ink sm:text-xl">
          {title}
        </h2>
      </div>
      <ul className="flex flex-col gap-3 text-base leading-snug text-ink">
        {facts.map((fact) => (
          <li key={fact.text} className="flex items-start gap-3">
            <IconTile name={fact.icon} tone={fact.tone} size="sm" />
            <span className="pt-1">{fact.text}</span>
          </li>
        ))}
      </ul>
      {note}
      <button
        type="button"
        aria-pressed={selected}
        aria-disabled={locked}
        onClick={() => {
          if (!locked) onSelect();
        }}
        className={`relative mt-auto min-h-14 w-full rounded-2xl px-14 py-3.5 text-xl font-extrabold text-white transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          ACTION_CLASSES[actionTone]
        } ${locked ? 'cursor-default' : ''}`}
      >
        {actionLabel}
        {selected && (
          <span
            aria-hidden="true"
            className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink"
          >
            <Icon name="check" strokeWidth={3} className="size-5" />
          </span>
        )}
      </button>
    </section>
  );
}
