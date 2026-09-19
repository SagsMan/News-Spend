import { useNavigation, useRoute } from "@react-navigation/native";
import { InputGroup } from "heroui-native/input-group";
import { Separator } from "heroui-native/separator";
import { PaperPlaneTiltIcon, XIcon } from "#/lib/icons";
import { type RefObject, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  type TextInput,
  View,
} from "react-native";
import { useSnapshot } from "valtio";

import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import useUpdateComment from "#/hooks/comments/useUpdateComment";
import { useCreateComment } from "#/hooks/news";
import { useKeyboardDismiss } from "#/hooks/use-keyboard-dismiss";
import { useGlobalBackHandler } from "#/hooks/useBackHandler";
import { authState } from "#/state/auth";
import {
  commentState,
  getParentId,
  getReplyingToId,
  resetCommentState,
  setDraft,
} from "#/state/commentState";
import { apiErrorMessage } from "#/utils/apiErrorMessage";
import { getUsername, isRefObject } from "#/utils/comment-utils";
import { Button } from "./heroui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommentBoxProps = {
  newsId: string;
  newsSlug?: string;
  inputRef?:
    | RefObject<TextInput | null>
    | ((instance: TextInput | null) => void);
  onBlur?: () => void;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReplyChip({
  username,
  onDismiss,
}: {
  username: string;
  onDismiss: () => void;
}) {
  return (
    <View className="flex-row items-center gap-1.5 px-2.5 pt-2">
      <Text className="flex-1 text-secondary text-sm" numberOfLines={1}>
        Replying to{" "}
        <Text className="font-bold text-primary text-sm">@{username}</Text>
      </Text>
      <Pressable hitSlop={8} onPress={onDismiss}>
        <Icon className="text-tertiary" name={XIcon} size={16} />
      </Pressable>
    </View>
  );
}

function EditPreview({
  text,
  username,
  onDismiss,
}: {
  text: string;
  username: string;
  onDismiss: () => void;
}) {
  return (
    <View className="flex-row gap-2.5 px-2.5 pt-2">
      <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600">
        <Text className="text-base text-white">
          {username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-sm">{username}</Text>
          <Pressable hitSlop={8} onPress={onDismiss}>
            <Icon className="text-tertiary" name={XIcon} size={16} />
          </Pressable>
        </View>
        <Text className="text-secondary text-sm" numberOfLines={2}>
          {text}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const CommentBox = ({
  newsId,
  newsSlug,
  inputRef,
  onBlur,
}: CommentBoxProps) => {
  const { mode, target, draft } = useSnapshot(commentState);
  const navigation = useNavigation();
  const route = useRoute();
  const routeCommentId = (route.params as { commentId?: string } | undefined)
    ?.commentId;

  const createMutation = useCreateComment(newsSlug as string);
  const updateMutation = useUpdateComment(newsSlug as string);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleKeyboardDismiss = useCallback(() => {
    if (commentState.mode === "reply") {
      commentState.mode = "idle";
      commentState.target = undefined;
      commentState.parent = undefined;
    }
    onBlur?.();
  }, [onBlur]);

  useKeyboardDismiss(inputRef, handleKeyboardDismiss);

  useGlobalBackHandler(() => {
    if (commentState.mode !== "idle") {
      resetCommentState();
      return true;
    }
    return false;
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePost = () => {
    // Read auth at call time (not render time), because a destructured copy would go
    // stale when the user signs in while this screen stays mounted.
    const { user } = authState;
    if (!user || user.isAnonymous) {
      navigation.navigate("SignIn", { redirect: route.name });
      return;
    }
    createMutation.mutate(
      {
        newsId,
        text: draft,
        replyingTo: getReplyingToId(),
        parentId: routeCommentId ?? getParentId(),
      },
      {
        onSuccess: () => {
          resetCommentState();
          if (isRefObject(inputRef)) {
            inputRef.current?.blur();
          }
        },
        onError: (err) => {
          // The draft is deliberately left in the box so the author can edit
          // and retry, since a content-filter rejection asks them to revise.
          toast.error("Comment not posted", {
            description: apiErrorMessage(
              err,
              "Something went wrong. Please try again."
            ),
          });
        },
      }
    );
  };

  const handleSave = () => {
    const editId = commentState.target?.id;
    if (!editId) {
      toast.error("No comment selected to update");
      return;
    }
    toast.loading("Updating comment", { description: "Please wait..." });
    updateMutation.mutate(
      { text: draft, commentId: editId },
      {
        onSuccess: () => {
          resetCommentState();
          toast.dismiss();
          toast.success("Comment updated");
          if (isRefObject(inputRef)) {
            inputRef.current?.blur();
          }
        },
        onError: (err) => {
          toast.dismiss();
          toast.error("Comment not updated", {
            description: apiErrorMessage(
              err,
              "Comment could not be updated. Please try again."
            ),
          });
        },
      }
    );
  };

  const handleCancel = () => {
    resetCommentState();
    if (isRefObject(inputRef)) {
      inputRef.current?.blur();
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isEdit = mode === "edit";
  const isReply = mode === "reply";
  const targetUsername = getUsername(target?.user) ?? "someone";
  const originalText = target?.text ?? "";
  const placeholder = isReply
    ? `Replying to @${targetUsername}…`
    : "Write a comment…";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const composerContent = (
    <View className="w-full bg-background">
      {isReply && (
        <ReplyChip onDismiss={handleCancel} username={targetUsername} />
      )}

      {isEdit && (
        <>
          <EditPreview
            onDismiss={handleCancel}
            text={originalText}
            username={targetUsername}
          />
          <Separator className="mx-2.5 mt-2" />
        </>
      )}

      <View className="gap-2.5 px-2.5 pt-2 pb-2">
        <InputGroup>
          <InputGroup.Input
            autoFocus={isEdit}
            className="rounded-lg align-top text-base"
            multiline
            numberOfLines={4}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColorClassName="accent-gray-400"
            ref={inputRef as never}
            selectionColorClassName="accent-gray-400"
            value={draft}
          />
          <InputGroup.Suffix>
            <Button
              hitSlop={20}
              isDisabled={!draft}
              onPress={isEdit ? handleSave : handlePost}
              size="sm"
            >
              {isPending ? (
                <ActivityIndicator color="#888" size="small" />
              ) : (
                <Icon color="white" name={PaperPlaneTiltIcon} size={20} />
              )}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </View>
    </View>
  );

  if (isEdit) {
    return (
      <>
        {/* Absolutely positioned so it dims the screen without pulling
            composerContent out of the KeyboardAvoidingView's flex flow,
            because composerContent must stay a normal flex child (like the
            new-comment case) so it still gets pushed up above the
            keyboard. */}
        <Pressable
          className="absolute inset-0"
          onPress={handleCancel}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        />
        {composerContent}
      </>
    );
  }

  return composerContent;
};
