import { useFocusEffect } from "@react-navigation/native";
import React from "react";

import { authState } from "#/state/auth";

export default function useTimeout(callback: () => void, delay: number | null) {
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useFocusEffect(
    React.useCallback(() => {
      if (!delay) {
        return;
      }
      const tick = () => savedCallback.current();
      if (typeof delay === "number" && authState.user) {
        timeoutRef.current = setTimeout(tick, delay);
        console.log(`running timer with delay ${delay ?? 0 / 1000} seconds`);

        return () => {
          console.log("clearing timer");
          clearTimeout(timeoutRef.current);
        };
      }
    }, [delay])
  );

  return timeoutRef;
}
