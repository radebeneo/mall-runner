import { describe, expect, it } from 'vitest';
import {
  MONTH_RUN_SECONDS,
  bankRun,
  confirmRepayment,
  createSession,
  decideOffer,
  endMonthRun,
  finishMonth,
  formatRunTimeLeft,
  fundEvent,
  isMonthRunOver,
  loadStarterScenario,
  openOffer,
  pendingOffer,
  runSecondsLeft,
  viewStatement,
  wholeRunSecondsLeft,
} from './session';
import type { Session } from './session';

function fresh(): Session {
  return createSession(loadStarterScenario());
}

describe('month timer', () => {
  it('keeps the month inside the brief’s 60 to 90 seconds of running', () => {
    expect(MONTH_RUN_SECONDS).toBeGreaterThanOrEqual(60);
    expect(MONTH_RUN_SECONDS).toBeLessThanOrEqual(90);
  });

  it('starts each run with the whole month to shop', () => {
    const session = fresh();
    expect(session.runSeconds).toBe(0);
    expect(runSecondsLeft(session)).toBe(MONTH_RUN_SECONDS);
    expect(isMonthRunOver(session)).toBe(false);
  });

  it('banks points and seconds together', () => {
    const session = fresh();
    const banked = bankRun(session, { points: 40, seconds: 30 });
    expect(banked.state.points).toBe(session.state.points + 40);
    expect(banked.runSeconds).toBe(30);
    expect(banked.cycle).toBe(session.cycle);
    expect(runSecondsLeft(banked)).toBe(MONTH_RUN_SECONDS - 30);
  });

  it('adds runs together, so a crash or the offer screen does not reset the clock', () => {
    let session = fresh();
    session = bankRun(session, { points: 0, seconds: 20 });
    session = bankRun(session, { points: 10, seconds: 25 });
    expect(session.runSeconds).toBe(45);
  });

  it('never banks more than the month holds', () => {
    const session = bankRun(fresh(), { points: 0, seconds: MONTH_RUN_SECONDS + 40 });
    expect(session.runSeconds).toBe(MONTH_RUN_SECONDS);
    expect(runSecondsLeft(session)).toBe(0);
  });

  it('counts unbanked runner seconds toward the end of the month', () => {
    const session = bankRun(fresh(), { points: 0, seconds: 50 });
    expect(isMonthRunOver(session, MONTH_RUN_SECONDS - 50 - 0.5)).toBe(false);
    expect(isMonthRunOver(session, MONTH_RUN_SECONDS - 50)).toBe(true);
    expect(runSecondsLeft(session, 1000)).toBe(0);
  });

  it('rounds the readout up, so it shows 0:00 only when the time is up', () => {
    const session = fresh();
    expect(wholeRunSecondsLeft(session)).toBe(MONTH_RUN_SECONDS);
    expect(wholeRunSecondsLeft(session, 0.2)).toBe(MONTH_RUN_SECONDS);
    expect(wholeRunSecondsLeft(session, 1)).toBe(MONTH_RUN_SECONDS - 1);
    expect(wholeRunSecondsLeft(session, MONTH_RUN_SECONDS - 0.01)).toBe(1);
    expect(wholeRunSecondsLeft(session, MONTH_RUN_SECONDS)).toBe(0);
    expect(wholeRunSecondsLeft(session, MONTH_RUN_SECONDS + 5)).toBe(0);
  });

  it('formats the time left as minutes and seconds', () => {
    expect(formatRunTimeLeft(75)).toBe('1:15');
    expect(formatRunTimeLeft(60)).toBe('1:00');
    expect(formatRunTimeLeft(9)).toBe('0:09');
    expect(formatRunTimeLeft(0)).toBe('0:00');
    expect(formatRunTimeLeft(-3)).toBe('0:00');
  });

  it('leaves the session alone when nothing was collected', () => {
    const session = fresh();
    expect(bankRun(session, { points: 0, seconds: 0 })).toBe(session);
  });

  it('refuses negative or invalid seconds', () => {
    expect(() => bankRun(fresh(), { points: 0, seconds: -1 })).toThrow();
    expect(() => bankRun(fresh(), { points: 0, seconds: Number.NaN })).toThrow();
  });

  it('keeps the banked time through the offer', () => {
    let session = bankRun(fresh(), { points: 0, seconds: 30 });
    if (pendingOffer(session) === undefined) throw new Error('The starter month 1 has an offer.');
    session = decideOffer(openOffer(session), false);
    expect(session.cycle.phase).toBe('RUNNING');
    expect(session.runSeconds).toBe(30);
  });

  it('gives the next month a fresh clock', () => {
    let session = bankRun(fresh(), { points: 0, seconds: MONTH_RUN_SECONDS });
    if (pendingOffer(session) !== undefined) session = decideOffer(openOffer(session), false);
    session = endMonthRun(session);
    while (session.cycle.phase === 'EVENT') session = fundEvent(session, 'EMERGENCY_SAVINGS');
    session = finishMonth(confirmRepayment(viewStatement(session), 'FULL'));
    expect(session.cycle.phase).toBe('RUNNING');
    expect(session.cycle.monthIndex).toBe(1);
    expect(session.runSeconds).toBe(0);
    expect(runSecondsLeft(session)).toBe(MONTH_RUN_SECONDS);
  });
});
