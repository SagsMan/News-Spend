import { differenceInHours } from "date-fns";
import type { Payload } from "payload";

export type Weights = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reads?: number;
  dislikes?: number;
};

function envNumber(name: string, fallback: number) {
  const v = process.env[name];
  if (!v) {
    return fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function computeScore(
  signals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reads: number;
    dislikes: number;
    createdAt: string | Date;
  },
  weights?: Weights
) {
  const W_VIEWS = weights?.views ?? envNumber("TREND_WEIGHT_VIEWS", 1.0);
  const W_LIKES = weights?.likes ?? envNumber("TREND_WEIGHT_LIKES", 3.0);
  const W_COMMENTS =
    weights?.comments ?? envNumber("TREND_WEIGHT_COMMENTS", 5.0);
  const W_SHARES = weights?.shares ?? envNumber("TREND_WEIGHT_SHARES", 4.0);
  const W_READS = weights?.reads ?? envNumber("TREND_WEIGHT_READS", 2.0);
  const W_DISLIKES =
    weights?.dislikes ?? envNumber("TREND_WEIGHT_DISLIKES", -1.5);

  const rawScore =
    signals.views * W_VIEWS +
    signals.likes * W_LIKES +
    signals.comments * W_COMMENTS +
    signals.shares * W_SHARES +
    signals.reads * W_READS +
    signals.dislikes * W_DISLIKES;

  const hours = Math.max(
    0,
    differenceInHours(new Date(), new Date(signals.createdAt))
  );
  const timeFactor = (1 + hours / 24) ** 1.5;

  return rawScore / (timeFactor || 1);
}

type ScoringOptions = {
  payload: Payload;
  lookbackHours?: number; // how far back to consider articles
  weights?: Weights;
};

export async function computeTrendingScores(opts: ScoringOptions) {
  const { payload, lookbackHours = 168, weights } = opts; // default 7 days

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Fetch recent published articles
  const newsResult = await payload.find({
    collection: "news",
    where: {
      _status: { equals: "published" },
      createdAt: { greater_than_equal: since },
    },
    pagination: false,
    depth: 0,
    // only the scoring signals: without this, every article's rich-text body
    // is loaded into memory just to be discarded
    select: {
      views: true,
      likesCount: true,
      dislikesCount: true,
      createdAt: true,
    },
  });

  const docs = newsResult.docs;

  // For each article, compute engagement counts and score
  const scored: { id: string; score: number }[] = [];

  for (const doc of docs) {
    const id = doc.id as string;

    const views = Number(doc.views ?? 0);
    const likes = Number(doc.likesCount ?? 0);
    const dislikes = Number(doc.dislikesCount ?? 0);

    // counts only: count() aggregates in the database instead of hydrating
    // every matching row, which otherwise dominates this job's memory use
    const [comments, shares, reads] = await Promise.all([
      payload.count({
        collection: "comments",
        where: { news: { equals: id } },
      }),
      payload.count({
        collection: "activities",
        where: { news: { equals: id }, action: { equals: "share" } },
      }),
      payload.count({
        collection: "activities",
        where: { news: { equals: id }, action: { equals: "read" } },
      }),
    ]);
    const commentsCount = comments.totalDocs ?? 0;
    const sharesCount = shares.totalDocs ?? 0;
    const readCount = reads.totalDocs ?? 0;

    const score = computeScore(
      {
        views,
        likes,
        comments: commentsCount,
        shares: sharesCount,
        reads: readCount,
        dislikes,
        createdAt: doc.createdAt,
      },
      weights
    );

    scored.push({ id, score });
  }

  // sort descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
