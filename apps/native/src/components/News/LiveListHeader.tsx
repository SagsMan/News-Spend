import { LegendList } from "@legendapp/list/react-native";
import type { News } from "@news-spend-media/payload/types";
import { View } from "react-native";

import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import VideoNewsItem from "#/components/videoNews/VideoNewsItem";

const blurhash = [
  "UZ1Y5^IuIuM{R*V?RjRj0fRjRjRj",
  "UHHp6w~p02000DDiMd?a9OWA#$kEQ,tR%MnM",
  "LGF5?xYk^6#M@-5c,1J5@[or[Q6.",
  "LKN]Rv%2Tw=w]~RBVZRi};RPxuwH",
  "L6PZfSi_.AyE_3t7t7R**0o#DgR4",
  "LKN]Rv%2Tw=w]~RBVZRi};RPxuwH",
];

export default function LiveListHeader({ news }: { news: News }) {
  const renderProgramsItem = ({ item, index }) => (
    <View className="h-[170px] w-[150px] overflow-hidden rounded-2xl">
      <Image
        cachePolicy="memory-disk"
        className="h-full w-full"
        contentFit="cover"
        placeholder={{
          blurhash: blurhash.at(Math.floor(Math.random() * blurhash.length))!,
        }}
        source={`https://picsum.photos/250/${514 * (index + 2)}`}
      />
    </View>
  );

  return (
    <View className="mb-2 gap-2">
      <VideoNewsItem videoNews={news} />

      <View className="gap-1.5">
        <Text variant="HeadingMedium">TV Programs</Text>
        <LegendList
          data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          estimatedItemSize={170}
          horizontal
          ItemSeparatorComponent={() => <View className="w-3.5" />}
          keyExtractor={(_item, index) => index.toString()}
          renderItem={renderProgramsItem}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <Text className="mt-2" variant="HeadingMedium">
        Latest Videos
      </Text>
    </View>
  );
}
