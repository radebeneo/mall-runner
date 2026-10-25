import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-md hover:bg-primary-dark disabled:bg-ink-muted/40 disabled:shadow-none',
  secondary:
    'border-2 border-primary bg-white text-primary hover:bg-primary-soft disabled:border-line disabled:text-ink-muted',
};

/** A large, full-width button. Touch targets are at least 48 px tall. */
export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`min-h-12 w-full rounded-2xl px-5 py-3 text-lg font-bold transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
