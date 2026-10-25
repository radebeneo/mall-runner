const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The green ring from "About your card use". Decorative: the sentence beside it carries the
 * figure for screen readers. `fraction` and `label` both come from the finance engine.
 */
export function UsageRing({ fraction, label }: { fraction: number; label: string }) {
  const filled = Math.min(Math.max(fraction, 0), 1) * CIRCUMFERENCE;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex size-20 shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={RADIUS} fill="#ffffff" stroke="#ffffff" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${String(filled)} ${String(CIRCUMFERENCE)}`}
        />
      </svg>
      <span className="relative text-lg font-extrabold tabular-nums text-ink">{label}</span>
    </span>
  );
}
