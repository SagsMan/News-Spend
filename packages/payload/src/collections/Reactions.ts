import { sql } from "@payloadcms/db-postgres";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  PayloadRequest,
} from "payload";

import notifyOnCommentLike from "../hooks/reactions/notifyOnCommentLike";

type ReactionDoc = {
  id: string | number;
  target?: {
    relationTo?: string;
    value?: string | { id?: string } | null;
  } | null;
  news?: string | { id?: string } | null;
  [key: string]: unknown;
};

async function recalculateCounts(
  doc: ReactionDoc,
  req: PayloadRequest
): Promise<unknown> {
  try {
    const { payload } = req;

    let targetId: string | undefined;
    let targetCollection: "news" | "comments" | undefined;
    if (doc.target) {
      targetId =
        typeof doc.target.value === "object"
          ? doc.target.value?.id
          : (doc.target.value ?? undefined);
      targetCollection = doc.target.relationTo as
        | "news"
        | "comments"
        | undefined;
    }

    if (!targetId && doc.news) {
      targetId = typeof doc.news === "object" ? doc.news.id : doc.news;
      targetCollection = "news";
    }

    if (!(targetId && targetCollection)) {
      return doc;
    }

    const [likesCount, dislikesCount] = await Promise.all([
      payload.count({
        collection: "reactions",
        where: {
          "target.value": { equals: targetId },
          "target.relationTo": { equals: targetCollection },
          type: { equals: "like" },
        },
        req,
      }),
      payload.count({
        collection: "reactions",
        where: {
          "target.value": { equals: targetId },
          "target.relationTo": { equals: targetCollection },
          type: { equals: "dislike" },
        },
        req,
      }),
    ]);

    // Raw SQL (not payload.update) on purpose: news is a drafts/versions
    // collection, and a normal update writes a new _news_v snapshot on every
    // call. Every like/dislike was generating a junk editorial-history
    // entry (the same bug as the news.views counter, fixed separately). Raw
    // SQL is also atomic and bypasses hooks entirely; targetCollection is a
    // closed set ("news" | "comments"), never user input, so the literal
    // table name below isn't an injection risk.
    if (targetCollection === "news") {
      await payload.db.drizzle.execute(sql`
        UPDATE news
        SET likes_count = ${likesCount.totalDocs},
            dislikes_count = ${dislikesCount.totalDocs}
        WHERE id = ${targetId}
      `);
    } else {
      await payload.db.drizzle.execute(sql`
        UPDATE comments
        SET likes_count = ${likesCount.totalDocs},
            dislikes_count = ${dislikesCount.totalDocs}
        WHERE id = ${targetId}
      `);
    }
    return doc;
  } catch (error) {
    req.payload.logger.error(
      { error },
      "Failed to recalculate reaction counts"
    );
  }
}

const afterChange: CollectionAfterChangeHook = ({ doc, req }) =>
  recalculateCounts(
    doc as ReactionDoc,
    req
  ) as ReturnType<CollectionAfterChangeHook>;

const afterDelete: CollectionAfterDeleteHook = ({ doc, req }) =>
  recalculateCounts(
    doc as ReactionDoc,
    req
  ) as ReturnType<CollectionAfterDeleteHook>;

const Reactions: CollectionConfig = {
  slug: "reactions",
  hooks: {
    afterChange: [afterChange, notifyOnCommentLike],
    afterDelete: [afterDelete],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "news",
      type: "relationship",
      relationTo: "news",
      index: true,
      admin: {
        hidden: true,
        description:
          "Legacy field. Kept during the polymorphic-target migration. Will be removed after the data migration confirms all rows have `target` set.",
      },
    },
    {
      name: "target",
      type: "relationship",
      relationTo: ["news", "comments"],
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      options: ["like", "dislike", "none"],
      required: true,
    },
  ],
};

export default Reactions;
