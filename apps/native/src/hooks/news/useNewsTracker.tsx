import type { Activity, News } from "@news-spend-media/payload/types";
import { useFocusEffect } from "@react-navigation/native";
import { isSameDay } from "date-fns/isSameDay";
import { useCallback, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSnapshot } from "valtio";

import { authState } from "#/state/auth";

const SCROLL_THRESHOLD = 0.85;
const RAPID_SCROLL_THRESHOLD = 120;
const SPEED_WINDOW = 10;
const INACTIVITY_TIMEOUT_MS = 5000;
export const MIN_READING_SECONDS = 90;

export function useReadingTracker(
  data: News,
  userPointData: Activity[] | undefined
) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasScrolledThreshold, setHasScrolledThreshold] = useState(false);
  const [inRapidScroll, setInRapidScroll] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledThresholdRef = useRef(false);
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef<number | null>(null);
  const speedSamples = useRef<number[]>([]);
  const { user } = useSnapshot(authState);

  const stopTracking = useCallback(() => {
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (intervalId.current) {
      return;
    }
    intervalId.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev >= MIN_READING_SECONDS) {
          stopTracking();
          return MIN_READING_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
    setIsTracking(true);
  }, [stopTracking]);

  const resetInactivityTimer = useCallback(() => {
    // Once 85% threshold is reached, don't pause the timer for inactivity
    if (hasScrolledThresholdRef.current) {
      return;
    }
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      stopTracking();
      inactivityTimer.current = null;
    }, INACTIVITY_TIMEOUT_MS);
  }, [stopTracking]);

  useFocusEffect(
    useCallback(() => {
      const dailyRead = (user?.dailyRead as unknown as {
        count: number;
        updatedAt: Date;
      }) ?? { count: 0, updatedAt: new Date() };

      const readCountToday = isSameDay(dailyRead.updatedAt, new Date())
        ? dailyRead.count
        : 0;

      if (!(data && user) || userPointData?.length || readCountToday >= 5) {
        return;
      }

      // Reset all state on focus: timer starts on first scroll
      setElapsedSeconds(0);
      setHasScrolledThreshold(false);
      setInRapidScroll(false);
      setIsTracking(false);
      hasScrolledThresholdRef.current = false;
      lastScrollY.current = 0;
      lastScrollTime.current = null;
      speedSamples.current = [];

      return () => {
        stopTracking();
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      };
    }, [data, user, userPointData, stopTracking])
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const scrollY = contentOffset.y;
      const currentTime = Date.now();

      // Track scroll depth threshold
      const scrolledPercentage =
        (scrollY + layoutMeasurement.height) / contentSize.height;
      if (!hasScrolledThreshold && scrolledPercentage >= SCROLL_THRESHOLD) {
        setHasScrolledThreshold(true);
        hasScrolledThresholdRef.current = true;
      }

      // Start or resume timer on scroll activity
      if (!(inRapidScroll || intervalId.current)) {
        startTracking();
      }
      resetInactivityTimer();

      // Rolling average speed: wait until window is full before judging
      if (lastScrollTime.current !== null) {
        const timeDiff = currentTime - lastScrollTime.current;
        const offsetDiff = Math.abs(scrollY - lastScrollY.current);
        const speed = offsetDiff / timeDiff;

        speedSamples.current.push(speed);
        if (speedSamples.current.length > SPEED_WINDOW) {
          speedSamples.current.shift();
        }

        // Don't judge until window is full
        if (speedSamples.current.length < SPEED_WINDOW) {
          lastScrollY.current = scrollY;
          lastScrollTime.current = currentTime;
          return;
        }

        const avgSpeed =
          speedSamples.current.reduce((a, b) => a + b, 0) /
          speedSamples.current.length;

        if (avgSpeed > RAPID_SCROLL_THRESHOLD) {
          if (!inRapidScroll) {
            console.log(
              "[ReadingTracker] Rapid scroll detected: pausing timer"
            );
            stopTracking();
            setInRapidScroll(true);
          }
        } else if (inRapidScroll && avgSpeed < RAPID_SCROLL_THRESHOLD * 0.5) {
          setInRapidScroll(false);
          startTracking();
        }
      }

      lastScrollY.current = scrollY;
      lastScrollTime.current = currentTime;
    },
    [
      hasScrolledThreshold,
      inRapidScroll,
      startTracking,
      stopTracking,
      resetInactivityTimer,
    ]
  );

  return {
    elapsedSeconds,
    minReadingSeconds: MIN_READING_SECONDS,
    hasScrolledThreshold,
    inRapidScroll,
    isTracking,
    handleScroll,
    stopTracking,
  };
}
