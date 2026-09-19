import type { News } from "@news-spend-media/payload/types";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Skeleton } from "heroui-native/skeleton";
import {
  ChatIcon,
  PencilSimpleLineIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "#/lib/icons";
import { Pressable, View } from "react-native";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { useSafeAreaInsetsStyle } from "#/utils/useSafeAreaInsetsStyle";
import { ShareNews } from "./ShareNews";

type NewsActionBarProps = {
  news: News;
  onComment?: () => void;
  onDislike?: () => void;
  onLike?: () => void;
  onShare?: (shareMethod: string) => void;
};

export function NewsActionBar(props: NewsActionBarProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsetsStyle(["bottom"]);

  const isLiked = props.news?.userReaction === "like";
  const isDisliked = props.news?.userReaction === "dislike";

  const navigateToComments = (focus?: boolean) => {
    props.onComment?.();
    navigation.navigate("Comment", {
      newsId: props.news?.id!,
      newsSlug: props.news?.slug!,
      focus,
    });
  };

  return (
    <Skeleton className="h-17.5" isLoading={!props.news}>
      <View
        className="w-full flex-row items-center justify-around border-t border-t-[#E5E5E5] bg-s-50 py-2.5"
        style={insets}
      >
        {/* Comment input button */}
        <Pressable
          className="mx-2 h-10 flex-3 flex-row items-center justify-around overflow-hidden rounded-[20px] bg-p-500 px-1.5 active:opacity-80"
          onPress={() => navigateToComments(true)}
        >
          <Text className="text-background">Let's talk about it</Text>
          <Icon color="white" name={PencilSimpleLineIcon} size={16} />
        </Pressable>

        {/* Comment count */}
        <View className="flex-1 items-center justify-center">
          <Pressable onPress={() => navigateToComments()}>
            <View className="relative">
              <Icon className="text-p-500" name={ChatIcon} size={30} />
              <View className="absolute bottom-4.5 left-7.25">
                <Text className="font-semibold text-xs">
                  {props.news?.totalComments ?? 0}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Like button */}
        <View className="flex-1 items-center justify-center">
          <Pressable onPress={() => props.onLike?.()}>
            <View className="relative">
              <Icon
                className="text-p-500"
                name={ThumbsUpIcon}
                size={30}
                weight={isLiked ? "fill" : "bold"}
              />
              <View className="absolute bottom-4.5 left-7">
                <Text className="font-semibold text-xs">
                  {(props.news?.likesCount ?? 0) +
                    (props.news?.totalCommentLikes ?? 0)}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Dislike button */}
        <View className="flex-1 items-center justify-center">
          <Pressable onPress={() => props.onDislike?.()}>
            <View className="relative">
              <Icon
                className="text-p-500"
                name={ThumbsDownIcon}
                size={30}
                weight={isDisliked ? "fill" : "bold"}
              />
              <View className="absolute bottom-4.5 left-7.25">
                <Text className="font-semibold text-xs">
                  {props.news?.dislikesCount ?? 0}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Share button */}
        <View className="flex-1 items-center justify-center">
          <ShareNews news={props.news} onShare={props.onShare} />
        </View>
      </View>
    </Skeleton>
  );
}
