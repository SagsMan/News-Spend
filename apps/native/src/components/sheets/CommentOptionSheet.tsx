import { BottomSheet } from "heroui-native/bottom-sheet";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSnapshot } from "valtio";
import { Text } from "#/components/heroui/text";
import useDeleteComment from "#/hooks/comments/useDeleteComment";
import type { RouterOutputs } from "#/lib/orpc";
import { authState } from "#/state/auth";
import { startEdit } from "#/state/commentState";

type Comment = RouterOutputs["comments"]["one"];

export type CommentOptionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comment: Comment;
  onBlock?: () => void;
  onReport: () => void;
};

export function CommentOptionSheet({
  open,
  onOpenChange,
  comment,
  onBlock,
  onReport,
}: CommentOptionSheetProps) {
  const insets = useSafeAreaInsets();
  const auth = useSnapshot(authState);
  const deleteMutation = useDeleteComment();

  const onDelete = () => {
    onOpenChange(false);
    deleteMutation.mutate(comment.id);
  };

  const onEdit = () => {
    onOpenChange(false);
    startEdit(comment);
  };

  const isLessThan15Minutes =
    Date.now() - new Date(comment.createdAt).getTime() < 900_000;

  const commentUserId =
    typeof comment.user === "object" ? comment.user.id : comment.user;

  const commentUsername =
    typeof comment.user === "object" ? comment.user.username : "";

  const isOwner = auth.session?.user?.id === commentUserId;

  return (
    <BottomSheet isOpen={open} onOpenChange={onOpenChange}>
      {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders in
      a separate native window and blocks the RN element inspector. */}
      <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
        <BottomSheet.Overlay />
        <BottomSheet.Content style={{ paddingBottom: insets.bottom }}>
          <View className="gap-2 px-3 pt-3">
            {isOwner && (
              <>
                {isLessThan15Minutes && (
                  <SheetRow label="Edit" onPress={onEdit} />
                )}
                <SheetRow
                  danger
                  disabled={deleteMutation.isPending}
                  label="Delete"
                  onPress={onDelete}
                />
              </>
            )}
            {!isOwner && (
              <>
                {onBlock && (
                  <SheetRow
                    label={`Block @${commentUsername}`}
                    onPress={onBlock}
                  />
                )}
                <SheetRow label="Report" onPress={onReport} />
              </>
            )}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function SheetRow({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className={`rounded-lg px-3 py-3 active:opacity-60 ${danger ? "bg-danger/10" : "bg-default"}`}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        className={`text-base ${danger ? "font-semibold text-danger" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default CommentOptionSheet;
