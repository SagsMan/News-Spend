import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { DotsThreeVerticalIcon } from "#/lib/icons";
import React from "react";
import { Alert } from "react-native";

import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { toast } from "#/components/heroui/toast";
import CommentOptionSheet from "#/components/sheets/CommentOptionSheet";
import PostReportSheet from "#/components/sheets/PostReportSheet";
import type { RouterOutputs } from "#/lib/orpc";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { authState } from "#/state/auth";

type Comment = RouterOutputs["comments"]["one"];

export function CommentOptionPopover({ comment }: { comment: Comment }) {
  const [open, setOpen] = React.useState(false);
  const [showReportSheet, setShowReportSheet] = React.useState(false);
  const navigation = useNavigation();

  /**
   * Reporting and blocking both require a registered account. Guests still see
   * the options. Hiding them entirely is what left reviewers unable to find
   * any moderation affordance, but tapping one routes to sign-in, matching
   * how the Like button already treats anonymous users.
   */
  const requireAccount = () => {
    if (!authState.user || authState.user.isAnonymous) {
      setOpen(false);
      // `redirect` is only read as truthy; it makes the sign-in screen
      // goBack() on success, returning the user to this comment.
      navigation.navigate("SignIn", { redirect: true });
      return false;
    }
    return true;
  };

  const commentUserId =
    typeof comment.user === "object" ? comment.user.id : comment.user;

  const commentUsername =
    typeof comment.user === "object" ? comment.user.username : "";

  const blockMutation = useMutation(
    orpc.block.blockUser.mutationOptions({
      onError() {
        toast.dismiss();
        toast.error("Failed to block user");
      },
      onSuccess() {
        toast.dismiss();
        toast.success(
          "User blocked. Their comments will no longer appear in your feed."
        );

        const blockedUserId = commentUserId;
        const newsId =
          typeof comment.news === "object" ? comment.news.id : comment.news;

        let removedCount = 0;

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
          for (const doc of docs) {
            const docNewsId =
              typeof doc.news === "object" ? doc.news?.id : doc.news;
            const uid = typeof doc.user === "object" ? doc.user?.id : doc.user;
            if (docNewsId === newsId && uid === blockedUserId) {
              removedCount++;
            }
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
                    page.docs?.filter((doc: any) => {
                      const uid =
                        typeof doc.user === "object" ? doc.user?.id : doc.user;
                      return uid !== blockedUserId;
                    }) ?? [],
                })),
              };
            }
            return {
              ...old,
              docs:
                old.docs?.filter((doc: any) => {
                  const uid =
                    typeof doc.user === "object" ? doc.user?.id : doc.user;
                  return uid !== blockedUserId;
                }) ?? [],
            };
          }
        );

        queryClient.invalidateQueries({
          queryKey: orpc.comments.all.queryKey(),
        });

        if (removedCount > 0) {
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
                totalComments: Math.max(
                  0,
                  (old.totalComments ?? removedCount) - removedCount
                ),
              };
            }
          );
        }
      },
    })
  );

  const handleBlock = () => {
    if (!requireAccount()) {
      return;
    }

    Alert.alert(
      "Block User",
      `Block @${commentUsername}? You won't see their comments anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            toast.loading("Blocking user...", {
              duration: Number.POSITIVE_INFINITY,
            });
            blockMutation.mutate({ userId: commentUserId });
          },
        },
      ]
    );
  };

  return (
    <>
      <Button
        className="p-1"
        hitSlop={8}
        onPress={() => setOpen(true)}
        variant="ghost"
      >
        <Icon name={DotsThreeVerticalIcon} size={24} />
      </Button>

      <CommentOptionSheet
        comment={comment}
        onBlock={handleBlock}
        onOpenChange={setOpen}
        onReport={() => {
          if (!requireAccount()) {
            return;
          }
          setOpen(false);
          setShowReportSheet(true);
        }}
        open={open}
      />

      <PostReportSheet
        commentUserId={commentUserId}
        commentUsername={commentUsername}
        onOpenChange={setShowReportSheet}
        open={showReportSheet}
        postId={comment.id}
        relationTo="comments"
      />
    </>
  );
}

export default CommentOptionPopover;
