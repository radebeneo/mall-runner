// The final quiz. Each question checks one learning goal from AGENTS.md section 3. The text
// contains no amounts. Dates are placeholders ({statementCloses}, {paymentDue}) filled from the
// finance engine, so no number in the quiz bypasses it.

export type LearningGoal =
  | 'CLOSING_VS_DUE'
  | 'MINIMUM_PAYMENT'
  | 'INTEREST_FREE'
  | 'TOTAL_PAYABLE'
  | 'EMERGENCY_SAVINGS'
  | 'UTILISATION';

export const LEARNING_GOALS: readonly LearningGoal[] = [
  'CLOSING_VS_DUE',
  'MINIMUM_PAYMENT',
  'INTEREST_FREE',
  'TOTAL_PAYABLE',
  'EMERGENCY_SAVINGS',
  'UTILISATION',
];

export interface QuizOption {
  id: string;
  text: string;
  /** A second line under the text, e.g. "(Payment due)". */
  detail?: string;
}

/** `stack`: one option per row. `pair`: two options side by side, as for the two dates. */
export type QuizLayout = 'stack' | 'pair';

export interface QuizQuestion {
  id: string;
  goal: LearningGoal;
  prompt: string;
  options: readonly QuizOption[];
  correctOptionId: string;
  /** Shown after the player answers, whether they were right or not. */
  explanation: string;
  layout?: QuizLayout;
}

/** Formatted dates the quiz text can refer to, e.g. "30 September". */
export interface QuizDates {
  statementCloses: string;
  paymentDue: string;
}

/** Replaces the date placeholders in quiz text with the engine's dates. */
export function fillQuizText(text: string, dates: QuizDates): string {
  return text
    .split('{statementCloses}')
    .join(dates.statementCloses)
    .split('{paymentDue}')
    .join(dates.paymentDue);
}

// The first two questions follow finish-with-understanding-screen.png word for word.
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'minimum-payment',
    goal: 'MINIMUM_PAYMENT',
    prompt:
      'You can afford the minimum payment, but not the full statement balance. What should you understand?',
    options: [
      {
        id: 'a',
        text: 'Paying the minimum by the due date avoids missing the required payment, but the remaining debt can attract interest.',
      },
      { id: 'b', text: 'If you pay the minimum, you won’t pay any interest.' },
      { id: 'c', text: 'You must pay in full every month or your card will be cancelled.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The minimum keeps your account in good standing, but whatever you leave unpaid carries over and can grow with interest.',
  },
  {
    id: 'closing-vs-due',
    goal: 'CLOSING_VS_DUE',
    prompt: 'Which date is the deadline for payment?',
    layout: 'pair',
    options: [
      { id: 'a', text: '{statementCloses}', detail: '(Statement closes)' },
      { id: 'b', text: '{paymentDue}', detail: '(Payment due)' },
    ],
    correctOptionId: 'b',
    explanation:
      'Purchases up to {statementCloses} appear on the statement. You then have until {paymentDue} to pay it.',
  },
  {
    id: 'interest-free',
    goal: 'INTEREST_FREE',
    prompt: 'When does the interest-free period apply?',
    options: [
      {
        id: 'a',
        text: 'Only when you pay the full statement balance by the due date.',
      },
      { id: 'b', text: 'Whenever you pay at least the minimum.' },
      { id: 'c', text: 'Always, for as long as you have the card.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Paying the full statement balance by the due date keeps the interest-free period. Paying less means interest can be added.',
  },
  {
    id: 'total-payable',
    goal: 'TOTAL_PAYABLE',
    prompt: 'An instalment offer shows a low monthly amount. What should you check first?',
    options: [
      { id: 'a', text: 'Only the monthly amount, because that is what you pay.' },
      { id: 'b', text: 'Whether the first month is free.' },
      { id: 'c', text: 'The total payable over the full term, including fees.' },
    ],
    correctOptionId: 'c',
    explanation:
      'A small monthly amount can hide a large total. Compare the total payable with the cash price, and check what it leaves in your budget.',
  },
  {
    id: 'emergency-savings',
    goal: 'EMERGENCY_SAVINGS',
    prompt: 'An unexpected bill arrives. Why can emergency savings help?',
    options: [
      { id: 'a', text: 'Paying from savings avoids new debt that could attract interest.' },
      { id: 'b', text: 'Savings earn extra interest when you spend them.' },
      { id: 'c', text: 'Borrowing is always cheaper than using savings.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Putting a surprise cost on the card adds to what you owe. An emergency fund lets you pay it without borrowing.',
  },
  {
    id: 'utilisation',
    goal: 'UTILISATION',
    prompt: 'How should you think about credit utilisation?',
    options: [
      { id: 'a', text: 'As a target you must hit exactly every month.' },
      {
        id: 'b',
        text: 'As a guide to how much of your limit you are using, not a strict rule.',
      },
      { id: 'c', text: 'It does not matter at all.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Utilisation shows how much of your credit limit you are using. Lower is generally easier to manage, but it is a guide, not a rule.',
  },
];

export function findQuestion(questionId: string): QuizQuestion {
  const question = QUIZ_QUESTIONS.find((item) => item.id === questionId);
  if (question === undefined) throw new RangeError(`Unknown quiz question "${questionId}".`);
  return question;
}

export function isCorrectAnswer(question: QuizQuestion, optionId: string): boolean {
  if (!question.options.some((option) => option.id === optionId)) {
    throw new RangeError(`Question "${question.id}" has no option "${optionId}".`);
  }
  return optionId === question.correctOptionId;
}
