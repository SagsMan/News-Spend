import type { BasePayload, PayloadRequest } from "payload";

/**
 * Builds the deep-link `data.url` for a comment push notification:
 *
 *   news/article/<slug>/comment/<rootCommentId>/<highlightCommentId>
 *   live/video/<slug>/comment/<rootCommentId>/<highlightCommentId>
 *
 * The `<tab>/<path>` shape matches what the app's push-response handler
 * expects (apps/native/src/navigation/linking.tsx), and the path segments
 * match the CommentReply / LiveCommentReply linking config
 * (apps/native/src/navigation/shared-screens.tsx). `highlightCommentId` is
 * the comment the notification is about (a new reply or the liked comment);
 * the screen renders it pinned under the thread root.
 *
 * Returns null when the news doc can't be resolved. Callers should then
 * send the notification without a url (push still delivered, no deep link).
 */
export async function getCommentThreadUrl({
  payload,
  req,
  newsId,
  rootCommentId,
  highlightCommentId,
}: {
  payload: BasePayload;
  req?: PayloadRequest;
  newsId: string;
  rootCommentId: string;
  highlightCommentId: string;
}): Promise<string | null> {
  try {
    const news = await payload.findByID({
      collection: "news",
      id: newsId,
      depth: 0,
      req,
    });

    if (!news?.slug) {
      return null;
    }

    // Article-only: video was removed from the News type options, so the
    // `live/video/...` branch this used to have was unreachable. Restore it
    // alongside the option if video ever comes back.
    return `news/article/${news.slug}/comment/${rootCommentId}/${highlightCommentId}`;
  } catch (error) {
    payload.logger.error(
      { error, newsId },
      "getCommentThreadUrl: failed to resolve news for deep link"
    );
    return null;
  }
}
