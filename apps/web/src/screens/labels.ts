import type { FundingSource, RepaymentChoice } from '@credit-runner/finance-engine';

export const REPAYMENT_TITLES: Record<RepaymentChoice, string> = {
  FULL: 'Pay the full balance',
  HALF: 'Pay half',
  MINIMUM: 'Pay the minimum',
  NONE: 'Pay nothing this month',
};

export const FUNDING_TITLES: Record<FundingSource, string> = {
  EMERGENCY_SAVINGS: 'Use emergency savings',
  SPENDING_ACCOUNT: 'Pay from my spending account',
  CARD: 'Put it on the card',
};
