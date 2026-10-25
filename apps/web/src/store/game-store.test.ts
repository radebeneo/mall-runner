import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './game-store';

beforeEach(() => {
  useGameStore.setState({ session: null, mode: 'RUNNER' });
});

function points(): number {
  const { session } = useGameStore.getState();
  if (session === null) throw new Error('No session.');
  return session.state.points;
}

describe('game store', () => {
  it('starts in the chosen mode and keeps it for the next run', () => {
    useGameStore.getState().start('DECISIONS');
    expect(useGameStore.getState().mode).toBe('DECISIONS');
    expect(useGameStore.getState().session).not.toBeNull();

    useGameStore.getState().start();
    expect(useGameStore.getState().mode).toBe('DECISIONS');
  });

  it('switches mode without ending the run', () => {
    useGameStore.getState().start('RUNNER');
    const { session } = useGameStore.getState();
    useGameStore.getState().setMode('DECISIONS');
    expect(useGameStore.getState().mode).toBe('DECISIONS');
    expect(useGameStore.getState().session).toBe(session);
  });

  it('banks runner points and keeps the month running', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().bankRunPoints(30);
    expect(points()).toBe(before + 30);
    expect(useGameStore.getState().session?.cycle.phase).toBe('RUNNING');
  });

  it('banks runner points when the shopping ends', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().finishRun(50);
    expect(points()).toBe(before + 50);
    expect(useGameStore.getState().session?.cycle.phase).not.toBe('RUNNING');
  });

  it('banks runner points before opening the offer', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().openRunOffer(20);
    expect(points()).toBe(before + 20);
    expect(useGameStore.getState().session?.cycle.phase).toBe('OFFER_CHECK');
  });
});
