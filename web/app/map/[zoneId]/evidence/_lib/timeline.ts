/**
 * Pure helpers for the evidence page's July timeline. No React, so they
 * are unit tested directly (timeline.test.ts).
 */

/** Parses the manifest's "YYYY-MM-DD to YYYY-MM-DD" event window. */
export function parseEventWindow(
  value: string,
): { start: string; end: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, start, end] = match;
  return start <= end ? { start, end } : null;
}

/**
 * Inclusive index runs where `flags` is true: [F, T, T, F, T] gives
 * [{start: 1, end: 2}, {start: 4, end: 4}]. Used to draw one bracket per
 * unbroken stretch (the event window, the optical blackout) instead of one
 * per day.
 */
export function contiguousRuns(flags: readonly boolean[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start = -1;
  flags.forEach((flag, index) => {
    if (flag && start === -1) start = index;
    if (!flag && start !== -1) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  });
  if (start !== -1) runs.push({ start, end: flags.length - 1 });
  return runs;
}

/** "2026-07-09" -> 9. Parsed by hand so no timezone can shift it. */
export function dayOfMonth(iso: string): number {
  const match = /^\d{4}-\d{2}-(\d{2})/.exec(iso);
  return match ? Number(match[1]) : NaN;
}

/**
 * The median-filter window out of the manifest's despeckle note
 * ("A 15x15 median filter ..."), so the page never restates it by hand.
 * Null when the note does not name one.
 */
export function despeckleWindow(note: string): { width: number; height: number } | null {
  const match = /(\d+)\s*[x×]\s*(\d+)/.exec(note);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}
