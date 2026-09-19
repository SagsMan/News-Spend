import { useNavigation } from "@react-navigation/native";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { Chip } from "heroui-native/chip";
import { cn } from "heroui-native/utils";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { ClockIcon, PlayIcon } from "#/lib/icons";
import type { RouterOutputs } from "#/lib/orpc";
import { isAdReady, shouldShowNewsClickAd } from "#/state/adManager";
import { appOpenAdSheetState } from "#/state/appOpenAdState";
import { getImageData } from "#/utils/getImageData";
import { Icon } from "../heroui/icon";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";

function NewsItem({
  news,
  latest,
}: {
  news: RouterOutputs["news"]["home"]["docs"][number];
  latest?: boolean;
}) {
  const { url, blurhash } = getImageData(news.image);
  const navigation = useNavigation();

  const onPress = () => {
    if (
      shouldShowNewsClickAd() &&
      (isAdReady("news-click-ads") || appOpenAdSheetState.nativeAdReady)
    ) {
      appOpenAdSheetState.open("news-click-ads", onAdClose);
    } else if (news.type === "article") {
      navigation.navigate("News", {
        slug: news.slug,
        id: news.id,
        latest, // TODO: fix type
      });
    } else {
      navigation.navigate("News", {
        slug: news.slug,
        id: news.id,
      });
    }
  };

  const onAdClose = () => {
    if (news.type === "article") {
      navigation.navigate("News", {
        slug: news.slug,
        id: news.id,
        latest,
      });
    } else {
      navigation.navigate("News", {
        slug: news.slug,
        id: news.id,
      });
    }
  };

  return (
    <Pressable onPress={onPress}>
      <View className="flex-row gap-4">
        <View className="items-center justify-center">
          <Image
            className="size-25 rounded-[10px]"
            contentFit="cover"
            placeholder={{ blurhash }}
            placeholderContentFit="cover"
            recyclingKey={news?.id}
            source={url}
          />
          {news.type === "video" && (
            <View
              ai="center"
              bg="black"
              boc="#fff"
              bw={1}
              jc="center"
              opacity={0.7}
              pos="absolute"
              size="$3"
            >
              <Icon fill="#fff" name={PlayIcon} size={32} />
            </View>
          )}
        </View>
        <View
          className={cn(
            "flex-1",
            latest ? "justify-between" : "justify-center",
            {
              "gap-4": !latest,
            }
          )}
        >
          {latest && (
            <Text className="font-bold text-p-500">
              {typeof news?.category === "object" ? news.category?.title : null}
            </Text>
          )}
          <View className="flex-1">
            <Text ellipsizeMode="tail" numberOfLines={2}>
              {news?.title}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <View className="flex-row items-center gap-1">
              <Icon color="#737373" name={ClockIcon} size={14} />
              <Text className="text-[#737373]">
                {formatDistanceToNow(new Date(news.createdAt), {
                  addSuffix: true,
                })}
              </Text>
            </View>
            <Chip className="bg-s-300" size="sm">
              <Chip.Label className="text-white">
                {news?.points} points
              </Chip.Label>
            </Chip>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Memoised: the feed re-renders on every page append, viewability change and
 * refetch, and `recycleItems` limits how many cells exist but not how often
 * each one re-renders.
 */
export default memo(NewsItem);
