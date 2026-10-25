import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** An icon pinned to the right edge, e.g. the chevron on "Plan my payment". */
  trailingIcon?: IconName;
}

const BLOCK = 'relative min-h-14 w-full rounded-2xl px-12 py-3.5 text-xl font-extrabold';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: `${BLOCK} bg-primary text-white shadow-[0_6px_14px_rgb(31_122_63/0.35),inset_0_-3px_0_rgb(0_0_0/0.18)] hover:bg-primary-dark disabled:bg-ink-muted/40 disabled:shadow-none`,
  secondary: `${BLOCK} border-2 border-primary bg-white text-primary hover:bg-primary-soft disabled:border-line disabled:text-ink-muted`,
  link: 'mx-auto block min-h-11 rounded-lg px-3 text-base font-bold text-primary underline-offset-4 hover:underline disabled:text-ink-muted',
};

/** A large, full-width button, or a text link. Touch targets are at least 44 px tall. */
export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  trailingIcon,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
      {trailingIcon !== undefined && (
        <Icon
          name={trailingIcon}
          strokeWidth={3}
          className="absolute right-5 top-1/2 size-6 -translate-y-1/2"
        />
      )}
    </button>
  );
}
