import { useMutation } from "@tanstack/react-query";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { Checkbox } from "heroui-native/checkbox";
import { ControlField } from "heroui-native/control-field";
import { Description } from "heroui-native/description";
import { RadioGroup } from "heroui-native/radio-group";
import { X } from "#/lib/icons";
import React, { useId } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

const reportReasons = [
  { label: "Spam or Advertising", value: "spam" },
  { label: "Harassment or Bullying", value: "harassment" },
  { label: "Hate Speech or Discrimination", value: "hate-speech" },
  { label: "Misinformation", value: "misinformation" },
  { label: "Personal Information", value: "personal-info" },
  { label: "Explicit or Inappropriate Content", value: "inappropriate" },
  { label: "Off-Topic", value: "off-topic" },
  { label: "Trolling or Deliberate Provocation", value: "trolling" },
  { label: "Illegal Activity", value: "illegal" },
] as const;

type PostReportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  relationTo: "comments" | "news";
  additionalDetails?: string;
  commentUserId?: string;
  commentUsername?: string;
};

function PostReportSheet(props: PostReportSheetProps) {
  const mutation = useMutation(orpc.postReport.create.mutationOptions());
  const blockMutation = useMutation(
    orpc.block.blockUser.mutationOptions({
      onSuccess() {
        toast.success("User blocked", {
          description: "Their comments will no longer appear in your feed.",
        });
      },
      onError() {
        toast.error("Failed to block user");
      },
    })
  );
  const [reason, setReason] = React.useState("");
  const [alsoBlock, setAlsoBlock] = React.useState(true);
  const insets = useSafeAreaInsets();
  const id = useId();

  const showBlockToggle =
    props.commentUserId != null && props.commentUsername != null;

  const onSubmit = () => {
    mutation.mutate(
      {
        reason,
        reportedItem: props.postId,
        relationTo: props.relationTo,
        additionalDetails: props.additionalDetails ?? "",
      },
      {
        onSuccess: () => {
          props.onOpenChange(false);
          toast.success("Report submitted!", {
            description: "Thank you for your feedback!",
          });

          const commentId = props.postId;
          let newsId: string | undefined;

          for (const query of queryClient.getQueryCache().findAll({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              Array.isArray(query.queryKey[0]) &&
              query.queryKey[0][0] === "comments" &&
              query.queryKey[0][1] === "all",
          })) {
            const data = query.state.data as any;
            if (!data) {
              continue;
            }
            const docs = data.pages
              ? data.pages.flatMap((p: any) => p.docs ?? [])
              : (data.docs ?? []);
            const match = docs.find((d: any) => d.id === commentId);
            if (match) {
              newsId =
                typeof match.news === "object" ? match.news?.id : match.news;
            }
          }

          queryClient.setQueriesData(
            {
              predicate: (query) =>
                Array.isArray(query.queryKey) &&
                Array.isArray(query.queryKey[0]) &&
                query.queryKey[0][0] === "comments" &&
                query.queryKey[0][1] === "all",
            },
            (old: any) => {
              if (!old) {
                return old;
              }
              if ("pages" in old) {
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    docs:
                      page.docs?.filter((d: any) => d.id !== commentId) ?? [],
                  })),
                };
              }
              return {
                ...old,
                docs: old.docs?.filter((d: any) => d.id !== commentId) ?? [],
              };
            }
          );

          queryClient.invalidateQueries({
            queryKey: orpc.comments.all.queryKey(),
          });

          if (newsId) {
            queryClient.setQueriesData(
              {
                predicate: (query) =>
                  Array.isArray(query.queryKey) &&
                  Array.isArray(query.queryKey[0]) &&
                  query.queryKey[0][0] === "news",
              },
              (old: any) => {
                if (!old || old.id !== newsId) {
                  return old;
                }
                return {
                  ...old,
                  totalComments: Math.max(0, (old.totalComments ?? 1) - 1),
                };
              }
            );
          }

          if (alsoBlock && props.commentUserId) {
            blockMutation.mutate({ userId: props.commentUserId });
          }
        },
        onError: (err) => {
          console.log(err);
          toast.error("Error submitting report", {
            description: "Something went wrong",
          });
        },
      }
    );
  };

  return (
    <BottomSheet isOpen={props.open} onOpenChange={props.onOpenChange}>
      {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders in
      a separate native window and blocks the RN element inspector. */}
      <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
        <BottomSheet.Overlay />
        <BottomSheet.Content style={{ paddingBottom: insets.bottom }}>
          <View className="gap-3.5 px-3 pt-3">
            <View className="flex-row justify-between">
              <View className="gap-1">
                <Text className="font-bold text-lg">Report this comment</Text>
                <Text className="text-gray-500 text-sm">
                  Why are you reporting this comment?
                </Text>
              </View>
              <Button
                className="size-8 rounded-full bg-[#d9d9d9]"
                onPress={() => props.onOpenChange(false)}
              >
                <Icon name={X} size={20} weight="regular" />
              </Button>
            </View>

            <View className="h-px bg-gray-200" />

            <RadioGroup onValueChange={setReason} value={reason}>
              <View className="gap-0">
                {reportReasons.map((r) => (
                  <RadioGroup.Item
                    className="py-2"
                    key={`${r.value}-${props.postId}-${id}`}
                    value={r.value}
                  >
                    {r.label}
                  </RadioGroup.Item>
                ))}
              </View>
            </RadioGroup>

            {showBlockToggle && (
              <>
                <View className="h-px bg-gray-200" />
                <ControlField
                  className="flex-col items-start gap-1"
                  isSelected={alsoBlock}
                  onSelectedChange={setAlsoBlock}
                >
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Description>
                        Also block @{props.commentUsername}
                      </Description>
                    </View>
                    <ControlField.Indicator className="mt-0.5">
                      <Checkbox className="rounded-sm border border-field-border" />
                    </ControlField.Indicator>
                  </View>
                </ControlField>
              </>
            )}

            <Button
              className="w-full"
              isDisabled={mutation.isPending || !reason}
              onPress={onSubmit}
            >
              <Button.Label>
                {mutation.isPending ? "Submitting..." : "Submit"}
              </Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

export default PostReportSheet;
