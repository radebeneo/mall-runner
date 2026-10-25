// Input guards. The engine validates its inputs so bad data fails loudly instead of
// producing a plausible-looking wrong number.

export function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative whole number of cents (got ${String(value)}).`,
    );
  }
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative whole number (got ${String(value)}).`);
  }
}

export function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive whole number (got ${String(value)}).`);
  }
}

export function assertRate(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1 (got ${String(value)}).`);
  }
}

export function assertDayOfMonth(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new RangeError(
      `${label} must be a day of the month from 1 to 31 (got ${String(value)}).`,
    );
  }
}
