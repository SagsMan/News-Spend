import { useNavigation, useRoute } from "@react-navigation/native";
import { formatDistance } from "date-fns/formatDistance";
import { Separator } from "heroui-native/separator";
import {
  ArrowBendUpLeftIcon,
  ClockIcon,
  HeartStraightIcon,
} from "#/lib/icons";
import { memo, type RefObject } from "react";
import { type TextInput, View } from "react-native";
import { useSnapshot } from "valtio";

import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import useLikeComment from "#/hooks/comments/useLikeComment";
import { orpc, type RouterOutputs } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { authState } from "#/state/auth";
import { startReply } from "#/state/commentState";
import { isRefObject } from "#/utils/comment-utils";
import { avatarColor } from "#/utils/index";
import CommentOptionPopover from "./CommentOptionPopover";

type Comment = RouterOutputs["comments"]["one"];

type CommentReplyProps = {
  comment: Comment;
  inputRef?: RefObject<TextInput | null>;
  parentId?: string;
  replyingTo?: string;
  setReplyingTo?: (id: string) => void;
  setParentId?: (id: string) => void;
};

const Reply = memo(({ comment, inputRef }: CommentReplyProps) => {
  const route = useRoute();
  const { commentId: parentCommentId, newsId } = route.params as {
    commentId?: string;
    newsId?: string;
  };
  const { mutate } = useLikeComment(newsId ?? "", parentCommentId);
  const auth = useSnapshot(authState);
  const navigation = useNavigation();

  const isLiked = comment.userReaction === "like";

  const parentComment = queryClient.getQueryData([
    orpc.comments.getComment.queryOptions({
      input: parentCommentId,
    }).queryKey,
  ]);

  const onReply = () => {
    startReply(comment, parentComment);
    setTimeout(() => {
      if (isRefObject(inputRef) && inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const onLike = () => {
    if (!authState.user || authState.user.isAnonymous) {
      return navigation.navigate("SignIn", {
        redirect: "CommentReply",
      });
    }

    mutate(comment.id);
  };

  const commentUser = typeof comment.user === "object" ? comment.user : null;
  const username = commentUser?.username ?? "Unknown";

  return (
    <View className="ml-8 px-2.5">
      <View className="flex-row">
        <View className="flex-1 flex-row gap-2.5">
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: avatarColor(commentUser?.id) }}
          >
            <Text className="text-base text-white">
              {username.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="flex-1 gap-2">
            <View className="flex-row items-center justify-between">
              <View className="gap-0">
                <Text className="font-bold text-[#0A0909]" variant="caption">
                  {username.charAt(0).toUpperCase() + username.slice(1)}{" "}
                  {(typeof comment.user !== "string" && comment.user?.id) ===
                    auth.user?.id && "(You)"}
                </Text>

                <View className="flex-row items-center gap-1">
                  <Icon color="#737373" name={ClockIcon} size={14} />
                  <Text className="text-[#737373] text-sm">
                    {formatDistance(new Date(comment.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>
              </View>
            </View>

            <Text className="text-[#0A0909] text-[15px] leading-[18px]">
              {comment.text}
            </Text>

            <View className="flex-row items-center gap-5">
              <Button
                className="flex-row items-center gap-1 p-0"
                onPress={onLike}
                variant="ghost"
              >
                <Icon
                  color={isLiked ? "#fb2d2d" : "#737373"}
                  name={HeartStraightIcon}
                  size={16}
                  weight={isLiked ? "fill" : "bold"}
                />
                <Button.Label
                  className={
                    isLiked
                      ? "text-[#fb2d2d] text-sm"
                      : "text-[#737373] text-sm"
                  }
                >
                  {isLiked ? "Liked" : "Like"}
                </Button.Label>
              </Button>

              <Button className="p-0" onPress={onReply} variant="ghost">
                <Icon color="#737373" name={ArrowBendUpLeftIcon} size={16} />
                <Button.Label className="text-[#737373] text-[15px]">
                  Reply
                </Button.Label>
              </Button>
            </View>
          </View>
        </View>

        <View className="items-center justify-between">
          <CommentOptionPopover comment={comment} />
        </View>
      </View>

      <Separator className="my-3.5" />
    </View>
  );
});

export default Reply;
