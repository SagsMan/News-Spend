import type { News } from "@news-spend-media/payload/types";
import { useNavigation } from "@react-navigation/native";
import { memo } from "react";
import { Pressable, Text } from "react-native";

const ReadAlso = memo(function ReadAlso({ news }: { news: News }) {
  const navigation = useNavigation();

  const onPress = () => {
    navigation.navigate("News", {
      id: news.id as string,
      slug: news.slug as string,
    });
  };

  const label = "Read Also";

  return (
    <Pressable
      accessibilityLabel={`${label}: ${news.title}`}
      accessibilityRole="link"
      className="my-3 rounded-r-md border-primary border-l-2 bg-foreground/5 px-3 py-2 active:opacity-70"
      onPress={onPress}
    >
      <Text className="mb-0.5 font-bold text-gray-50 text-sm uppercase tracking-wide">
        {label}
      </Text>
      <Text className="font-semibold text-base text-foreground">
        {news.title}
      </Text>
    </Pressable>
  );
});

export default ReadAlso;
