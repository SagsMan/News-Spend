// biome-ignore lint/style/useFilenamingConvention: PascalCase matches existing convention

import {
  LegendList,
  type LegendListRef,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type {
  PartnerContent,
  PromoVideoSource,
} from "@news-spend-media/payload/types";
import type React from "react";
import { useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import Share from "react-native-share";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import useAddActivity from "#/hooks/point/useAddActivity";
import { ShareNetworkIcon } from "#/lib/icons";
import { authState } from "#/state/auth";
import { SCREENSHOT_MODE } from "#/utils/screenshotMode";
import CarouselItem, { CustomScrollView } from "./CarouselItem";
import type { AdCarouselProps, AdCarouselRef, CarouselItemData } from "./types";

const AdCarousel: React.FC<
  AdCarouselProps & { listRef?: React.Ref<AdCarouselRef> }
> = ({ item, listRef }) => {
  const { width } = useWindowDimensions();
  const addActivityMutation = useAddActivity();

  const awardPoint = useCallback(() => {
    if (authState.status === "signOut") {
      return;
    }
    addActivityMutation.mutate(
      {
        action: "share",
        type: "point",
        point: item?.points,
        description: `Shared Promotion Video ${item?.title || ""}`,
      },
      {
        onSuccess: (_response) => {
          setTimeout(
            () => {
              toast.success("Points earned", {
                description: `You earned ${item?.points} points for sharing promo video!`,
              });
            },
            1 * 60 * 1000
          ); // 1 minute
        },
      }
    );
  }, [item?.points, item?.title, addActivityMutation]);

  const adCarouselRef = useRef<AdCarouselRef | null>(null);
  const promoListRef = useRef<LegendListRef | null>(null);
  const lastItem = useRef<PartnerContent | null>(item);

  if (lastItem.current !== item) {
    lastItem.current = item;
    promoListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  useImperativeHandle(
    listRef,
    () => ({
      play: () => {
        adCarouselRef.current?.play();
      },
      pause: () => {
        adCarouselRef.current?.pause();
      },
      isPlaying: () => adCarouselRef.current?.isPlaying() ?? false,
    }),
    []
  );

  const keyExtractor = useCallback(
    (listItem: CarouselItemData) => listItem?.id ?? "",
    []
  );

  const renderItem = useCallback(
    ({
      index,
      item: listItem,
    }: LegendListRenderItemProps<CarouselItemData>) => (
      <CarouselItem
        adCarouselRef={adCarouselRef}
        index={index}
        item={listItem}
        width={width}
      />
    ),
    [width]
  );

  const onShare = useCallback(async () => {
    if (!item.items?.length) {
      return;
    }
    const blk = item.items?.[0].layout?.[0] as PromoVideoSource;
    try {
      const shareResponse = await Share.open({
        message: `Check out this amazing video on News Spend Media\n ${item.title}`,
        url: blk?.url ?? undefined,
        title: `Share promo video of ${item.title}`,
      });

      if (shareResponse.success) {
        awardPoint();
      } else {
        toast.error("Share cancelled", {
          description: "You need to complete the share to earn points.",
        });
      }
    } catch {
      // console.error(error);
      // toast.error("Share failed", {
      //   description: "There was an issue sharing the promo video.",
      // });
    }
  }, [item, awardPoint]);

  const onViewableItemsChanged = useRef<
    (info: {
      changed: {
        item: CarouselItemData;
        isViewable: boolean;
      }[];
    }) => void
  >(({ changed }) => {
    for (const change of changed) {
      const { item: listItem, isViewable } = change;
      if (
        listItem?.layout?.[0]?.blockType === "promo-video-source" &&
        !isViewable
      ) {
        adCarouselRef?.current?.pause();
      }
    }
  });

  const memoizedData = useMemo(() => item.items ?? undefined, [item.items]);

  return (
    <View>
      <LegendList
        contentContainerStyle={{ gap: 12 }}
        data={memoizedData}
        // decelerationRate="fast"
        // getItemType={(listItem) =>
        //   listItem?.layout?.[0]?.blockType === "promo-video-source"
        //     ? "video"
        //     : "image"
        // }
        horizontal
        keyExtractor={keyExtractor}
        onViewableItemsChanged={onViewableItemsChanged.current}
        recycleItems={false}
        ref={promoListRef}
        renderItem={renderItem}
        renderScrollComponent={CustomScrollView}
        showsHorizontalScrollIndicator={false}
        // snapToAlignment="center"
        // snapToInterval={width * 0.9}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
          minimumViewTime: 100,
        }}
      />
      <View className="flex-row items-center justify-between gap-5">
        <Text className="flex-1 text-gray-50 text-xs" numberOfLines={2}>
          {item.title}: {item.condition}
        </Text>
        <Button className="h-auto" onPress={onShare} variant="ghost">
          <Icon name={ShareNetworkIcon} />
        </Button>
      </View>
    </View>
  );
};

const AdCarouselGated: typeof AdCarousel = (props) => {
  if (SCREENSHOT_MODE) {
    return null;
  }
  return <AdCarousel {...props} />;
};

export default AdCarouselGated;
