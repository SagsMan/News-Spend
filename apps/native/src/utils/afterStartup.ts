import { useEffect, useState } from "react";

/**
 * Startup work that isn't first-paint work.
 *
 * Analytics, widget scheduling, ad SDK init and the like all used to fire in
 * the same tick as the first render. None of them are needed for the user to
 * see and touch the app, but all of them run on the JS thread, so they landed
 * squarely on the frames where the first screen is trying to mount — the app
 * appears, then stutters.
 *
 * Two animation frames, then a short settle. The first frame lands after the
 * current render commits, the second after it has actually presented, so the
 * first screen is on glass before any of this starts competing for the thread.
 *
 * This used to call `InteractionManager.runAfterInteractions`, which expresses
 * the same idea more directly. React Native 0.86 deprecates it — it warns at
 * runtime and is slated for removal — so the scheduling is built out of
 * `requestAnimationFrame` instead, which is standard and not going anywhere.
 *
 * If the app is backgrounded during startup the frames stop and the work waits
 * for the next foreground. That is the behaviour we want: none of it is urgent,
 * and none of it is worth doing while nobody is looking.
 */
const STARTUP_SETTLE_MS = 350;

export function runAfterStartup(task: () => void): () => void {
  let cancelled = false;
  let frame: number | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }
      timeout = setTimeout(task, STARTUP_SETTLE_MS);
    });
  });

  return () => {
    cancelled = true;
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    if (timeout) {
      clearTimeout(timeout);
    }
  };
}

/**
 * Flips to `true` once startup has settled, for gating effects that would
 * otherwise run during first paint.
 *
 * Returning a flag rather than taking a callback keeps the deferral compatible
 * with hooks, which cannot be called conditionally: the hook runs on every
 * render as usual, and only the work inside it waits.
 */
export function useAfterStartup(): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => runAfterStartup(() => setSettled(true)), []);

  return settled;
}
