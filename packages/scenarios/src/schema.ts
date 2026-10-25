import { z } from 'zod';

// Zod schemas for scenario JSON (AGENTS.md section 5). The rules mirror the finance engine's guards
// so that a bad file is rejected at load time with a message a content author can act on.

const CENTS_HINT = 'Must be a whole number of cents, e.g. 190000 for R1,900';

const cents = () => z.int(CENTS_HINT).min(0, 'Cannot be negative');

const rate = () =>
  z
    .number('Must be a number')
    .min(0, 'Must be between 0 and 1, e.g. 0.05 for 5%')
    .max(1, 'Must be between 0 and 1, e.g. 0.05 for 5%');

const dayOfMonth = () =>
  z
    .int('Must be a whole day number')
    .min(1, 'Must be from 1 to 31')
    .max(31, 'Must be from 1 to 31');

const monthIndex = () =>
  z.int('Must be a whole month number').min(0, 'Months start at 0 for the first month');

const slug = () =>
  z
    .string('Must be text')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes');

const text = () => z.string('Must be text').trim().min(1, 'Cannot be empty');

export const calendarMonthSchema = z.strictObject({
  year: z.int('Must be a whole year, e.g. 2026').min(1, 'Must be a positive year'),
  month: z
    .int('Must be a whole month number')
    .min(1, 'Must be from 1 (January) to 12 (December)')
    .max(12, 'Must be from 1 (January) to 12 (December)'),
});

export const scenarioPurchaseSchema = z.strictObject({
  id: slug(),
  monthIndex: monthIndex(),
  label: text(),
  amount: cents(),
});

export const scenarioEventSchema = z.strictObject({
  id: slug(),
  monthIndex: monthIndex(),
  title: text(),
  cost: cents(),
});

export const scenarioOfferSchema = z.strictObject({
  id: slug(),
  monthIndex: monthIndex(),
  title: text(),
  cashPrice: cents(),
  monthlyInstalment: cents(),
  termMonths: z.int('Must be a whole number of months').min(1, 'Must be at least 1 month'),
  upfrontFee: cents(),
  monthlyFee: cents(),
});

interface ScheduledItem {
  id: string;
  monthIndex: number;
}

export const scenarioConfigSchema = z
  .strictObject({
    id: slug(),
    months: z.int('Must be a whole number of months').min(1, 'Must be at least 1 month'),
    /** The calendar month in which the first statement closes. Dates are fictional. */
    startMonth: calendarMonthSchema,
    creditLimit: cents().min(1, 'Must be more than zero'),
    monthlyAfterEssentials: cents(),
    existingCommitments: cents(),
    emergencySavings: cents(),
    minimumPaymentRate: rate(),
    monthlyInterestRate: rate(),
    latePaymentFee: cents(),
    statementCloseDay: dayOfMonth(),
    paymentDueDay: dayOfMonth(),
    /** Card purchases scheduled per month. In decisions-only mode these stand in for shopping. */
    purchases: z.array(scenarioPurchaseSchema),
    events: z.array(scenarioEventSchema),
    offers: z.array(scenarioOfferSchema),
  })
  .superRefine((config, ctx) => {
    if (config.existingCommitments > config.monthlyAfterEssentials) {
      ctx.addIssue({
        code: 'custom',
        path: ['existingCommitments'],
        message: 'Cannot be more than monthlyAfterEssentials',
      });
    }

    // Purchase, event and offer IDs share one namespace so analytics and saves can refer to any.
    const seen = new Set<string>();
    const checkItems = (
      listName: 'purchases' | 'events' | 'offers',
      items: readonly ScheduledItem[],
    ) => {
      items.forEach((item, index) => {
        if (item.monthIndex >= config.months) {
          ctx.addIssue({
            code: 'custom',
            path: [listName, index, 'monthIndex'],
            message: `Must be less than months (${String(config.months)}); months start at 0`,
          });
        }
        if (seen.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [listName, index, 'id'],
            message: `Duplicate id "${item.id}"; purchase, event and offer ids must be unique`,
          });
        }
        seen.add(item.id);
      });
    };
    checkItems('purchases', config.purchases);
    checkItems('events', config.events);
    checkItems('offers', config.offers);
  });

/** The version of the scenario file format this build understands. */
export const SCENARIO_SCHEMA_VERSION = 1;

export const scenarioFileSchema = z.strictObject({
  schemaVersion: z.literal(
    SCENARIO_SCHEMA_VERSION,
    `Unsupported version; this build reads schemaVersion ${String(SCENARIO_SCHEMA_VERSION)}`,
  ),
  /** Shown on the scenario picker. */
  title: text(),
  /** One or two sentences describing the situation, shown under the title. */
  summary: text(),
  config: scenarioConfigSchema,
});
