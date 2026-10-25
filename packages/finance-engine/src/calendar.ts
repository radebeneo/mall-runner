import { assertDayOfMonth, assertNonNegativeInteger, assertPositiveInteger } from './guards';
import type { CalendarDate, CalendarMonth, StatementDates, StatementTerms } from './types';

// Fictional calendar dates for statements. No Date or Intl objects, so results never depend on
// the device's clock, time zone or locale.

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function assertCalendarMonth(value: CalendarMonth, label: string): void {
  assertPositiveInteger(value.year, `${label} year`);
  if (!Number.isSafeInteger(value.month) || value.month < 1 || value.month > 12) {
    throw new RangeError(`${label} month must be from 1 to 12 (got ${String(value.month)}).`);
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth({ year, month }: CalendarMonth): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function addMonths(start: CalendarMonth, count: number): CalendarMonth {
  const index = start.year * 12 + (start.month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** A day in a month, moved back to the month's last day when the month is shorter. */
function onDay(month: CalendarMonth, day: number): CalendarDate {
  return { year: month.year, month: month.month, day: Math.min(day, daysInMonth(month)) };
}

/**
 * The close and due dates of a month's statement. The statement closes on the close day of the
 * scenario's start month plus `monthIndex` months. Payment is due on the next due day after that:
 * later the same month, or in the following month.
 */
export function statementDates(
  terms: Pick<StatementTerms, 'startMonth' | 'statementCloseDay' | 'paymentDueDay'>,
  monthIndex: number,
): StatementDates {
  assertNonNegativeInteger(monthIndex, 'Month');
  assertCalendarMonth(terms.startMonth, 'Start month');
  assertDayOfMonth(terms.statementCloseDay, 'Statement close day');
  assertDayOfMonth(terms.paymentDueDay, 'Payment due day');

  const closeMonth = addMonths(terms.startMonth, monthIndex);
  const closes = onDay(closeMonth, terms.statementCloseDay);
  const sameMonthDue = onDay(closeMonth, terms.paymentDueDay);
  const due =
    sameMonthDue.day > closes.day
      ? sameMonthDue
      : onDay(addMonths(closeMonth, 1), terms.paymentDueDay);
  return { closes, due };
}

function monthName(date: CalendarDate): string {
  const name = MONTH_NAMES[date.month - 1];
  if (name === undefined) {
    throw new RangeError(`Month must be from 1 to 12 (got ${String(date.month)}).`);
  }
  return name;
}

/** "30 September". */
export function formatDate(date: CalendarDate): string {
  return `${String(date.day)} ${monthName(date)}`;
}

/** "30 Sep". */
export function formatShortDate(date: CalendarDate): string {
  return `${String(date.day)} ${monthName(date).slice(0, 3)}`;
}
