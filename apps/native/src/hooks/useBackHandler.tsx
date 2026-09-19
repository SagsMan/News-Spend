import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

export function useFocusBackHandler(handler: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handler
      );
      return () => subscription.remove();
    }, [handler])
  );
}

export function useGlobalBackHandler(handler: () => boolean) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handler
    );
    return () => subscription.remove();
  }, [handler]);
}
