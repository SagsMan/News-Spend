import type { PartnerContent } from "@news-spend-media/payload/types";
import { useMutation } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Linking, Platform } from "react-native";

import { orpc } from "#/lib/orpc";
import { navigate } from "#/navigation/navigationUtils";
import { authState } from "#/state/auth";

/**
 * Mint the click id here rather than waiting for the server to return one.
 *
 * The id only has to be in the outbound URL and on the conversion row; there
 * is nothing the server knows that is needed to choose it. Generating it here
 * means the link opens immediately and the click is reported in the
 * background, instead of the tap sitting on a spinner for up to three seconds
 * while four sequential queries run.
 *
 * Shape matches the server's own generator, which still runs when no id is
 * supplied. Collisions cannot do harm: `clickId` is unique-indexed, so a
 * replayed id fails the insert rather than touching the existing row.
 */
const mintClickId = () =>
  `clk_${Crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

export function usePartnerClick() {
  const trackClickMutation = useMutation(
    orpc.partnerConversions.trackClick.mutationOptions()
  );
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const handleClick = async (item: PartnerContent) => {
    if (loadingItemId === item.id) {
      return;
    }

    const partner = typeof item.partner === "object" ? item.partner : undefined;
    /**
     * Guests are excluded, not merely unlucky: `trackClick` is a
     * no-guest procedure and rejects them outright. Attempting it anyway
     * spent a round trip to earn a FORBIDDEN, which the catch below then
     * reported as "Connection slow" — a wrong explanation for a request
     * that was never going to succeed.
     */
    const isCPA =
      !authState.user?.isAnonymous &&
      (partner?.integrationMethod === "webhook" ||
        partner?.integrationMethod === "postback");

    // Store links have to leave the app: the App Store / Play Store cannot
    // render in a WebView. Website links stay in the in-app browser.
    const storeUrl = Platform.select({
      ios: item.links?.iosAppStore,
      android: item.links?.androidPlayStore,
    });
    let url = storeUrl ?? item.links?.website;

    if (!url) {
      return;
    }

    const isStoreLink = Boolean(storeUrl);

    if (isCPA) {
      const clickId = mintClickId();
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}clickId=${clickId}`;

      /**
       * Deliberately not awaited. The id is already in the URL, so nothing
       * downstream is waiting on this: the conversion row it writes is read
       * later by the partner's postback, not by anything happening now.
       *
       * A failure here loses attribution for this one tap, which is why it is
       * logged. It is not worth holding the link open for — the previous
       * version made every CPA tap pay that latency to learn an id it could
       * just as well have chosen itself.
       */
      /**
       * `loadingItemId` no longer gates the link — it is now only a
       * de-duplication guard. Without an await between tap and open, a double
       * tap would report the same tap twice under two different ids and
       * inflate the partner's click count.
       */
      setLoadingItemId(item.id);
      trackClickMutation
        .mutateAsync({ partnerContentId: item.id, clickId })
        .catch((error) => {
          console.error("Failed to track click:", error);
        })
        .finally(() => setLoadingItemId(null));
    }

    if (isStoreLink) {
      Linking.openURL(url);
      return;
    }

    navigate("InAppBrowser", {
      url,
      title: item.title,
      /**
       * No warning on the way out, for a CPA offer least of all.
       *
       * Nothing is forfeited by leaving: the click was recorded the moment it
       * was tapped, and the reward, points, and the Featured Offer that
       * counts towards Tier 1, arrives when the partner confirms the
       * conversion on its webhook. That happens whether this screen is open or
       * not.
       *
       * Warning otherwise argues against the step some offers require. An
       * "install this app" offer is completed by leaving for the store, so
       * telling someone they are about to lose their reward is both untrue and
       * pointed at the wrong action. A game still warns: leaving one really
       * does abandon it, and that lives on the game's own navigation.
       */
      confirmOnLeave: false,
    });
  };

  const isLoading = (itemId: string) => loadingItemId === itemId;

  return { handleClick, isLoading };
}
