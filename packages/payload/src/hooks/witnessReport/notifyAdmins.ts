import { sendWitnessReportEmail } from "@news-spend-media/mail";
import type { CollectionAfterChangeHook } from "payload";

/**
 * Sends an immediate email notification to all admins when a new WitnessReport
 * is created. Unlike content reports (which are batched into a daily digest),
 * iWitness reports are time-sensitive and sent straight away.
 */
export const notifyAdminsOnWitnessReport: CollectionAfterChangeHook = async ({
  operation,
  doc,
  req,
}) => {
  if (operation !== "create") {
    return;
  }

  try {
    const adminsResult = await req.payload.find({
      collection: "admins",
      depth: 0,
      pagination: false,
      req,
    });

    const adminEmails = (adminsResult.docs as Array<{ email: string }>)
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e));

    if (adminEmails.length === 0) {
      return;
    }

    const data = doc as {
      name: string;
      title: string;
      description?: string | null;
      reportType?: string | null;
    };

    await sendWitnessReportEmail(adminEmails, {
      name: data.name,
      title: data.title,
      description: data.description,
      reportType: data.reportType,
    });
  } catch (error) {
    req.payload.logger.error(
      { error },
      "Failed to send witness report email notification"
    );
  }
};
