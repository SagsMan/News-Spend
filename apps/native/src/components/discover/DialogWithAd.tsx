import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog } from "heroui-native/dialog";
import { XIcon } from "#/lib/icons";
import { useEffect, useId, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import {
  NativeAd,
  NativeAdEventType,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { Button } from "#/components/heroui/button";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { useGlobalBackHandler } from "#/hooks/useBackHandler";
import { adUnits } from "#/lib/adUnits";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { getCtaLabel } from "#/utils";
import { getImageData } from "#/utils/getImageData";

export function DialogWithAd({
  open,
  setOpen,
  purchasedTickets,
  preloadedNativeAd,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  purchasedTickets: number;
  preloadedNativeAd?: NativeAd | null;
}) {
  const { width, height } = useWindowDimensions();
  const id = useId();
  const queryOptions = orpc.partnerContent.getOne.queryOptions({
    input: {
      // placement: ["connect-brands-tab"],
      type: ["app", "book", "product", "game"],
    },
  });
  const queryKey = [...queryOptions.queryKey, id];
  const ad = useQuery({
    ...queryOptions,
    queryKey,
  });
  const lotteryTicketMutation = useMutation(
    orpc.giveaway.buyTickets.mutationOptions()
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const navigation = useNavigation("GetTicket");
  const [randomNumber, setRandomNumber] = useState(Math.random());
  const { url, blurhash } = getImageData(ad.data?.media);
  const hasAwardedRef = useRef(false);

  useGlobalBackHandler(() => {
    if (open) {
      return true;
    }

    return false;
  });

  useEffect(() => {
    if (!open || hasAwardedRef.current) {
      return;
    }

    hasAwardedRef.current = true;

    setServerError(null);
    lotteryTicketMutation.mutate(
      {
        quantity: purchasedTickets,
      },
      {
        onSuccess: () => {
          toast.success("Giveaway entry confirmed", {
            description: `You entered the Giveaway with ${purchasedTickets} ticket${
              purchasedTickets === 1 ? "" : "s"
            }`,
          });

          /**
           * Points, the tier ladder and the entrant list all move on a
           * purchase. Refetching rather than patching a cached count: the
           * server decides how many tickets were actually valid, and the
           * tier a purchase unlocks is its answer to give, not ours.
           */
          queryClient.invalidateQueries(
            orpc.activity.totalPoints.queryOptions()
          );
          queryClient.invalidateQueries({
            queryKey: orpc.giveaway.progress.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.giveaway.participants.queryKey(),
          });
        },
        onError: ({ message }) => {
          // The API explains refusals in terms a winner can act on (an empty
          // giveaway, too few points), so show it rather than a generic line.
          setServerError(message || "Sorry, something went wrong.");
        },
      }
    );
  }, [open, purchasedTickets, lotteryTicketMutation.mutate]);

  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      hasAwardedRef.current = false;
    }
    setOpen(nextOpen);

    if (!nextOpen) {
      setRandomNumber(Math.random());
    }
  };

  const handlePress = () => {
    const urlToOpen =
      Platform.select({
        ios: ad.data?.links?.iosAppStore,
        android: ad.data?.links?.androidPlayStore,
      }) ?? ad.data?.links?.website;

    if (!urlToOpen) {
      toast.error("No link available for this ad.");
      return;
    }
    Linking.openURL(urlToOpen).catch((err) => {
      console.error("Failed to open URL:", err);
      toast.error("Failed to open the link.");
    });
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50" isCloseOnPress={false} />
        <Dialog.Content
          className="rounded-none p-0 px-2 pb-8"
          isSwipeable={false}
          style={{ width: width - 40, minHeight: 80 }}
        >
          <View className="gap-4">
            {randomNumber < 0.4 ? (
              <>
                <Text className="mt-2 self-start rounded-sm border border-gray-50 px-0.5 text-gray-50">
                  AD
                </Text>

                <View className="flex-row items-center gap-2 pl-3">
                  <Image
                    className="size-7.5"
                    contentFit="cover"
                    placeholder={{ blurhash }}
                    source={url}
                  />
                  <Text className="font-semibold text-base">
                    {ad.data?.title}
                  </Text>
                </View>

                <View className="items-center">
                  <Image
                    className="size-50"
                    contentFit="cover"
                    placeholder={{ blurhash }}
                    source={url}
                  />
                </View>

                <View className="flex-row gap-4">
                  <Text
                    className="flex-2 text-base text-gray-50"
                    numberOfLines={2}
                  >
                    {ad.data?.condition}
                  </Text>

                  <Button
                    className="h-auto flex-1 rounded-lg"
                    onPress={handlePress}
                  >
                    <Button.Label>Visit</Button.Label>
                  </Button>
                </View>
              </>
            ) : (
              <NativeAdMob preloadedAd={preloadedNativeAd} />
            )}

            <View className="mt-2 items-center gap-2.5">
              {randomNumber < 0.4 ? (
                <Text className="text-center text-sm">
                  {getCtaLabel(ad.data?.cta)} and Get{" "}
                  <Text className="text-s-500">{ad.data?.points ?? 0}</Text>{" "}
                  points
                </Text>
              ) : null}

              {lotteryTicketMutation.isPending ? (
                <ActivityIndicator className="self-center" />
              ) : (
                <Text className="text-center text-sm">
                  {serverError ? (
                    serverError
                  ) : (
                    <>
                      You entered the Giveaway with {purchasedTickets ?? 0}{" "}
                      ticket
                      {purchasedTickets === 1 ? "" : "s"}.{" "}
                      <Text className="text-s-500">
                        {(purchasedTickets ?? 0) * 50} Dream Points
                      </Text>{" "}
                      deducted from your account.
                    </>
                  )}
                </Text>
              )}
            </View>
          </View>

          <Button
            className="absolute -bottom-7 z-10 h-9 w-9 items-center justify-center self-center rounded-full border border-gray-50 bg-white"
            isDisabled={lotteryTicketMutation.isPending}
            onPress={() => {
              onOpenChange(false);
              if (!serverError) {
                navigation.reset({
                  index: 1,
                  routes: [{ name: "DiscoverHome" }, { name: "BoostLuck" }],
                });
              }
            }}
            variant="ghost"
          >
            <XIcon color="#9CA3AF" size={20} weight="bold" />
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const NativeAdMob = ({ preloadedAd }: { preloadedAd?: NativeAd | null }) => {
  const [error, setError] = useState(false);
  const [nativeAd, setNativeAd] = useState<NativeAd | undefined>(
    preloadedAd ?? undefined
  );

  useEffect(() => {
    if (preloadedAd) {
      setNativeAd(preloadedAd);
      return;
    }

    NativeAd.createForAdRequest(adUnits.native)
      .then((ad) => {
        setNativeAd(ad);
      })
      .catch(() => {
        setError(true);
      });
  }, [preloadedAd]);

  useEffect(() => {
    if (!nativeAd || nativeAd === preloadedAd) {
      return;
    }
    const _listener = nativeAd.addAdEventListener(
      NativeAdEventType.CLICKED,
      () => {
        console.log("Native ad clicked");
      }
    );
    return () => {
      nativeAd.destroy();
    };
  }, [nativeAd, preloadedAd]);

  if (!nativeAd) {
    return (
      <View className="py-3">
        {error ? <Text>Failed to load ad</Text> : null}
      </View>
    );
  }

  return (
    <NativeAdView nativeAd={nativeAd}>
      <View className="gap-4">
        <View className="my-2">
          <Text className="mt-2 self-start rounded-sm border border-gray-50 px-0.5 text-gray-50">
            AD
          </Text>
        </View>

        <View className="flex-row items-center gap-2 pl-3">
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                className="size-7.5"
                contentFit="cover"
                source={{ uri: nativeAd.icon?.url }}
              />
            </NativeAsset>
          ) : null}

          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text className="font-semibold text-base">{nativeAd.headline}</Text>
          </NativeAsset>
        </View>

        <NativeMediaView
          style={{
            paddingHorizontal: 16,
          }}
        />

        <View className="flex-row gap-4">
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text className="flex-2 text-base text-gray-50" numberOfLines={2}>
              {nativeAd.body}
            </Text>
          </NativeAsset>

          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Button size="sm">
              <Button.Label>{nativeAd.callToAction}</Button.Label>
            </Button>
          </NativeAsset>
        </View>
      </View>
    </NativeAdView>
  );
};
