import type { PartnerContent } from "@news-spend-media/payload/types";
import { Dialog } from "heroui-native/dialog";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { XIcon } from "#/lib/icons";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";

import { Button } from "#/components/heroui/button";
import { Text } from "#/components/heroui/text";
import { useAdCountdown } from "#/hooks/discover/useAdCountdown";
import { useGoogleAd } from "#/hooks/discover/useGoogleAd";
import { usePartnerAd } from "#/hooks/discover/usePartnerAd";
import { useGlobalBackHandler } from "#/hooks/useBackHandler";
import { navigate } from "#/navigation/navigationUtils";

import { PartnerAdContent } from "./partner-ad-content";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartnerAdDialogProps = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  /** Receives the partner item watched, or undefined for a Google ad. */
  onCountdownComplete?: (ad?: PartnerContent) => void;
  countdownDuration?: number;
  showAdLabel?: boolean;
  children?: ReactNode;
  triggerText?: string;
  triggerProps?: React.ComponentProps<typeof Button>;
  asChild?: boolean;
  onAdClick?: (ad: unknown) => void;
  onClose?: () => void;
  onOpen?: () => undefined | boolean;
  /** When true, hides the trigger button (useful when controlled externally) */
  hideTrigger?: boolean;
  /** When false, doesn't navigate to LuckyAppWall when ads unavailable (default: true) */
  fallbackToAppWall?: boolean;
  /**
   * Pin the rotation to one kind of advertisement instead of sampling it.
   *
   * For callers that must know in advance whether an ad can be shown: the
   * giveaway reveal sequences itself around the answer.
   */
  preferAdType?: "custom" | "native";
  /** Serving this so a Boost can be earned; see `usePartnerAd`. */
  forBoost?: boolean;
  /**
   * There was genuinely nothing to show, as opposed to nothing yet.
   *
   * Opt-in: without it the dialog just falls back to the Lucky App Wall, which
   * from the outside is indistinguishable from the ad failing to load. A
   * caller that passes this can say why the person is being moved.
   */
  onUnavailable?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PartnerAdDialog({
  open: externalOpen,
  setOpen: externalSetOpen,
  onCountdownComplete,
  countdownDuration = 15,
  showAdLabel = true,
  children,
  triggerText = "Show Ad",
  triggerProps = {},
  onAdClick,
  asChild = false,
  onClose,
  onOpen,
  hideTrigger = false,
  fallbackToAppWall = true,
  preferAdType,
  forBoost,
  onUnavailable,
}: PartnerAdDialogProps) {
  const { width } = useWindowDimensions();

  // ── Ad resolution ────────────────────────────────────────────────────────────
  const { ad, adType, isLoading, refetchAd, cycleAdType } = usePartnerAd({
    forBoost,
    forceType: preferAdType,
  });

  // ── Dialog open state ────────────────────────────────────────────────────────
  const [internalOpen, setInternalOpen] = useState(false);

  /**
   * Whether there is actually something to render.
   *
   * The trigger path checks this inside `handleOpenChange` before opening. An
   * external `open` never goes through that path, so a caller that sets it
   * while the rotation is on a Google ad (or before any partner item has
   * loaded), used to get a modal with nothing in it. The check lives here,
   * where both paths meet.
   */
  const showable = adType === "custom" && Boolean(ad);
  const isOpen = (externalOpen ?? internalOpen) && showable;
  const setIsOpen = externalSetOpen ?? setInternalOpen;

  /**
   * The completed ad is handed to the caller, not just the fact of completion.
   *
   * A giveaway Boost is recorded against the specific partner item watched.
   * Three boosts means three different items, and the engine refuses a repeat,
   * so a caller that only learns "an ad finished" has nothing to record.
   * A Google ad has no partner-content record, so it reports `undefined` and
   * the caller decides what that is worth.
   */
  const { countdown, reset: resetCountdown } = useAdCountdown({
    duration: countdownDuration,
    enabled: isOpen && adType === "custom",
    onComplete: () => onCountdownComplete?.(ad),
  });

  // ── Google ad ────────────────────────────────────────────────────────────────
  const googleAd = useGoogleAd({
    onRewarded: () => onCountdownComplete?.(undefined),
    onClosed: cycleAdType,
  });

  // ── YouTube state (kept here so it resets with dialog) ───────────────────────
  const [ytPlaying, setYtPlaying] = useState(false);
  const onYtStateChange = useCallback((state: string) => {
    if (state === "ended") {
      setYtPlaying(false);
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Always call this after the dialog has been confirmed to close. */
  const handleDidClose = useCallback(() => {
    setIsOpen(false);
    resetCountdown();
    refetchAd();
    cycleAdType();
    onClose?.();
  }, [setIsOpen, resetCountdown, refetchAd, cycleAdType, onClose]);

  /**
   * Hand control straight back when opened from outside with nothing to show.
   *
   * A caller that sets `open` is waiting on `onClose` to know the ad is done.
   * Without this it would wait forever on a dialog that is never going to
   * appear. Waits out `isLoading` first, so a slow fetch is not mistaken for
   * an empty one, and fires once per open so `refetchAd` cannot re-trigger it.
   */
  const handedBack = useRef(false);
  useEffect(() => {
    if (!externalOpen) {
      handedBack.current = false;
      return;
    }
    if (showable || isLoading || handedBack.current) {
      return;
    }
    handedBack.current = true;
    handleDidClose();
  }, [externalOpen, showable, isLoading, handleDidClose]);

  const handleClose = useCallback(() => {
    if (adType === "custom" && countdown > 0) {
      Alert.alert(
        "Close Advertisement",
        "You will lose the chance to earn points",
        [
          { text: "Close Ad", style: "cancel", onPress: handleDidClose },
          { text: "RESUME", onPress: () => {} },
        ],
        { cancelable: false }
      );
      return;
    }
    handleDidClose();
  }, [adType, countdown, handleDidClose]);

  // Handles open/close transitions. The `open === true` branch is the single
  // entry point for user-initiated opens (whether from Dialog.Trigger, external
  // `setOpen(true)`, or any other path), so it owns gate checks, native-ad
  // dispatch, and the LuckyAppWall fallback.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
        return;
      }

      // Gate: caller can refuse to open (e.g. redirect to LuckyAppWall or auth).
      if (onOpen?.() === false) {
        return;
      }

      // Native ad path → show Google ad or fall back to LuckyAppWall.
      if (adType === "native") {
        if (googleAd.isLoaded) {
          googleAd.show();
        } else {
          onUnavailable?.();
          if (fallbackToAppWall) {
            navigate("LuckyAppWall");
          }
        }
        return;
      }

      /**
       * Still fetching is not the same as nothing to show.
       *
       * This used to treat both as "no ad" and send the person to the Lucky
       * App Wall, so tapping before the query settled navigated them away from
       * the screen they had just chosen. Doing nothing for the moment it takes
       * to load is a far smaller cost than moving them somewhere else.
       */
      if (isLoading) {
        return;
      }

      // Genuinely nothing to show → tell the caller, then fall back.
      if (!ad) {
        onUnavailable?.();
        if (fallbackToAppWall) {
          navigate("LuckyAppWall");
        }
        return;
      }

      setIsOpen(true);
    },
    [
      onOpen,
      adType,
      googleAd,
      ad,
      isLoading,
      fallbackToAppWall,
      onUnavailable,
      setIsOpen,
      handleClose,
    ]
  );

  const handleAdClick = useCallback(() => {
    if (onAdClick) {
      onAdClick(ad);
      return;
    }
    const link =
      Platform.select({
        ios: ad?.links?.iosAppStore,
        android: ad?.links?.androidPlayStore,
      }) ?? ad?.links?.website;

    if (link) {
      Linking.openURL(link);
    }
  }, [onAdClick, ad]);

  const handleTriggerPress = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  useGlobalBackHandler(() => {
    if (isOpen) {
      handleClose();
      return true;
    }

    return false;
  });

  // ── Trigger element ───────────────────────────────────────────────────────────

  const renderTrigger = () => {
    if (hideTrigger || externalOpen) {
      return null;
    }

    if (asChild && children) {
      return <Dialog.Trigger asChild>{children}</Dialog.Trigger>;
    }

    if (children) {
      return (
        <Text
          className="cursor-pointer"
          onPress={handleTriggerPress}
          {...(triggerProps as React.ComponentProps<typeof Text>)}
        >
          {children}
        </Text>
      );
    }

    return (
      <Button onPress={handleTriggerPress} {...triggerProps}>
        <Button.Label>{triggerText}</Button.Label>
      </Button>
    );
  };

  // ── Dialog content ────────────────────────────────────────────────────────────
  const dialogContent =
    adType === "custom" && ad ? (
      <PartnerAdContent
        ad={ad}
        onAdClick={handleAdClick}
        onYtStateChange={onYtStateChange}
        showAdLabel={showAdLabel}
        ytPlaying={ytPlaying}
      />
    ) : null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange}>
      {renderTrigger()}

      <Dialog.Portal className="justify-start p-0">
        <Dialog.Overlay className="bg-black/50" isCloseOnPress={false} />
        <Dialog.Content
          isSwipeable={countdown <= 0}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Close / countdown button */}
          <View className="z-10 mt-safe-offset-0 flex-row items-center self-end rounded-full bg-[#f5f5f5] px-2">
            {adType === "custom" && countdown > 0 ? (
              <Text className="mr-1 text-sm">{`Reward in ${countdown} seconds`}</Text>
            ) : null}
            <PressableFeedback
              className="rounded-full bg-white p-2"
              onPress={handleClose}
            >
              <XIcon color="black" size={16} />
            </PressableFeedback>
          </View>

          {dialogContent}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export default PartnerAdDialog;
