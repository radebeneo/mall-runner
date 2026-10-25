import { describe, expect, it } from 'vitest';
import { bankRunPoints, createSession, hudPointsWithRun, loadStarterScenario } from './session';

describe('runner points', () => {
  it('shows coin points on top of the banked total without banking them', () => {
    const session = createSession(loadStarterScenario());
    const banked = session.state.points;
    expect(hudPointsWithRun(session, 40)).toBe(banked + 40);
    expect(hudPointsWithRun(session, 0)).toBe(banked);
    expect(session.state.points).toBe(banked);
  });

  it('banks coin points into the run total', () => {
    const session = createSession(loadStarterScenario());
    const banked = bankRunPoints(session, 30);
    expect(banked.state.points).toBe(session.state.points + 30);
    expect(banked.cycle).toBe(session.cycle);
  });

  it('leaves the session alone when there is nothing to bank', () => {
    const session = createSession(loadStarterScenario());
    expect(bankRunPoints(session, 0)).toBe(session);
  });
});
