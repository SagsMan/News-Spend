import { PlayIcon } from "#/lib/icons";
import { Pressable, View } from "react-native";

import { Image } from "#/components/ui";
import { Icon } from "../heroui/icon";

export const ThumbnailView = ({ thumbnail, onPress }) => (
  <View className="relative h-full w-full items-center justify-center">
    <Image
      contentFit="cover"
      source={{ uri: thumbnail }}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 10,
      }}
    />
    <Pressable
      accessibilityLabel="Play video"
      accessibilityRole="button"
      className="absolute rounded-full bg-white p-2"
      onPress={onPress}
    >
      <Icon color="#000" name={PlayIcon} size={40} />
    </Pressable>
  </View>
);
