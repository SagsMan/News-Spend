import { useEffect, useRef, useState } from "react";

type UseAdCountdownOptions = {
  duration: number;
  enabled: boolean;
  onComplete?: () => void;
};

type UseAdCountdownReturn = {
  countdown: number;
  hasCompleted: boolean;
  reset: () => void;
};

/**
 * Counts down from `duration` to 0 while `enabled` is true.
 * Fires `onComplete` exactly once when it reaches 0.
 * Call `reset()` to restart the countdown (e.g. after the dialog closes).
 */
export function useAdCountdown({
  duration,
  enabled,
  onComplete,
}: UseAdCountdownOptions): UseAdCountdownReturn {
  const [countdown, setCountdown] = useState(duration);
  const [hasCompleted, setHasCompleted] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!enabled || countdown <= 0) {
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [enabled, countdown]);

  useEffect(() => {
    if (enabled && countdown === 0 && !hasCompleted) {
      setHasCompleted(true);
      onCompleteRef.current?.();
    }
  }, [enabled, countdown, hasCompleted]);

  const reset = () => {
    setCountdown(duration);
    setHasCompleted(false);
  };

  return { countdown, hasCompleted, reset };
}
