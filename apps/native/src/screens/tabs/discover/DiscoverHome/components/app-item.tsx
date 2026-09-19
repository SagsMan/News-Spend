import type { PartnerContent } from "@news-spend-media/payload/types";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import { ActivityIndicator, View } from "react-native";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import { getImageData } from "#/utils/getImageData";

type AppItemProps = {
  item: PartnerContent;
  onPress: () => void;
  loading?: boolean;
};

export function AppItem({ item, onPress, loading }: AppItemProps) {
  const { blurhash, url } = getImageData(item.media);

  return (
    <PressableFeedback onPress={onPress}>
      <View
        className={cn(
          "flex-row items-start gap-2.5 px-3 py-2",
          loading && "opacity-70"
        )}
      >
        <Image
          className="size-20 rounded-lg"
          placeholder={{ blurhash }}
          source={{ uri: url ?? "" }}
        />
        <View className="h-full flex-1 justify-between">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base" numberOfLines={2}>
                {item.title}
              </Text>
              {loading ? <ActivityIndicator color="#666" size="small" /> : null}
            </View>
            <Text className="text-gray-50 text-sm" numberOfLines={2}>
              {item.condition}
            </Text>
          </View>
          <View className="flex-row self-end rounded-full bg-s-300 px-2 py-1">
            <Text className="text-white text-xs">{item.points} points</Text>
          </View>
        </View>
      </View>
    </PressableFeedback>
  );
}
