import { useId } from 'react';
import { Icon, IconTile } from './Icon';
import type { IconName, TileTone } from './Icon';

export interface ToggleTileProps {
  title: string;
  description: string;
  icon: { name: IconName; tone: TileTone };
  expanded: boolean;
  /** The id of the content this tile shows and hides. */
  controls: string;
  onToggle: () => void;
}

/**
 * A choice-style tile that shows or hides extra detail instead of making a decision, e.g.
 * "Compare the commitment". It matches the `tiles` layout of ChoiceGroup so they sit together.
 */
export function ToggleTile({
  title,
  description,
  icon,
  expanded,
  controls,
  onToggle,
}: ToggleTileProps) {
  const id = useId();

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onClick={onToggle}
      className={`relative flex h-full w-full items-start gap-3 rounded-2xl border-2 bg-cream-card p-3 pb-12 text-left transition-colors hover:border-primary focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-4 sm:pb-12 ${
        expanded ? 'border-primary' : 'border-line'
      }`}
    >
      <IconTile name={icon.name} tone={icon.tone} />
      <span className="flex min-w-0 flex-col gap-1">
        <span id={`${id}-title`} className="font-bold leading-tight text-ink sm:text-lg">
          {title}
        </span>
        <span id={`${id}-description`} className="text-sm leading-snug text-ink">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full border-2 transition-colors ${
          expanded
            ? 'border-primary bg-primary text-white'
            : 'border-ink/40 bg-white text-transparent'
        }`}
      >
        <Icon name="check" strokeWidth={3} className="size-5" />
      </span>
    </button>
  );
}
