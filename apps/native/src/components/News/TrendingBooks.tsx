import { LegendList } from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useCallback } from "react";
import {
  Dimensions,
  Linking,
  Pressable,
  type ScrollViewProps,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { getImageData } from "#/utils/getImageData";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";

const { width } = Dimensions.get("window");

const CustomScrollView = (props: ScrollViewProps) => <ScrollView {...props} />;

export default function TrendingBooks({
  books = [],
}: {
  books: PartnerContent[];
}) {
  const booksRenderItem = useCallback(({ item }: { item: PartnerContent }) => {
    const { url, blurhash } = getImageData(item?.media);
    return (
      <Pressable
        onPress={() =>
          Linking.openURL(item?.links?.website ?? "").catch(console.error)
        }
        style={{ width: width * 0.31 }}
      >
        <Image
          className="w-full overflow-hidden rounded-xl"
          contentFit="cover"
          placeholder={{
            blurhash,
          }}
          recyclingKey={item.id}
          source={{ uri: url ?? "" }}
          style={{ aspectRatio: 0.7, width: "100%" }}
        />
        <Text
          className="mt-2 font-semibold text-gray-500 italic"
          numberOfLines={2}
        >
          {item.condition}
        </Text>
      </Pressable>
    );
  }, []);

  if (books.length === 0) {
    return null;
  }

  return (
    <View className="gap-1.5">
      <Text className="px-4 font-semibold text-base">Trending Books</Text>

      <LegendList
        contentContainerStyle={{
          paddingHorizontal: 15,
          gap: 15,
        }}
        data={books}
        estimatedItemSize={136}
        horizontal
        recycleItems
        renderItem={booksRenderItem}
        renderScrollComponent={CustomScrollView}
        showsHorizontalScrollIndicator={false}
        // suggestEstimatedItemSize
      />
    </View>
  );
}
