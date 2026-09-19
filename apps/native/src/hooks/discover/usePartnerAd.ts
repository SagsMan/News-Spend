import type { PartnerContent } from "@news-spend-media/payload/types";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { orpc } from "#/lib/orpc";

export type AdType = "custom" | "native";

type UsePartnerAdReturn = {
  ad: PartnerContent | undefined;
  isLoading: boolean;
  adType: AdType;
  refetchAd: () => void;
  cycleAdType: () => void;
};

function pickAdType(): AdType {
  return Math.random() < 0.4 ? "custom" : "native";
}

type UsePartnerAdOptions = {
  /**
   * Pin the rotation to one kind of advertisement.
   *
   * For callers that need a predictable outcome rather than a fair share of
   * inventory: the giveaway reveal has to know whether an ad can be shown
   * before it decides how to sequence itself, and a Google ad it cannot
   * attribute or time is no use to it.
   */
  forceType?: AdType;
  /**
   * Serving this advertisement so a Boost can be earned from it.
   *
   * Makes the server skip items whose Boost this person has already earned in
   * the open giveaway. Without it the pick is uniform over the whole
   * placement, so a repeat costs the viewer a full advertisement before
   * `recordEngagement` refuses it as already completed.
   */
  forBoost?: boolean;
};

export function usePartnerAd({
  forceType,
  forBoost = false,
}: UsePartnerAdOptions = {}): UsePartnerAdReturn {
  const id = useId();
  const [rotatingType, setRotatingType] = useState<AdType>(pickAdType);
  const adType = forceType ?? rotatingType;

  const queryOptions = orpc.partnerContent.getOne.queryOptions({
    input: {
      placement: ["connect-brands-tab", "connect-brand-video"],
      forBoost,
    },
    /**
     * Short, never infinite.
     *
     * This was `Infinity`, and the query cache is persisted to MMKV with a
     * 24-hour `gcTime`, so whatever the first call returned was kept and never
     * questioned, including a `null` from before any Connect Brands content
     * existed. The app then believed there were no ads, sent everyone to the
     * Lucky App Wall instead, and kept doing so across restarts and even an
     * EAS update, because an update replaces JavaScript and not stored data.
     * Only a reinstall cleared it.
     *
     * An advertisement is the last thing that should be cached indefinitely:
     * inventory is added, campaigns end, and rotation is the point.
     */
    staleTime: 60_000,
  });

  const query = useQuery({
    ...queryOptions,
    queryKey: [...queryOptions.queryKey, id],
  });

  const refetchAd = () => {
    query.refetch();
  };

  const cycleAdType = () => {
    // A pinned caller stays pinned: re-rolling here would quietly undo it on
    // the first close.
    if (forceType) {
      return;
    }
    setRotatingType(pickAdType());
  };

  return {
    ad: query.data,
    isLoading: query.isLoading,
    adType,
    refetchAd,
    cycleAdType,
  };
}
