import { useId } from 'react';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The id of the content this switch shows and hides. */
  controls?: string;
}

/**
 * The green on/off switch from the month summary mockup ("View alternate outcome"). A button with
 * `role="switch"`, wrapped in its label so the whole row is a 44 px touch target.
 */
export function Switch({ label, checked, onChange, controls }: SwitchProps) {
  const id = useId();
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
      <span id={`${id}-label`} className="text-sm font-semibold text-ink sm:text-base">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-controls={controls}
        onClick={() => {
          onChange(!checked);
        }}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
          checked ? 'border-primary bg-primary' : 'border-ink/30 bg-ink/20'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
