import { proxy, subscribe } from "valtio";
import type { RouterOutputs } from "#/lib/orpc";

type CommentMode = "idle" | "reply" | "edit";

type CommentOne = RouterOutputs["comments"]["one"];

type CommentState = {
  /** Draft text. Persists across keyboard dismiss so the user never loses work. */
  draft: string;
  mode: CommentMode;
  /**
   * reply mode → the top-level parent comment thread (used as parentId on submit)
   * edit mode  → always undefined
   */
  parent: CommentOne | undefined;
  /**
   * reply mode → the specific comment being replied to (may be a nested reply)
   * edit mode  → the comment being edited
   */
  target: CommentOne | undefined;
};

export const commentState = proxy<CommentState>({
  mode: "idle",
  target: undefined,
  parent: undefined,
  draft: "",
});

/**
 * Open the composer in reply mode.
 *
 * @param replyingToComment - The comment the user tapped "Reply" on.
 * @param parentComment     - The top-level parent (pass when replying to a nested reply).
 *                            Falls back to `replyingToComment` if omitted.
 *
 */
export function startReply(
  replyingToComment: CommentOne,
  parentComment?: CommentOne
) {
  commentState.mode = "reply";
  commentState.target = replyingToComment;
  commentState.parent = parentComment ?? replyingToComment;
  // Draft intentionally not cleared, as the user may have been mid-typing.
}

/**
 * Open the composer in edit mode, pre-filling the draft with the comment's text.
 */
export function startEdit(comment: CommentOne) {
  commentState.mode = "edit";
  commentState.target = comment;
  commentState.parent = undefined;
  commentState.draft = comment?.text ?? "";
}

/**
 * Reset the composer back to idle and clear all state.
 */
export function resetCommentState() {
  commentState.mode = "idle";
  commentState.target = undefined;
  commentState.parent = undefined;
  commentState.draft = "";
}

/** Update the draft text without touching mode or target. */
export function setDraft(text: string) {
  commentState.draft = text;
}

// ---------------------------------------------------------------------------
// Convenience read helpers (avoid repetitive optional chaining at call sites)
// ---------------------------------------------------------------------------

/** The ID to pass as `replyingTo` on comment create. Undefined in idle/edit mode. */
export function getReplyingToId(): string | undefined {
  return commentState.mode === "reply" ? commentState.target?.id : undefined;
}

/** The ID to pass as `parentId` on comment create. Undefined in idle/edit mode. */
export function getParentId(): string | undefined {
  return commentState.mode === "reply" ? commentState.parent?.id : undefined;
}

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

if (__DEV__) {
  subscribe(commentState, () => {
    console.log(
      "[commentState]",
      JSON.stringify({
        mode: commentState.mode,
        target: commentState.target?.id,
        parent: commentState.parent?.id,
        draftLength: commentState.draft.length,
      })
    );
  });
}
