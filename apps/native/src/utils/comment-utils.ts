import type { RefObject } from "react";
import type { RouterOutputs } from "#/lib/orpc";

type CommentOne = RouterOutputs["comments"]["one"];

// ---------------------------------------------------------------------------
// Ref helpers
// ---------------------------------------------------------------------------

/**
 * Narrows a ref prop to a RefObject so you can safely access `.current`.
 *
 * @example
 * if (isRefObject(inputRef) && inputRef.current) {
 *   inputRef.current.focus();
 * }
 */
export function isRefObject<T>(
  ref?: RefObject<T> | ((instance: T | null) => void)
): ref is RefObject<T> {
  return !!ref && typeof ref !== "function" && "current" in ref;
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

/**
 * Safely extract a display username from a comment's `user` field.
 * The field may be a populated object or a bare string ID depending on
 * whether the query depth included it.
 */
export function getUsername(
  user: CommentOne["user"] | undefined
): string | undefined {
  if (!user) {
    return;
  }
  if (typeof user === "string") {
    return; // bare ID, no name available
  }
  return (user as { username?: string }).username ?? undefined;
}

/** First character of the username, uppercased. Falls back to "?". */
export function getUserInitial(user: CommentOne["user"] | undefined): string {
  const name = getUsername(user);
  return name ? name.charAt(0).toUpperCase() : "?";
}
