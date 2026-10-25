import type { FundingSource, RepaymentChoice } from '@credit-runner/finance-engine';
import type { IconName, TileTone } from '@credit-runner/ui';

export const REPAYMENT_TITLES: Record<RepaymentChoice, string> = {
  FULL: 'Pay the statement in full',
  HALF: 'Pay half',
  MINIMUM: 'Pay the example minimum',
  NONE: 'Make no payment',
};

/** The coloured tiles on the pay-plan cards, as in the repayment mockup. */
export const REPAYMENT_ICONS: Record<RepaymentChoice, { name: IconName; tone: TileTone }> = {
  FULL: { name: 'wallet', tone: 'green' },
  HALF: { name: 'pie', tone: 'amber' },
  MINIMUM: { name: 'calculator', tone: 'purple' },
  NONE: { name: 'calendar-x', tone: 'red' },
};

export const FUNDING_TITLES: Record<FundingSource, string> = {
  EMERGENCY_SAVINGS: 'Use emergency savings',
  SPENDING_ACCOUNT: 'Pay from my spending account',
  CARD: 'Use the card',
};
