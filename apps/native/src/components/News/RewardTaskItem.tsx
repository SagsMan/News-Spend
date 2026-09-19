import type { RewardTaskItem } from "@news-spend-media/api/router/news/content-builders";
import { Chip } from "heroui-native/chip";
import { Linking, Platform, Pressable, View } from "react-native";
import { getImageData } from "#/utils/getImageData";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";

function RewardTaskItemCard({ item }: { item: RewardTaskItem }) {
  const ad = item.payload;
  const { url, blurhash } = getImageData(ad?.media);

  if (!ad) {
    return null;
  }

  const onPress = async () => {
    const platformUrl = Platform.select({
      ios: ad?.links?.iosAppStore,
      android: ad?.links?.androidPlayStore,
    });

    const url = platformUrl || ad?.links?.website;

    if (url) {
      await Linking.openURL(url);
    }
  };

  return (
    <Pressable className="gap-2.5" onPress={onPress}>
      <View className="flex-row gap-4">
        <Image
          className="size-25 rounded-[10px]"
          contentFit="cover"
          placeholder={{ blurhash }}
          recyclingKey={item?.id}
          source={url}
        />
        <View className="flex-1 justify-center gap-4">
          <View className="flex-row justify-between">
            <Text className="font-bold">{ad?.title}</Text>
          </View>
          <Text ellipsizeMode="tail" numberOfLines={2}>
            {ad?.condition}
          </Text>
          <View className="flex-row items-center justify-end">
            <Chip className="bg-s-300" size="sm">
              {ad.points} points
            </Chip>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default RewardTaskItemCard;
