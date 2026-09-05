import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedRunner } from '../src/lib/debounce';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncedRunner', () => {
  it('waits for the trailing delay before running once', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    vi.advanceTimersByTime(3_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('resets the trailing delay on every new schedule() call', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    vi.advanceTimersByTime(3_000);
    d.schedule(); // burst continues — timer restarts
    vi.advanceTimersByTime(3_000);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('enforces the hard cap even with continuous activity', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    // Re-schedule every 3s (never letting the 4s trailing delay elapse).
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(3_000);
      if (!run.mock.calls.length) d.schedule();
    }
    // 6 * 3s = 18s elapsed; the 20s hard cap should have fired by 20s
    // regardless of the continuous rescheduling.
    vi.advanceTimersByTime(2_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('flushNow runs immediately and cancels any pending timer', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    d.flushNow();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(1); // no double-fire from the cancelled timer
  });

  it('cancel drops a pending run without executing it', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    d.cancel();
    vi.advanceTimersByTime(30_000);
    expect(run).not.toHaveBeenCalled();
  });

  it('starts a fresh burst window after a run completes', () => {
    const run = vi.fn();
    const d = createDebouncedRunner({ delayMs: 4_000, maxDelayMs: 20_000, run });
    d.schedule();
    vi.advanceTimersByTime(4_000);
    expect(run).toHaveBeenCalledTimes(1);

    d.schedule();
    vi.advanceTimersByTime(3_999);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
