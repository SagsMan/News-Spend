import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { toast } from "#/components/heroui/toast";
import { isOnline } from "#/utils/networkState";

/**
 * How long the connection has to stay down before we say anything.
 *
 * Mobile data drops for a second or two constantly — handing off between
 * masts, riding a lift, a patchy signal. Announcing every one of those puts a
 * persistent error toast on screen for a blip the user never noticed and that
 * has usually resolved before they finish reading it. Anything shorter than a
 * few seconds turns the alert into flicker, which trains people to ignore it.
 */
const OFFLINE_GRACE_MS = 3000;

const OfflineAlert = () => {
  const isShowing = useRef(false);
  const toastId = useRef("");
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    const clearPending = () => {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = undefined;
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (isOnline(state)) {
        // Back before the grace period elapsed: the user never saw anything,
        // so there is nothing to reassure them about.
        clearPending();

        if (isShowing.current) {
          // Reusing the id morphs the persistent error into the success toast
          // rather than stacking a second one beside it.
          toast.success("You are back online.", {
            duration: 2000,
            id: toastId.current,
          });
          isShowing.current = false;
        }
        return;
      }

      // NetInfo emits repeatedly while offline. Without this guard each event
      // would queue another countdown, and every one of those would raise its
      // own persistent toast.
      if (isShowing.current || pendingTimer.current) {
        return;
      }

      pendingTimer.current = setTimeout(() => {
        pendingTimer.current = undefined;
        isShowing.current = true;
        toastId.current = toast.error(
          "You are offline. Please check your internet connection.",
          {
            duration: Number.POSITIVE_INFINITY,
            isSwipeable: false,
          }
        );
      }, OFFLINE_GRACE_MS);
    });

    return () => {
      clearPending();
      unsubscribe();
    };
  }, []);

  return null;
};

export default OfflineAlert;
