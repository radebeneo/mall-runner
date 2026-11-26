import { describe, expect, it } from 'vitest';
import { createFrameSummary, createFrameTimer, formatPerf } from './frame-timer';

describe('frame timer', () => {
  it('summarises the gaps between ticks', () => {
    const timer = createFrameTimer();
    for (const now of [0, 10, 20, 40]) timer.tick(now);
    const summary = timer.summary(createFrameSummary());
    expect(summary.frames).toBe(3);
    expect(summary.averageMs).toBeCloseTo(40 / 3, 9);
    expect(summary.p95Ms).toBe(20);
    expect(summary.maxMs).toBe(20);
    expect(summary.fps).toBeCloseTo(75, 9);
  });

  it('keeps only the most recent frames', () => {
    const timer = createFrameTimer(2);
    for (const now of [0, 10, 30, 60]) timer.tick(now);
    const summary = timer.summary(createFrameSummary());
    expect(summary.frames).toBe(2);
    expect(summary.averageMs).toBe(25);
    expect(summary.maxMs).toBe(30);
  });

  it('forgets everything on restart, so a pause is not a long frame', () => {
    const timer = createFrameTimer();
    timer.tick(0);
    timer.tick(16);
    timer.restart();
    timer.tick(5000);
    const summary = timer.summary(createFrameSummary());
    expect(summary).toEqual({ frames: 0, averageMs: 0, p95Ms: 0, maxMs: 0, fps: 0 });
    timer.tick(5016);
    expect(timer.summary(summary).maxMs).toBe(16);
  });

  it('writes one readable line', () => {
    const line = formatPerf(
      { frames: 3, averageMs: 40 / 3, p95Ms: 20, maxMs: 20, fps: 75 },
      { drawCalls: 12, triangles: 34500, usesArt: true, pixelRatio: 2, width: 390, height: 844 },
    );
    expect(line).toBe(
      '75 fps · avg 13.3 ms · p95 20.0 ms · max 20.0 ms · 12 draws · 34.5k tris · art · dpr 2.00 · 390×844',
    );
  });
});
