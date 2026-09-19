import type { News } from "@news-spend-media/api/router/news/content-builders";
import { useNavigation } from "@react-navigation/native";
import { Card } from "heroui-native/card";
import { Pressable, useWindowDimensions } from "react-native";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import { isAdReady, shouldShowNewsClickAd } from "#/state/adManager";
import { appOpenAdSheetState } from "#/state/appOpenAdState";
import { getImageData } from "#/utils/getImageData";

const VideoNewsItem = ({ videoNews }: { videoNews: News }) => {
  const { height } = useWindowDimensions();
  const navigation = useNavigation();

  const onPress = () => {
    if (
      shouldShowNewsClickAd() &&
      (isAdReady("news-click-ads") || appOpenAdSheetState.nativeAdReady)
    ) {
      appOpenAdSheetState.open("news-click-ads", onAdClose);
    } else {
      navigation.navigate("News", {
        slug: videoNews.slug,
        id: videoNews.id,
      });
    }
  };

  const onAdClose = () => {
    navigation.navigate("News", {
      slug: videoNews.slug,
      id: videoNews.id,
    });
  };

  if (!videoNews) {
    return null;
  }
  const { url, blurhash } = getImageData(videoNews.image);

  return (
    <Pressable
      className="w-full overflow-hidden"
      onPress={onPress}
      style={{ height: height * 0.3 }}
    >
      <Card className="w-full flex-1 rounded-lg p-0">
        <Card.Header className="flex-1">
          <Image
            className="h-full w-full"
            placeholder={{ blurhash }}
            placeholderContentFit="cover"
            source={url}
          />
        </Card.Header>
        <Card.Footer className="absolute inset-be-0 inset-x-0 bg-p-500 px-5 py-3">
          <Text className="font-bold text-s-50" numberOfLines={2}>
            {videoNews?.title}
          </Text>
        </Card.Footer>
      </Card>
    </Pressable>
  );
};
export default VideoNewsItem;
