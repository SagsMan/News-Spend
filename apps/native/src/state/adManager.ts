import type { enum_partner_content_placements } from "@news-spend-media/payload/payload-generated-schema";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { proxy } from "valtio";

import { client } from "#/lib/orpc";
import { storage } from "#/utils/storage";

export type AdPlacement =
  (typeof enum_partner_content_placements.enumValues)[number];

type AdSlotStatus = "idle" | "loading" | "ready" | "error";

type AdSlot = {
  data: PartnerContent | null;
  status: AdSlotStatus;
};

type AdManagerState = {
  slots: Partial<Record<AdPlacement, AdSlot>>;
};

export const adManagerState = proxy<AdManagerState>({
  slots: {},
});

function getSlot(placement: AdPlacement): AdSlot {
  if (!adManagerState.slots[placement]) {
    adManagerState.slots[placement] = { data: null, status: "idle" };
  }
  return adManagerState.slots[placement]!;
}

export async function preloadAd(placement: AdPlacement): Promise<void> {
  const slot = getSlot(placement);

  if (slot.status === "loading") {
    return;
  }

  slot.status = "loading";
  slot.data = null;

  try {
    const result = await client.partnerContent.getOne({
      placement: [placement],
    });
    slot.data = result ?? null;
    slot.status = result ? "ready" : "error";
  } catch {
    slot.status = "error";
  }
}

export function preloadAds(placements: AdPlacement[]): void {
  for (const placement of placements) {
    preloadAd(placement);
  }
}

export function isAdReady(placement: AdPlacement): boolean {
  return adManagerState.slots[placement]?.status === "ready";
}

const NEWS_CLICK_AD_INTERVAL = 7;
const NEWS_CLICK_AD_KEY = "news_click_ad_count";
let newsClickAdPressCount = storage.getNumber(NEWS_CLICK_AD_KEY) ?? 0;

/**
 * Increments the global press counter and returns true every
 * NEWS_CLICK_AD_INTERVAL presses, signalling that an ad should be shown.
 * The counter always resets at the interval boundary regardless of whether
 * an ad is actually available, keeping the cadence predictable.
 */
export function shouldShowNewsClickAd(): boolean {
  newsClickAdPressCount = (newsClickAdPressCount + 1) % NEWS_CLICK_AD_INTERVAL;
  storage.set(NEWS_CLICK_AD_KEY, newsClickAdPressCount);
  return newsClickAdPressCount === 0;
}

export function consumeAd(placement: AdPlacement): PartnerContent | null {
  const slot = getSlot(placement);
  const data = slot.data;
  preloadAd(placement);
  return data;
}
