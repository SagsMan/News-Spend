/**
 * Shared between notifyOnCommentLike.ts (schedules the debounced job) and the
 * sendCommentLikeNotification task (reads back likes within this same
 * window). Kept in one place so the two can't drift out of sync.
 */
export const LIKE_NOTIFICATION_DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes
