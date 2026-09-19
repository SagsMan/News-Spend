import crypto from "node:crypto";

import { sendNotification } from "@news-spend-media/payload/lib/send-notification";
import { openapi } from "@orpc/openapi";
import type { BasePayload } from "payload";
import z from "zod";

import { publicProcedure } from "../../..";
import { RAPIDO_API_KEY, RAPIDO_SECURE_HASH, THEOREM_API_KEY } from "./schemas";

function verifyTheoremReachHash(
  secretKey: string,
  url: string,
  receivedHash: string
): boolean {
  const signature = crypto
    .createHmac("sha1", secretKey)
    .update(url)
    .digest("base64");

  const expectedHash = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return expectedHash === receivedHash;
}

function verifyRapidoReachHash(
  secretKey: string,
  transactionId: string,
  offerInvitationId: string,
  receivedHash: string
): boolean {
  // RapidoReach API requires MD5 hash verification per their documentation
  // Hash format: MD5(transactionId:offerInvitationId:secretKey)
  const dataToHash = `${transactionId}:${offerInvitationId}:${secretKey}`;
  const expectedHash = crypto
    .createHash("md5")
    .update(dataToHash)
    .digest("hex");

  return expectedHash === receivedHash;
}

async function awardPointsForProvider({
  userId,
  amount,
  description,
  payload,
}: {
  userId: string;
  amount: number;
  description: string;
  payload: BasePayload;
}): Promise<void> {
  try {
    await payload.create({
      collection: "activities",
      data: {
        type: "point",
        point: amount,
        description,
        action: "surveyTask",
        user: userId,
      },
    });

    const { docs: pushTokens } = await payload.find({
      collection: "push-tokens",
      where: {
        user: {
          in: [userId],
        },
      },
    });

    await sendNotification({
      pushTokens,
      title: "Survey Completed",
      body: `You earned ${amount} points!`,
      data: {
        type: "survey",
        id: userId,
      },
    });
  } catch (error) {
    console.error("Error awarding points:", error);
  }
}

export const rapidoPostbackHandler = publicProcedure
  .meta(
    openapi({
      method: "GET",
      path: "/survey/rapido/postback",
      tags: ["survey", "rapido"],
      summary: "RapidoReach postback endpoint",
      description:
        "Receives survey conversion notifications from RapidoReach. See docs: https://docs.rapidoreach.com/docs/v2/api/callbacks",
    })
  )
  .input(
    z.object({
      cmd: z.string().optional(),
      userId: z.string().optional(),
      endUserId: z.string(),
      amt: z.coerce.number().optional(),
      offerInvitationId: z.string().optional(),
      status: z.string(),
      oidHash: z.string().optional(),
      currencyAmt: z.coerce.number().optional(),
      transactionId: z.string().optional(),
      txnHash: z.string().optional(),
      sub_id: z.string().optional(),
      offerTitle: z.string().optional(),
    })
  )
  .output(z.union([z.object({ success: z.number() })]))
  .handler(async ({ input, context, errors }) => {
    console.log("Received Rapido postback:", input);
    const {
      endUserId,
      status,
      currencyAmt,
      transactionId,
      offerInvitationId,
      oidHash,
    } = input;
    const { payload } = context;

    if (!RAPIDO_API_KEY) {
      throw errors.BAD_REQUEST({
        message: "Rapido not configured",
      });
    }

    if (!RAPIDO_SECURE_HASH) {
      throw errors.BAD_REQUEST({
        message: "Rapido secure hash not configured",
      });
    }

    // Verify hash - all three parameters are required for verification
    if (!(oidHash && transactionId && offerInvitationId)) {
      console.error("Missing required parameters for hash verification:", {
        oidHash: !!oidHash,
        transactionId: !!transactionId,
        offerInvitationId: !!offerInvitationId,
      });
      return { success: 0 };
    }

    const isValid = verifyRapidoReachHash(
      RAPIDO_SECURE_HASH,
      transactionId,
      offerInvitationId,
      oidHash
    );
    if (!isValid) {
      console.error("Invalid hash in Rapido postback:", oidHash);
      return { success: 0 };
    }

    const user = await payload.findByID({
      collection: "users",
      id: endUserId,
    });

    if (!user) {
      console.error(`User not found: ${endUserId}`);
      return { success: 0 };
    }

    const statusUpper = status?.toUpperCase();
    if (statusUpper === "COMPLETE" && currencyAmt && currencyAmt > 0) {
      await awardPointsForProvider({
        userId: endUserId,
        amount: Math.floor(currencyAmt),
        description: `Completed RapidoReach survey: ${input.offerTitle || transactionId}`,
        payload,
      });
      console.log(
        `Awarded ${currencyAmt} points to user ${endUserId} for transaction ${transactionId}`
      );
    } else if (statusUpper === "QUOTAFULL" || statusUpper === "TERMINATION") {
      console.log(
        `User ${endUserId} screen-out (${status}) for transaction ${transactionId}`
      );
    }

    return { success: 1 };
  });

export const theoremPostbackHandler = publicProcedure
  .meta(
    openapi({
      method: "GET",
      path: "/survey/theorem/postback",
      tags: ["survey", "theorem"],
      summary: "TheoremReach postback endpoint",
      description:
        "Receives survey conversion notifications from TheoremReach.",
    })
  )
  .input(
    z.object({
      reward: z.coerce.number(),
      currency: z.coerce.number().optional(),
      user_id: z.string(),
      tx_id: z.string(),
      hash: z.string().optional(),
      reversal: z.string().optional(),
      debug: z.string().optional(),
      transaction_id: z.string().optional(),
      screenout: z.coerce.number().optional(),
      profiler: z.coerce.number().optional(),
      status: z.string().optional(),
      offer: z.string().optional(),
      offer_name: z.string().optional(),
      ip: z.string().optional(),
      offer_id: z.string().optional(),
      placement_id: z.string().optional(),
    })
  )
  .output(
    z.union([
      z.object({ success: z.boolean() }),
      z.object({ error: z.string() }),
    ])
  )
  .handler(async ({ input, context, errors }) => {
    console.log("Received Theorem postback:", input);
    const {
      reward,
      user_id,
      tx_id,
      hash,
      reversal,
      debug,
      screenout,
      profiler,
      offer_name,
      transaction_id,
    } = input;
    const { payload } = context;

    if (!THEOREM_API_KEY) {
      throw errors.BAD_REQUEST({
        message: "Theorem not configured",
      });
    }

    if (hash) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(input)) {
        if (key !== "hash" && value !== undefined) {
          params.append(key, String(value));
        }
      }
      const callbackUrl = `/survey/theorem/postback?${params.toString()}`;
      const isValid = verifyTheoremReachHash(
        THEOREM_API_KEY,
        callbackUrl,
        hash
      );
      if (!isValid) {
        console.error("Invalid hash in Theorem postback:", hash);
        return { error: "Invalid hash" };
      }
    }

    if (debug === "true") {
      console.log("Debug callback, ignoring");
      return { success: true, message: "Debug callback ignored" };
    }

    if (reversal === "true") {
      console.log(`Reversal for transaction ${tx_id}, handling...`);
    }

    const screenoutValue = screenout === 1;
    const profilerValue = profiler === 1;

    if (reward > 0 && !reversal) {
      const user = await payload.findByID({
        collection: "users",
        id: user_id,
      });

      if (!user) {
        console.error(`User not found: ${user_id}`);
        return { success: true };
      }

      await awardPointsForProvider({
        userId: user_id,
        amount: Math.floor(reward),
        description: profilerValue
          ? "Completed TheoremReach profile survey"
          : screenoutValue
            ? `Screen-out: ${offer_name || tx_id}`
            : `Completed TheoremReach survey: ${offer_name || tx_id}`,
        payload,
      });

      console.log(
        `Awarded ${reward} points to user ${user_id} for transaction ${tx_id}`
      );
    }

    return { success: true };
  });
