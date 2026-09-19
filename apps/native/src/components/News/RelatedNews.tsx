import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { News, PartnerContent } from "@news-spend-media/payload/types";
import { useNavigation } from "@react-navigation/native";
import { Chip } from "heroui-native/chip";
import { memo, useCallback } from "react";
import {
  Pressable,
  type ScrollViewProps,
  useWindowDimensions,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { isAdReady, shouldShowNewsClickAd } from "#/state/adManager";
import { appOpenAdSheetState } from "#/state/appOpenAdState";
import { getImageData } from "#/utils/getImageData";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";
import { RelatedItemTask } from "./RelatedItemTask";

type RelatedNewsData = (
  | News
  | PartnerContent
  | (PartnerContent & { _type: string })
)[];

const CustomScrollView = (props: ScrollViewProps) => <ScrollView {...props} />;

function isNews(item: unknown): item is News {
  return typeof item === "object" && item !== null && "type" in item;
}

function isRewardTask(
  item: unknown
): item is PartnerContent & { _type: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "_type" in item &&
    (item as PartnerContent & { _type: string })._type === "rewardTask"
  );
}

const RelatedImage = memo(
  ({ item, width }: { item: News | PartnerContent; width: number }) => {
    const mediaSource = isNews(item) ? item.image : item.media;
    const { url, blurhash } = getImageData(mediaSource);
    return (
      <Image
        className="w-full rounded-[5px]"
        contentFit="cover"
        placeholder={{
          blurhash,
        }}
        placeholderContentFit="cover"
        recyclingKey={item.id}
        source={url}
        style={{
          height: width * 0.35,
        }}
      />
    );
  }
);

const PointsButton = memo(({ points }: { points: number }) => (
  <Chip className="bg-s-300" size="sm">
    {points} points
  </Chip>
));

const RelatedItem = memo(
  ({
    item,
    width,
    onPress,
  }: {
    item: News | PartnerContent;
    width: number;
    onPress: () => void;
  }) => {
    const isNewsItem = isNews(item);
    let title = item.title;
    if (isNewsItem && item.type !== "article" && item.type !== "video") {
      title = (item as News & { task?: string }).task ?? item.title;
    }
    const points = isNewsItem ? (item.points ?? 0) : 0;

    return (
      <Pressable
        className="mr-2.5 gap-2"
        onPress={onPress}
        style={{ width: width * 0.42 }}
      >
        <View className="items-center justify-center">
          <RelatedImage item={item} width={width} />
        </View>
        <View className="gap-2">
          <Text ellipsizeMode="tail" numberOfLines={3}>
            {title}
          </Text>
          {isNewsItem && points > 0 && (
            <View className="flex-row items-center justify-between">
              <PointsButton points={points} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }
);

function RelatedNews({ news }: { news: RelatedNewsData | undefined }) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();

  const handlePress = useCallback(
    (item: News | PartnerContent) => {
      const navigateToItem = () => {
        if (
          isNews(item) &&
          (item.type === "article" || item.type === "video")
        ) {
          navigation.navigate("News", {
            id: item.id,
            slug: item.slug,
          });
        }
      };

      if (
        shouldShowNewsClickAd() &&
        (isAdReady("news-click-ads") || appOpenAdSheetState.nativeAdReady)
      ) {
        appOpenAdSheetState.open("news-click-ads", navigateToItem);
      } else {
        navigateToItem();
      }
    },
    [navigation]
  );

  const renderNewsItem = useCallback(
    ({ item }: LegendListRenderItemProps<RelatedNewsData[number]>) =>
      isRewardTask(item) ? (
        <RelatedItemTask item={item} />
      ) : (
        <RelatedItem
          item={item}
          onPress={() => handlePress(item)}
          width={width}
        />
      ),
    [width, handlePress]
  );

  const keyExtractor = useCallback(
    (item: RelatedNewsData[number]) => item.id,
    []
  );

  if (!news?.length) {
    return null;
  }

  return (
    <View className="gap-3">
      <Text>People are also reading</Text>
      <LegendList
        data={news}
        horizontal
        keyExtractor={keyExtractor}
        recycleItems
        renderItem={renderNewsItem}
        renderScrollComponent={CustomScrollView}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

export default memo(RelatedNews);
