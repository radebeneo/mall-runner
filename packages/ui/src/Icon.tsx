import type { ReactNode } from 'react';

/** Line icons used across the HUD and decision screens. Decorative: always hidden from screen readers. */
export type IconName =
  | 'alert'
  | 'arrow-down'
  | 'arrow-right'
  | 'bag'
  | 'ban'
  | 'book'
  | 'bulb'
  | 'calculator'
  | 'calendar'
  | 'calendar-x'
  | 'card'
  | 'cart'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'close'
  | 'document'
  | 'info'
  | 'pause'
  | 'pie'
  | 'piggy'
  | 'plus'
  | 'scale'
  | 'shield'
  | 'shirt'
  | 'sofa'
  | 'star'
  | 'tag'
  | 'wallet';

const PATHS: Record<IconName, ReactNode> = {
  alert: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </g>
  ),
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  // Filled, as on the finish screen's headline tile.
  star: (
    <path
      d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"
      fill="currentColor"
    />
  ),
  ban: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </g>
  ),
  cart: (
    <g>
      <path d="M3 4h2.2l2.3 10.5h10.2L20 7H6.3" />
      <circle cx="9.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
    </g>
  ),
  scale: (
    <g>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
    </g>
  ),
  tag: (
    <g>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0l-8.3-8.3Z" />
      <path d="M8 8h.01" />
    </g>
  ),
  bag: (
    <g>
      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </g>
  ),
  book: (
    <g>
      <path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5" />
      <path d="M12 6.5C14 5 17 4.5 21 5v13c-4-.5-7 0-9 1.5" />
      <path d="M12 6.5v13" />
    </g>
  ),
  bulb: (
    <g>
      <path d="M9 17h6M10 20.5h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.3V17h6v-1.9c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3Z" />
    </g>
  ),
  calculator: (
    <g>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <rect x="8" y="6" width="8" height="3" rx="0.8" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" />
    </g>
  ),
  calendar: (
    <g>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01M16 17h.01" />
    </g>
  ),
  'calendar-x': (
    <g>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9.5 13 5 5M14.5 13l-5 5" />
    </g>
  ),
  card: (
    <g>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h4" />
    </g>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  document: (
    <g>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" />
    </g>
  ),
  info: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </g>
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  pie: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12h8.5" />
      <path d="M12 12 6 18" />
    </g>
  ),
  piggy: (
    <g>
      <path d="M4 12.5c0-3.6 3.4-6 7.5-6 1.5 0 2.9.3 4 .8L18 6v3c.9.8 1.5 1.7 1.7 2.7H21v3h-1.6c-.5 1-1.4 1.9-2.4 2.4V20h-3v-2.2a10 10 0 0 1-3 0V20H8v-2.6c-2.4-1-4-2.8-4-4.9Z" />
      <path d="M15.5 11h.01M10 9h3" />
    </g>
  ),
  plus: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M7.5 12h9" />
    </g>
  ),
  shield: (
    <g>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-4.5" />
    </g>
  ),
  shirt: <path d="M9 3.5 4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-5-2.5a3 3 0 0 1-6 0Z" />,
  sofa: (
    <g>
      <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5ZM5 18v2M19 18v2" />
    </g>
  ),
  wallet: (
    <g>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="7.5" width="16.5" height="12" rx="2.5" />
      <path d="M15 13.5h2.5" />
    </g>
  ),
};

export interface IconProps {
  name: IconName;
  className?: string;
  /** Stroke width in viewBox units. */
  strokeWidth?: number;
}

export function Icon({ name, className = 'size-6', strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The gold points coin from the HUD. Points are never money, so this is not a currency symbol. */
export function CoinIcon({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <circle cx="20" cy="20" r="19" fill="#c98a12" />
      <circle cx="20" cy="20" r="16" fill="#f2b632" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="#c98a12" strokeWidth="1.5" />
      <path
        d="m20 11.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"
        fill="#fff3c4"
        stroke="#c98a12"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type TileTone = 'green' | 'amber' | 'purple' | 'red' | 'blue';

const TILE_CLASSES: Record<TileTone, string> = {
  green: 'bg-primary text-white',
  amber: 'bg-amber text-white',
  purple: 'bg-accent text-white',
  red: 'bg-danger text-white',
  blue: 'bg-info text-white',
};

/** A rounded, coloured square holding an icon, as on the statement and repayment cards. */
export function IconTile({
  name,
  tone,
  size = 'md',
  shape = 'square',
}: {
  name: IconName;
  tone: TileTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `round` for the circular tiles on the finish screen. */
  shape?: 'square' | 'round';
}) {
  const corner =
    shape === 'round'
      ? 'rounded-full'
      : { sm: 'rounded-lg', md: 'rounded-2xl', lg: 'rounded-2xl', xl: 'rounded-3xl' }[size];
  const box = `${{ sm: 'size-8', md: 'size-14', lg: 'size-16', xl: 'size-20' }[size]} ${corner}`;
  const icon = { sm: 'size-5', md: 'size-8', lg: 'size-9', xl: 'size-11' }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] ${box} ${TILE_CLASSES[tone]}`}
    >
      <Icon name={name} className={icon} />
    </span>
  );
}
