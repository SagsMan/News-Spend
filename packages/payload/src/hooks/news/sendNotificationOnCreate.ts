import type { CollectionAfterChangeHook } from "payload";

/**
 * Fires when a news article is published for the first time.
 *
 * Creates a Notifications campaign document (status="sending") which triggers
 * the Notifications afterChange hook → expo-push-service.ts → delivery tracking,
 * receipt polling, and inbox entries, all via the new unified push system.
 */
const sendNotificationOnCreate: CollectionAfterChangeHook = async ({
  req,
  doc,
}) => {
  try {
    if (doc?._status !== "published" || doc.hasBeenPublished) {
      return doc;
    }

    let body: string;
    if (doc.type === "article") {
      body = doc.excerpt ? `${doc.excerpt}...` : "New news published!";
    } else {
      body = "New video news published!";
    }

    const notificationType: "news" | "breaking_news" =
      doc.type === "breaking_news" ? "breaking_news" : "news";

    await req.payload.create({
      collection: "notifications",
      data: {
        title: doc.title as string,
        body,
        type: notificationType,
        deliveryAction: "send-now",
        targetType: "all",
        deviceTypes: ["all"],
        priority: "high",
        sound: true,
        _status: "published",
        data: {
          newsId: doc.id,
          type: doc.type,
          url:
            doc.type === "video"
              ? `live/video/${doc.slug}`
              : `news/article/${doc.slug}`,
        },
      },
      req,
    });

    await req.payload.update({
      collection: "news",
      id: doc.id,
      data: { hasBeenPublished: true },
      req,
    });

    return doc;
  } catch (error) {
    req.payload.logger.error({
      msg: "sendNotificationOnCreate: failed to create notification",
      err: error,
      newsId: doc?.id,
    });
    return doc;
  }
};

export default sendNotificationOnCreate;
