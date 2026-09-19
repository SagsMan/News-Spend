import type { RefObject } from "react";
import { type TextInput, View } from "react-native";
import type { RouterOutputs } from "#/lib/orpc";
import Reply from "./Reply";

type HighlightedReplyProps = {
  comment: RouterOutputs["comments"]["one"];
  inputRef?: RefObject<TextInput | null>;
};

/**
 * The comment a push notification pointed at (a new reply, or the liked
 * comment), pinned directly under the thread root so it's immediately
 * visible without scrolling. The regular reply list continues below and
 * filters this comment out to avoid showing it twice.
 *
 * Data-fetching is handled by the parent so both the root comment and
 * highlighted comment load in parallel (via TanStack Query useQueries)
 * and can seed from the same paginated cache.
 */
export function HighlightedReply({ comment, inputRef }: HighlightedReplyProps) {
  return (
    <View className="">
      <Reply comment={comment} inputRef={inputRef} />
    </View>
  );
}
