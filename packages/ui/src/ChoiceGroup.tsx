import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon, IconTile } from './Icon';
import type { IconName, TileTone } from './Icon';

export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  /** A display-ready amount, e.g. "R1,240". Part of the option's accessible name. */
  amount?: string;
  /** One short line under the title, as on the offer tiles. Read out as the description. */
  description?: string;
  /** Short facts about the option, read out as its description. */
  details?: readonly string[];
  /** The coloured tile on the left of the card. */
  icon?: { name: IconName; tone: TileTone };
}

/**
 * - `stack`: full-width cards, one under another (the repayment choices).
 * - `grid`: two columns from the small breakpoint.
 * - `tiles`: compact cards side by side, one equal column each (the offer choices).
 */
export type ChoiceLayout = 'stack' | 'grid' | 'tiles';

export interface ChoiceGroupProps<T extends string> {
  legend: ReactNode;
  /** Keeps the legend for screen readers only, when the screen's heading already asks. */
  legendHidden?: boolean;
  options: readonly ChoiceOption<T>[];
  selected: T | null;
  onChange: (value: T) => void;
  /** Locks the group, e.g. once the player has confirmed a choice. */
  disabled?: boolean;
  layout?: ChoiceLayout;
}

const LAYOUT_CLASSES: Record<ChoiceLayout, string> = {
  stack: 'flex flex-col gap-3',
  grid: 'grid gap-3 sm:grid-cols-2',
  tiles: 'grid h-full gap-3 sm:auto-cols-fr sm:grid-flow-col',
};

const FOCUS_RING =
  'has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary';

/** The round marker that mirrors the hidden radio. Must follow the input as a sibling. */
function Marker({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full border-2 border-ink/40 bg-white text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white ${className}`}
    >
      <Icon name="check" strokeWidth={3} className="size-5" />
    </span>
  );
}

/**
 * A group of large choice cards built on native radio buttons, so arrow keys, Tab and screen
 * readers work without extra code. The visible round marker mirrors the radio.
 * No option is marked as the best one.
 */
export function ChoiceGroup<T extends string>({
  legend,
  legendHidden = false,
  options,
  selected,
  onChange,
  disabled = false,
  layout = 'stack',
}: ChoiceGroupProps<T>) {
  const groupId = useId();
  const tiles = layout === 'tiles';

  return (
    <fieldset disabled={disabled} className={`min-w-0 ${tiles ? 'h-full' : ''}`}>
      <legend className={legendHidden ? 'sr-only' : 'mb-3 text-base text-ink'}>{legend}</legend>
      <div className={LAYOUT_CLASSES[layout]}>
        {options.map((option) => {
          const id = `${groupId}-${option.value}`;
          const checked = option.value === selected;
          const labelledBy =
            option.amount === undefined ? `${id}-title` : `${id}-title ${id}-amount`;
          const describedBy = [
            option.description === undefined ? null : `${id}-description`,
            option.details === undefined ? null : `${id}-details`,
          ]
            .filter((part): part is string => part !== null)
            .join(' ');
          const interaction = disabled ? 'cursor-default' : 'cursor-pointer hover:border-primary';

          const input = (
            <input
              id={id}
              type="radio"
              name={groupId}
              value={option.value}
              checked={checked}
              onChange={() => {
                onChange(option.value);
              }}
              aria-labelledby={labelledBy}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              className="peer sr-only"
            />
          );
          const description =
            option.description === undefined ? null : (
              <span id={`${id}-description`} className="text-sm leading-snug text-ink">
                {option.description}
              </span>
            );

          if (tiles) {
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={`relative flex h-full items-start gap-3 rounded-2xl border-2 bg-cream-card p-3 pb-12 transition-colors sm:p-4 sm:pb-12 ${FOCUS_RING} ${
                  checked ? 'border-primary' : 'border-line'
                } ${interaction}`}
              >
                {input}
                {option.icon !== undefined && (
                  <IconTile name={option.icon.name} tone={option.icon.tone} />
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  <span id={`${id}-title`} className="font-bold leading-tight text-ink sm:text-lg">
                    {option.title}
                  </span>
                  {description}
                </span>
                <Marker className="absolute bottom-3 right-3 size-8" />
              </label>
            );
          }

          const hasIcon = option.icon !== undefined;
          const columns = hasIcon
            ? 'grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]';
          const detailsPlacement = hasIcon
            ? 'col-start-2 col-end-4 row-start-2 sm:col-start-3 sm:col-end-4 sm:row-start-1'
            : 'col-span-full row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1';

          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`relative grid items-center gap-x-3 gap-y-2 rounded-2xl border-2 p-3 transition-colors sm:gap-x-5 sm:p-4 ${FOCUS_RING} ${columns} ${
                checked ? 'border-primary bg-primary-soft' : 'border-line bg-cream-card'
              } ${interaction}`}
            >
              {input}
              {option.icon !== undefined && (
                <IconTile name={option.icon.name} tone={option.icon.tone} />
              )}
              <span className="flex min-w-0 flex-col">
                <span id={`${id}-title`} className="text-lg font-bold leading-tight text-ink">
                  {option.title}
                </span>
                {option.amount !== undefined && (
                  <span
                    id={`${id}-amount`}
                    className="text-2xl font-extrabold tabular-nums text-ink"
                  >
                    {option.amount}
                  </span>
                )}
                {description}
              </span>
              {option.details !== undefined && (
                <ul
                  id={`${id}-details`}
                  className={`list-disc space-y-1 pl-5 text-sm leading-snug text-ink ${detailsPlacement}`}
                >
                  {option.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
              <Marker className="size-8" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
