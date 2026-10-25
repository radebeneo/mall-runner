/** Money is always a whole number of cents. Never fractional. */
export type Cents = number;

/** A calendar month, e.g. `{ year: 2026, month: 9 }` for September 2026. Dates are fictional. */
export interface CalendarMonth {
  year: number;
  /** 1 (January) to 12 (December). */
  month: number;
}

export interface CalendarDate extends CalendarMonth {
  day: number;
}

export interface StatementDates {
  /** The statement closes: purchases up to this date are on it. */
  closes: CalendarDate;
  /** The payment deadline for that statement. */
  due: CalendarDate;
}

/** An unexpected expense that may occur during a month. */
export interface ScenarioEvent {
  id: string;
  /** Zero-based month in which the event occurs. */
  monthIndex: number;
  title: string;
  /** How the charge reads on a statement when it goes on the card, e.g. "Pharmacy purchase". */
  statementLabel?: string | undefined;
  cost: Cents;
}

/** An instalment ("buy now, pay monthly") offer triggered by a pickup. */
export interface ScenarioOffer {
  id: string;
  /** Zero-based month in which the offer can appear. */
  monthIndex: number;
  title: string;
  /** Price if the item were bought outright today. */
  cashPrice: Cents;
  monthlyInstalment: Cents;
  termMonths: number;
  /** Once-off fee, charged to the card when the offer is accepted. */
  upfrontFee: Cents;
  /** Fee added to every monthly instalment. */
  monthlyFee: Cents;
}

/** A card purchase scheduled for a month. Stands in for mall shopping in decisions-only mode. */
export interface ScenarioPurchase {
  id: string;
  /** Zero-based month in which the purchase is made. */
  monthIndex: number;
  label: string;
  amount: Cents;
}

export interface ScenarioConfig {
  id: string;
  months: number;
  /** The calendar month in which the first statement closes. */
  startMonth: CalendarMonth;
  creditLimit: Cents;
  /** Money left each month after essentials such as rent and food, e.g. 190000. */
  monthlyAfterEssentials: Cents;
  /** Fixed monthly commitments already in place, e.g. 57900. */
  existingCommitments: Cents;
  emergencySavings: Cents;
  /** Fraction of the statement balance due as a minimum, e.g. 0.05. */
  minimumPaymentRate: number;
  /** Fictional monthly rate applied to any unpaid balance. */
  monthlyInterestRate: number;
  /** Fictional fee charged when less than the minimum is paid. */
  latePaymentFee: Cents;
  statementCloseDay: number;
  paymentDueDay: number;
  purchases: readonly ScenarioPurchase[];
  events: readonly ScenarioEvent[];
  offers: readonly ScenarioOffer[];
}

/** An accepted instalment offer that still has payments left. */
export interface ActiveInstalment {
  offerId: string;
  monthlyCost: Cents;
  monthsRemaining: number;
}

export interface MonthState {
  monthIndex: number;
  /** Monthly money after essentials. Copied from the scenario so offers can be evaluated. */
  monthlyAfterEssentials: Cents;
  /** Everything currently owed on the card, including charges made this month. */
  cardBalance: Cents;
  spendingAccount: Cents;
  emergencySavings: Cents;
  /** Total fixed monthly commitments, including active instalments. */
  commitments: Cents;
  /** The part of `cardBalance` carried over from the previous statement. */
  carriedForward: Cents;
  instalments: readonly ActiveInstalment[];
  /** Game points. A separate scale from money; never display as currency. */
  points: number;
}

/** A card purchase made during the month (for example mall shopping in the runner). */
export interface Purchase {
  id: string;
  label: string;
  amount: Cents;
}

/** The scenario terms a statement needs. Snapshotted onto each statement. */
export interface StatementTerms {
  creditLimit: Cents;
  minimumPaymentRate: number;
  monthlyInterestRate: number;
  latePaymentFee: Cents;
  statementCloseDay: number;
  paymentDueDay: number;
  startMonth: CalendarMonth;
}

export interface Statement {
  monthIndex: number;
  /** Balance carried over from the previous statement, including interest and fees. */
  openingBalance: Cents;
  purchases: readonly Purchase[];
  purchasesTotal: Cents;
  /** All new charges this month: purchases plus anything else put on the card. */
  newCharges: Cents;
  /** The full statement balance. Paying this by the due date keeps the interest-free period. */
  balance: Cents;
  minimumDue: Cents;
  creditLimit: Cents;
  availableCredit: Cents;
  /** balance / creditLimit as a fraction, e.g. 0.248. */
  utilisation: number;
  /** Utilisation rounded to a whole percentage, e.g. 25. */
  utilisationPercent: number;
  overLimit: boolean;
  closeDay: number;
  dueDay: number;
  closeDate: CalendarDate;
  dueDate: CalendarDate;
  terms: StatementTerms;
}

/** A charge put on the card that is not a purchase, e.g. an unexpected expense or an offer fee. */
export interface CardCharge {
  id: string;
  label: string;
  amount: Cents;
}

export type StatementLineKind = 'BROUGHT_FORWARD' | 'PURCHASE' | 'CHARGE' | 'OTHER';

/** One labelled line of a statement. A statement's lines always add up to its balance. */
export interface StatementLine {
  id: string;
  kind: StatementLineKind;
  label: string;
  amount: Cents;
}

export type RepaymentChoice = 'FULL' | 'HALF' | 'MINIMUM' | 'NONE';

export interface RepaymentOutcome {
  choice: RepaymentChoice;
  statementBalance: Cents;
  minimumDue: Cents;
  /** What the chosen option asks the player to pay. */
  requested: Cents;
  /** What was actually paid. Never more than the spending account held. */
  paid: Cents;
  /** requested - paid. Non-zero means the player could not afford the choice. */
  shortfall: Cents;
  /** Statement balance still owed after the payment. */
  remainingOwed: Cents;
  /** True only when the full statement balance was paid. */
  interestFreeKept: boolean;
  interestCharged: Cents;
  /** True when less than the minimum was paid. */
  missedPayment: boolean;
  lateFee: Cents;
  /** Next month's opening balance: remaining + interest + late fee. */
  nextOpeningBalance: Cents;
  spendingAccountAfter: Cents;
}

export interface OfferImpact {
  offerId: string;
  /** Instalment plus monthly fee. */
  monthlyCost: Cents;
  termMonths: number;
  /** Everything the player would pay over the full term, including fees. */
  totalPayable: Cents;
  totalFees: Cents;
  /** totalPayable - cashPrice. Can include costs built into the instalment. */
  extraCostVsCash: Cents;
  upfrontFee: Cents;
  commitmentsBefore: Cents;
  commitmentsAfter: Cents;
  /** Monthly money after essentials and commitments, before the offer. */
  budgetBefore: Cents;
  /** Monthly money after essentials and commitments, after the offer, before card repayments. */
  budgetRemaining: Cents;
  affordable: boolean;
}

export type FundingSource = 'EMERGENCY_SAVINGS' | 'SPENDING_ACCOUNT' | 'CARD';

export interface EventFunding {
  eventId: string;
  cost: Cents;
  source: FundingSource;
  fromSavings: Cents;
  fromSpending: Cents;
  toCard: Cents;
  /** True when the chosen source could not cover the cost and the rest went on the card. */
  fellBackToCard: boolean;
}

export type Decision =
  | { kind: 'REPAYMENT'; outcome: RepaymentOutcome }
  | { kind: 'OFFER'; accepted: boolean; impact: OfferImpact }
  | { kind: 'EVENT_FUNDING'; funding: EventFunding }
  | { kind: 'QUIZ'; correct: boolean };

export interface OfferDecision {
  accepted: boolean;
  impact: OfferImpact;
}

export interface QuizAnswer {
  questionId: string;
  correct: boolean;
}

/** Every decision made in a run, in order. */
export interface RunRecord {
  repayments: readonly RepaymentOutcome[];
  eventFundings: readonly EventFunding[];
  offerDecisions: readonly OfferDecision[];
  quizAnswers: readonly QuizAnswer[];
}

/** Totals for the end-of-run summary. */
export interface RunSummary {
  statements: number;
  statementsPaidInFull: number;
  missedPayments: number;
  totalRepaid: Cents;
  interestCharged: Cents;
  lateFees: Cents;
  unexpectedCosts: Cents;
  paidFromSavings: Cents;
  paidFromSpending: Cents;
  putOnCard: Cents;
  offersAccepted: number;
  offersDeclined: number;
  /** Monthly cost of every accepted offer. */
  newMonthlyCommitments: Cents;
  /** Total payable over the full term of every accepted offer. */
  totalPayableAccepted: Cents;
  quizCorrect: number;
  quizTotal: number;
}
