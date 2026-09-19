"use client";

import { Button, toast, useDocumentInfo, useFormFields } from "@payloadcms/ui";
import type { UIFieldClientComponent } from "payload";
import { useState } from "react";

/**
 * Resend the Winner Report for the giveaway open in the admin (spec 21).
 *
 * The button is only offered for a completed draw, but that is convenience
 * rather than security. The endpoint re-checks the role and the draw status,
 * and a resend is recorded as its own delivery so the original stays
 * identifiable.
 */
export const ResendWinnerReport: UIFieldClientComponent = () => {
  const { id, savedDocumentData } = useDocumentInfo();
  const [sending, setSending] = useState(false);

  const status = useFormFields(
    ([fields]) => fields.status?.value as string | undefined
  );
  const sentAt = useFormFields(
    ([fields]) => fields.winnerReportSentAt?.value as string | undefined
  );

  const resolvedStatus =
    status ?? (savedDocumentData?.status as string | undefined);
  const resolvedSentAt =
    sentAt ?? (savedDocumentData?.winnerReportSentAt as string | undefined);

  if (!id) {
    return (
      <p className="field-description">
        Save the giveaway before a report can be sent.
      </p>
    );
  }

  if (resolvedStatus !== "completed") {
    return (
      <p className="field-description">
        The Winner Report is sent once the draw has completed.
      </p>
    );
  }

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/giveaways/${id}/resend-winner-report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const body = (await res.json()) as { message?: string };

      if (res.ok) {
        toast.success(body.message ?? "Winner Report sent.");
        window.location.reload();
        return;
      }

      toast.error(body.message ?? `Could not send (${res.status}).`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reach the server."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="field-type">
      <Button
        buttonStyle="secondary"
        disabled={sending}
        onClick={send}
        size="medium"
      >
        {sending ? "Sending…" : "Resend Winner Report"}
      </Button>
      <p className="field-description">
        {resolvedSentAt
          ? `Last sent ${new Date(resolvedSentAt).toLocaleString("en-GB")}. `
          : "Not sent yet. "}
        Rebuilds the report from the current records and emails it again. The
        original send stays on record.
      </p>
    </div>
  );
};

export default ResendWinnerReport;
