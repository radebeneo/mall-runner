import { useId } from 'react';
import type { ReactNode } from 'react';

export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  /** A display-ready amount, e.g. "R1,240". Part of the option's accessible name. */
  amount?: string;
  /** Short facts about the option, read out as its description. */
  details?: readonly string[];
}

export interface ChoiceGroupProps<T extends string> {
  legend: ReactNode;
  options: readonly ChoiceOption<T>[];
  selected: T | null;
  onChange: (value: T) => void;
  /** Locks the group, e.g. once the player has confirmed a choice. */
  disabled?: boolean;
  layout?: 'stack' | 'grid';
}

/**
 * A group of large choice cards built on native radio buttons, so arrow keys, Tab and screen
 * readers work without extra code. No option is marked as the best one.
 */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
  disabled = false,
  layout = 'stack',
}: ChoiceGroupProps<T>) {
  const groupId = useId();

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-3 text-lg font-bold text-ink">{legend}</legend>
      <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2' : 'flex flex-col gap-3'}>
        {options.map((option) => {
          const id = `${groupId}-${option.value}`;
          const checked = option.value === selected;
          const labelledBy =
            option.amount === undefined ? `${id}-title` : `${id}-title ${id}-amount`;

          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex gap-3 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                checked ? 'border-primary bg-primary-soft' : 'border-line bg-white'
              } ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-primary'}`}
            >
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
                aria-describedby={option.details === undefined ? undefined : `${id}-details`}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span id={`${id}-title`} className="font-bold text-ink">
                  {option.title}
                </span>
                {option.amount !== undefined && (
                  <span
                    id={`${id}-amount`}
                    className="text-xl font-extrabold tabular-nums text-ink"
                  >
                    {option.amount}
                  </span>
                )}
                {option.details !== undefined && (
                  <ul
                    id={`${id}-details`}
                    className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted"
                  >
                    {option.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
