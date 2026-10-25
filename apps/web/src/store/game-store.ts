import type { FundingSource, RepaymentChoice } from '@credit-runner/finance-engine';
import { create } from 'zustand';
import * as run from '../session/session';
import type { Session } from '../session/session';

// UI and session state only. Per-frame runner values never go through this store
// (AGENTS.md section 7, rule 1).
export interface GameStore {
  /** The run in progress, or null on the title screen. */
  session: Session | null;
  start: () => void;
  reset: () => void;
  openOffer: () => void;
  decideOffer: (accepted: boolean) => void;
  endMonthRun: () => void;
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
    start: () => {
      set({ session: run.createSession(run.loadStarterScenario()) });
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
      update((session) => run.answerQuiz(session, questionId, optionId));
    },
    completeQuiz: () => {
      update(run.completeQuiz);
    },
  };
});
