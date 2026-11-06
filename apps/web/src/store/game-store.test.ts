import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '../session/session';
import { useGameStore } from './game-store';

beforeEach(() => {
  useGameStore.setState({ session: null, mode: 'RUNNER' });
});

function current(): Session {
  const { session } = useGameStore.getState();
  if (session === null) throw new Error('No session.');
  return session;
}

function points(): number {
  return current().state.points;
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

  it('banks runner points and time and keeps the month running', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().bankRun({ points: 30, seconds: 20 });
    expect(points()).toBe(before + 30);
    expect(current().runSeconds).toBe(20);
    expect(current().cycle.phase).toBe('RUNNING');
  });

  it('banks runner progress when the shopping ends', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().finishRun({ points: 50, seconds: 12 });
    expect(points()).toBe(before + 50);
    expect(current().cycle.phase).not.toBe('RUNNING');
  });

  it('banks runner progress before opening the offer', () => {
    useGameStore.getState().start('RUNNER');
    const before = points();
    useGameStore.getState().openRunOffer({ points: 20, seconds: 5 });
    expect(points()).toBe(before + 20);
    expect(current().runSeconds).toBe(5);
    expect(current().cycle.phase).toBe('OFFER_CHECK');
  });
});
