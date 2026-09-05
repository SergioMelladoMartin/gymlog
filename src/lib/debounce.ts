// Generic trailing-debounce-with-hard-cap scheduler. Extracted from
// sqlite.ts so the timing logic can be unit tested with fake timers
// without pulling in sqlite-wasm/OPFS/Drive.
//
// Used for the Drive push debounce: each mutation resets a short timer
// (`delayMs`), but a hard ceiling (`maxDelayMs`) measured from the FIRST
// pending change guarantees we never silently sit on unpushed edits
// forever during a long burst of activity.

export interface DebouncerOptions {
  delayMs: number;
  maxDelayMs: number;
  run: () => void;
  now?: () => number;
}

export interface DebouncedRunner {
  /** Call on every new pending change. Schedules `run()` after `delayMs`
   *  of inactivity, capped at `maxDelayMs` since the first `schedule()`
   *  in the current burst. */
  schedule(): void;
  /** Run immediately and reset the burst window. */
  flushNow(): void;
  /** Cancel any pending timer without running, and reset the burst window. */
  cancel(): void;
}

export function createDebouncedRunner(opts: DebouncerOptions): DebouncedRunner {
  const now = opts.now ?? (() => Date.now());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstPendingAt: number | null = null;

  function schedule(): void {
    const t = now();
    if (firstPendingAt == null) firstPendingAt = t;
    if (timer) clearTimeout(timer);
    const elapsed = t - firstPendingAt;
    const remainingHardCap = opts.maxDelayMs - elapsed;
    const delay = Math.max(0, Math.min(opts.delayMs, remainingHardCap));
    timer = setTimeout(() => {
      timer = null;
      firstPendingAt = null;
      opts.run();
    }, delay);
  }

  function flushNow(): void {
    if (timer) { clearTimeout(timer); timer = null; }
    firstPendingAt = null;
    opts.run();
  }

  function cancel(): void {
    if (timer) { clearTimeout(timer); timer = null; }
    firstPendingAt = null;
  }

  return { schedule, flushNow, cancel };
}
