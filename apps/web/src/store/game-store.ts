import type { FundingSource, RepaymentChoice } from '@credit-runner/finance-engine';
import { create } from 'zustand';
import * as run from '../session/session';
import type { Session } from '../session/session';

/**
 * How each month's shopping is played: RUNNER runs the 3D mall, DECISIONS skips straight to the
 * money choices (AGENTS.md section 7, rule 7).
 */
export type PlayMode = 'RUNNER' | 'DECISIONS';

// UI and session state only. Per-frame runner values never go through this store
// (AGENTS.md section 7, rule 1).
export interface GameStore {
  /** The run in progress, or null on the title screen. */
  session: Session | null;
  /** The play mode for this run and the next. */
  mode: PlayMode;
  /** Starts a new run, in `mode` when given and otherwise in the current mode. */
  start: (mode?: PlayMode) => void;
  setMode: (mode: PlayMode) => void;
  reset: () => void;
  openOffer: () => void;
  decideOffer: (accepted: boolean) => void;
  endMonthRun: () => void;
  /** Adds the runner's coin points to the run's total, e.g. before running again after a crash. */
  bankRunPoints: (points: number) => void;
  /** Banks the runner's coin points and ends the month's shopping. */
  finishRun: (points: number) => void;
  /** Banks the runner's coin points and opens the month's offer. */
  openRunOffer: (points: number) => void;
  fundEvent: (source: FundingSource) => void;
  viewStatement: () => void;
  confirmRepayment: (choice: RepaymentChoice) => void;
  finishMonth: () => void;
  answerQuiz: (questionId: string, optionId: string) => void;
  completeQuiz: () => void;
}

export const useGameStore = create<GameStore>()((set, get) => {
  const update = (step: (current: Session) => Session): void => {
    const current = get().session;
    if (current === null) throw new Error('No run is in progress.');
    set({ session: step(current) });
  };

  return {
    session: null,
    mode: 'RUNNER',
    start: (mode) => {
      set((store) => ({
        mode: mode ?? store.mode,
        session: run.createSession(run.loadStarterScenario()),
      }));
    },
    setMode: (mode) => {
      set({ mode });
    },
    reset: () => {
      set({ session: null });
    },
    openOffer: () => {
      update(run.openOffer);
    },
    decideOffer: (accepted) => {
      update((session) => run.decideOffer(session, accepted));
    },
    endMonthRun: () => {
      update(run.endMonthRun);
    },
    bankRunPoints: (points) => {
      update((session) => run.bankRunPoints(session, points));
    },
    finishRun: (points) => {
      update((session) => run.endMonthRun(run.bankRunPoints(session, points)));
    },
    openRunOffer: (points) => {
      update((session) => run.openOffer(run.bankRunPoints(session, points)));
    },
    fundEvent: (source) => {
      update((session) => run.fundEvent(session, source));
    },
    viewStatement: () => {
      update(run.viewStatement);
    },
    confirmRepayment: (choice) => {
      update((session) => run.confirmRepayment(session, choice));
    },
    finishMonth: () => {
      update(run.finishMonth);
    },
    answerQuiz: (questionId, optionId) => {
      // The last answer ends the quiz, so the finish screen shows the run summary in place.
      update((session) => {
        const answered = run.answerQuiz(session, questionId, optionId);
        return run.nextQuizQuestion(answered) === undefined ? run.completeQuiz(answered) : answered;
      });
    },
    completeQuiz: () => {
      update(run.completeQuiz);
    },
  };
});
