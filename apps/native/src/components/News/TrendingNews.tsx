import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { News } from "@news-spend-media/payload/types";
import { useNavigation } from "@react-navigation/native";
import { Card } from "heroui-native/card";
import { useCallback } from "react";
import { Dimensions, Pressable, type ScrollViewProps } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { isAdReady, shouldShowNewsClickAd } from "#/state/adManager";
import { appOpenAdSheetState } from "#/state/appOpenAdState";
import { getImageData } from "#/utils/getImageData";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";

const SPACING = 5;
const { width, height } = Dimensions.get("window");
const ITEM_WIDTH = width * 0.88;
const ITEM_HEIGHT = height * 0.3;
const FULL_SIZE = ITEM_WIDTH + SPACING * 2;

const CustomScrollView = (props: ScrollViewProps) => <ScrollView {...props} />;

export default function TrendingNews({ news }: { news: News[] }) {
  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<News>) => (
      <TrendingNewsItem item={item} />
    ),
    []
  );

  return (
    <LegendList
      data={news}
      decelerationRate="fast"
      estimatedItemSize={355.625}
      horizontal
      keyExtractor={(item, index) => `${item.id}-${index}`}
      pagingEnabled
      recycleItems
      renderItem={renderItem}
      renderScrollComponent={CustomScrollView}
      showsHorizontalScrollIndicator={false}
      snapToAlignment="center"
      snapToInterval={FULL_SIZE}
      style={{ height: ITEM_HEIGHT }}
      // suggestEstimatedItemSize
    />
  );
}

const TrendingNewsItem = ({ item }: { item: News }) => {
  const navigation = useNavigation("NewsHome");
  const { url, blurhash } = getImageData(item?.image);

  const onAdClose = useCallback(() => {
    navigation.navigate("News", {
      slug: item.slug,
      id: item.id,
    });
  }, [item, navigation]);

  const onPress = useCallback(() => {
    if (
      shouldShowNewsClickAd() &&
      (isAdReady("news-click-ads") || appOpenAdSheetState.nativeAdReady)
    ) {
      appOpenAdSheetState.open("news-click-ads", onAdClose);
    } else {
      navigation.navigate("News", {
        slug: item.slug,
        id: item.id,
      });
    }
  }, [item, navigation, onAdClose]);

  return (
    <Pressable onPress={onPress}>
      <Card
        className="overflow-hidden rounded-xl p-0"
        style={{
          height: ITEM_HEIGHT,
          width: ITEM_WIDTH,
          marginHorizontal: SPACING,
        }}
      >
        <Card.Footer className="absolute inset-x-0 bottom-0 z-10 flex-1 bg-p-500">
          <Text className="px-5 py-3 font-bold text-s-50" numberOfLines={2}>
            {item.title}
          </Text>
        </Card.Footer>
        <Image
          className="absolute inset-0"
          contentFit="cover"
          placeholder={{
            blurhash,
          }}
          placeholderContentFit="cover"
          recyclingKey={item.id}
          source={url}
          style={{ height: ITEM_HEIGHT }}
        />
      </Card>
    </Pressable>
  );
};
