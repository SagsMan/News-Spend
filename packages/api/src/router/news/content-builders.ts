import { randomUUID } from "node:crypto";

import type { News, PartnerContent } from "@news-spend-media/payload/types";

export type RelatedNewsItem = {
  _type: "relatedNews";
  type: "relatedNews";
  id: string;
  data: (News | PartnerContent | (PartnerContent & { _type: string }))[];
};

export type PromotionMediaItem = {
  _type: "promotionMedia";
  type: "adCarousel";
  id: string;
  payload: PartnerContent;
};

export type RewardTaskItem = {
  _type: "rewardTask";
  type: "rewardTask";
  id: string;
  payload: PartnerContent;
};

export type GoogleAdItem = {
  _type: "ad";
  type: "gAd";
  id: string;
  payload: { slot: string };
};

export type InHouseAdItem = {
  _type: "ad";
  type: "inHouse";
  id: string;
  payload: PartnerContent;
};

export type AdItem = GoogleAdItem | InHouseAdItem;
export type FeedItem =
  | News
  | RelatedNewsItem
  | PromotionMediaItem
  | RewardTaskItem
  | AdItem;

/**
 * Builds a related news section with optional reward task insertion
 */
export function buildRelatedNews(
  docs: News[],
  randomTaskItem?: PartnerContent
): RelatedNewsItem {
  // console.log("buildRelatedNews called", docs);

  let shuffledDocs: (
    | News
    | PartnerContent
    | (PartnerContent & { _type: string })
  )[] = docs.sort(() => Math.random() - 0.5);

  if (randomTaskItem) {
    // Insert randomTaskItem at a random position in the array
    const insertIndex = Math.floor(Math.random() * (shuffledDocs.length + 1));
    shuffledDocs = [
      ...shuffledDocs.slice(0, insertIndex),
      { _type: "rewardTask", ...randomTaskItem },
      ...shuffledDocs.slice(insertIndex),
    ];
  }

  return {
    _type: "relatedNews",
    id: `related-${randomUUID()}`,
    data: shuffledDocs,
  };
}

/**
 * Builds a promotion media item for the feed
 */
export function buildPromotionMedia(promo: PartnerContent): PromotionMediaItem {
  return {
    _type: "promotionMedia",
    type: "adCarousel",
    id: `promo-${randomUUID()}`,
    payload: promo,
  };
}

/**
 * Builds a reward task item for the feed
 */
export function buildRewardTask(task: PartnerContent): RewardTaskItem {
  return {
    _type: "rewardTask",
    type: "rewardTask",
    id: `reward-${randomUUID()}`,
    payload: task,
  };
}

/**
 * Creates a Google Ad item
 */
export function buildGoogleAd(slot = "banner_1"): GoogleAdItem {
  return {
    _type: "ad",
    type: "gAd",
    id: `gAd-${randomUUID()}`,
    payload: { slot },
  };
}

/**
 * Creates an in-house ad item
 */
export function buildInHouseAd(partnerContent: PartnerContent): InHouseAdItem {
  return {
    _type: "ad",
    type: "inHouse",
    id: `inHouse-${randomUUID()}`,
    payload: partnerContent,
  };
}
