import { NextResponse } from "next/server";
import { getTweet } from "react-tweet/api";

import { requireAdmin } from "../../_lib/requireAdmin";

/** A tweet id is a snowflake: digits only, and never longer than 20 of them. */
const TWEET_ID = /^\d{1,20}$/;

/**
 * GET /api/tweet/:id
 *
 * Backs the TwitterPost Lexical block's preview in the admin editor, and
 * nothing else — the mobile app renders tweets through its own embed, and the
 * public API has its own rate-limited procedure for this.
 *
 * Admin-only. Outside the `(payload)` group nothing authenticates a route by
 * default, so this was an open proxy: unauthenticated callers could drive
 * arbitrary requests to Twitter's syndication API with our server as the
 * egress, at whatever rate they liked.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request.headers);
  if (denied) {
    return denied;
  }

  const { id } = await params;

  if (!TWEET_ID.test(id)) {
    return NextResponse.json(
      { data: null, error: "Invalid tweet ID" },
      { status: 400 }
    );
  }

  try {
    const tweet = await getTweet(id);

    return NextResponse.json({ data: tweet });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch tweet",
      },
      { status: 400 }
    );
  }
}
