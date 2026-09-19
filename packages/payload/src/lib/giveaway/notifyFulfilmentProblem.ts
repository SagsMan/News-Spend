import type { BasePayload } from "payload";

/**
 * Tell a winner that their prize has hit a problem and is being looked at.
 *
 * Until this existed, a failed payout was silent. `hold()` moved the prize to
 * `on_hold` and stopped, and the only way to find out was to reopen the app
 * and read a status line nobody had been given a reason to go and read. The
 * common case is the worst one: a mistyped phone number fails, retries, and
 * the winner sits looking at a green "Claimed" believing the airtime is on its
 * way.
 *
 * DELIBERATELY VAGUE ABOUT THE CAUSE. `reviewNote` carries provider text like
 * "Provider rejected the payout: INVALID_ACCOUNT_NUMBER", which is written for
 * an administrator and would read to a winner as either gibberish or an
 * accusation. The message says a problem exists and that the prize is safe;
 * the detail belongs on the prize screen, where there is room for it.
 *
 * NEVER THROWS. The prize is already on hold and an administrator has already
 * been given the record. A notification service being unreachable must not
 * turn a handled failure into an unhandled one, exactly as 21 reasons about
 * the Winner Report.
 */
export async function notifyFulfilmentProblem(
  payload: BasePayload,
  winnerId: string
): Promise<{ notified: boolean; reason?: string }> {
  try {
    const winner = await payload.findByID({
      collection: "giveaway-winners",
      id: winnerId,
      depth: 0,
    });

    const userId =
      typeof winner?.user === "string"
        ? winner.user
        : (winner?.user as { id?: string } | null)?.id;

    if (!userId) {
      return { notified: false, reason: "no user on winner" };
    }

    const prizeName = String(winner?.prizeName ?? "Your prize");

    /**
     * Both fields are load-bearing and neither is obvious: `targetType`
     * defaults to "all", and the send hook returns early on anything left as a
     * draft. Two draw notifications sat unsent for exactly this reason.
     */
    await payload.create({
      collection: "notifications",
      data: {
        targetType: "specific",
        _status: "published",
        specificUsers: [userId],
        title: `There's a hold-up with ${prizeName}`,
        body: "We hit a problem sending it. Your prize is safe. Open the app for details.",
        deliveryAction: "send-now",
        priority: "high",
        sound: true,
        data: { winnerId, type: "giveaway", url: `prize/${winnerId}` },
      },
    });

    /**
     * Email as well as push, because this is the one giveaway message a person
     * may need to act on. Push is the notification most likely to be swiped
     * away or switched off, and a prize that goes undelivered because its only
     * warning was dismissed is the failure this whole change exists to stop.
     */
    const account = await payload.findByID({
      collection: "users",
      id: userId,
      depth: 0,
    });
    const email = account?.email as string | undefined;

    if (email) {
      try {
        await payload.sendEmail({
          to: email,
          subject: `There's a hold-up with ${prizeName}`,
          html: [
            `<p>Hi${account?.username ? ` ${account.username}` : ""},</p>`,
            `<p>We ran into a problem sending <strong>${prizeName}</strong>.</p>`,
            "<p>Your prize is safe and still yours. Nothing has been lost and there is no deadline to worry about. Our team is looking into it, and you can see the current status in the app under My Prizes.</p>",
            `<p>If we need anything from you, we'll be in touch.</p>`,
          ].join("\n"),
        });
      } catch (error) {
        // Push already went out; a failed email is not worth losing that over.
        payload.logger.error(
          { err: error, winnerId },
          "[giveaway] could not email the winner about a fulfilment problem"
        );
      }
    }

    return { notified: true };
  } catch (error) {
    payload.logger.error(
      { err: error, winnerId },
      "[giveaway] could not notify the winner about a fulfilment problem"
    );
    return { notified: false, reason: "error" };
  }
}
