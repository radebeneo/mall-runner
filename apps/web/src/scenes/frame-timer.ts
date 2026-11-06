// Frame-time sampling for the opt-in `?perf` readout on the run screen. Fixed buffers, so ticking
// never allocates; the summary is read about once a second.

export interface FrameSummary {
  frames: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  fps: number;
}

export interface FrameTimer {
  /** Records the time since the previous tick. `now` is in milliseconds. */
  tick: (now: number) => void;
  /** Forgets the samples, for example after a pause, so the gap is not counted. */
  restart: () => void;
  /** Writes the recent frames' summary into `out` and returns it. */
  summary: (out: FrameSummary) => FrameSummary;
}

export function createFrameSummary(): FrameSummary {
  return { frames: 0, averageMs: 0, p95Ms: 0, maxMs: 0, fps: 0 };
}

export function createFrameTimer(capacity = 240): FrameTimer {
  const samples = new Float64Array(capacity);
  const sorted = new Float64Array(capacity);
  let count = 0;
  let next = 0;
  let last = Number.NaN;

  return {
    tick: (now) => {
      if (!Number.isNaN(last)) {
        samples[next] = now - last;
        next = (next + 1) % capacity;
        if (count < capacity) count += 1;
      }
      last = now;
    },
    restart: () => {
      count = 0;
      next = 0;
      last = Number.NaN;
    },
    summary: (out) => {
      out.frames = count;
      if (count === 0) {
        out.averageMs = 0;
        out.p95Ms = 0;
        out.maxMs = 0;
        out.fps = 0;
        return out;
      }
      let total = 0;
      for (let i = 0; i < count; i++) {
        const sample = samples[i] ?? 0;
        sorted[i] = sample;
        total += sample;
      }
      const view = sorted.subarray(0, count).sort();
      out.averageMs = total / count;
      out.p95Ms = view[Math.max(0, Math.ceil(count * 0.95) - 1)] ?? 0;
      out.maxMs = view[count - 1] ?? 0;
      out.fps = out.averageMs > 0 ? 1000 / out.averageMs : 0;
      return out;
    },
  };
}

export interface PerfContext {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly usesArt: boolean;
  readonly pixelRatio: number;
  readonly width: number;
  readonly height: number;
}

/** One line for the readout, such as `60 fps · avg 16.7 ms · p95 18.0 ms · …`. */
export function formatPerf(summary: FrameSummary, context: PerfContext): string {
  return [
    `${summary.fps.toFixed(0)} fps`,
    `avg ${summary.averageMs.toFixed(1)} ms`,
    `p95 ${summary.p95Ms.toFixed(1)} ms`,
    `max ${summary.maxMs.toFixed(1)} ms`,
    `${String(context.drawCalls)} draws`,
    `${(context.triangles / 1000).toFixed(1)}k tris`,
    context.usesArt ? 'art' : 'procedural',
    `dpr ${context.pixelRatio.toFixed(2)}`,
    `${String(context.width)}×${String(context.height)}`,
  ].join(' · ');
}
