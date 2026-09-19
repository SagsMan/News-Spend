import { useNavigation } from "@react-navigation/native";
import { useMMKVObject } from "react-native-mmkv";

import { toast } from "#/components/heroui/toast";
import useAddActivity from "#/hooks/point/useAddActivity";
import { authState } from "#/state/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_REWARDED_COUNT = 8;
const LUCKY_WALL_EVERY_N = 4;
const STORAGE_KEY = "CONNECT_BRAND_COUNT_DATA";
const AD_POINTS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectBrandData = { count: number; date: string };

const today = () => new Date().toDateString();

// ─── Hook ─────────────────────────────────────────────────────────────────────

type UseConnectBrandReturn = {
  /** Call before opening the dialog. Returns false if dialog should not open. */
  onOpen: () => boolean;
  /** Call when the ad countdown completes and the user earned a reward. */
  onCountdownComplete: () => void;
  /** Whether the user can still earn points today. */
  canEarnPoints: boolean;
};

export function useConnectBrand(): UseConnectBrandReturn {
  const navigation = useNavigation();
  const addActivityMutation = useAddActivity({
    onCapReached: () => {
      setData({ count: MAX_REWARDED_COUNT, date: today() });
    },
  });
  const [data, setData] = useMMKVObject<ConnectBrandData>(STORAGE_KEY);

  const count = data?.date === today() ? data.count : 0;
  const canEarnPoints = count < MAX_REWARDED_COUNT;

  const increment = () => {
    setData((prev) => ({ count: (prev?.count ?? 0) + 1, date: today() }));
  };

  const onOpen = (): boolean => {
    if (!authState.user) {
      return false;
    }

    if (
      count % LUCKY_WALL_EVERY_N === LUCKY_WALL_EVERY_N - 1 &&
      canEarnPoints
    ) {
      increment();
      navigation.navigate("LuckyAppWall");
      return false;
    }

    return true;
  };

  const onCountdownComplete = () => {
    if (!(canEarnPoints && authState.user)) {
      return;
    }

    addActivityMutation.mutate(
      {
        action: "connectBrandAd",
        type: "point",
        point: AD_POINTS,
        description: "Connect brand ad",
      },
      {
        onSuccess: (response) => {
          if (response?.message === "CAP_REACHED") {
            toast.error("Daily limit reached. Try again tomorrow!");
            return;
          }
          increment();
          toast.success(`You earned ${AD_POINTS} points!`, {
            description: "You can earn more points by connecting more brands",
          });
        },
      }
    );
  };

  return { onOpen, onCountdownComplete, canEarnPoints };
}
