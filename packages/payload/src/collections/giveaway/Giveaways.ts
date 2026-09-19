import { addWeeks, startOfWeek } from "date-fns";
import { APIError, type CollectionConfig, ValidationError } from "payload";

import {
  ADMIN_GROUP,
  DRAW_CHECKPOINT_OPTIONS,
  GIVEAWAY_STATUS_OPTIONS,
  type GiveawayStatus,
  LOCKED_GIVEAWAY_STATUSES,
} from "./constants";

/**
 * Core giveaway configuration (spec 1, 3).
 *
 * The administrator configures exactly four things: ticket price, the maximum
 * winner percentage per tier, the prize pool (see `giveaway-prizes`), and the
 * maximum units per selected prize (also on `giveaway-prizes`). Tier
 * eligibility rules are platform business logic and are not represented here.
 */
export const Giveaways: CollectionConfig = {
  slug: "giveaways",
  admin: {
    group: ADMIN_GROUP,
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "status",
      "startDate",
      "endDate",
      "totalValidParticipants",
    ],
  },
  access: {
    read: () => true,
  },
  endpoints: [
    {
      /**
       * Run (or resume) this giveaway's draw by hand.
       *
       * The hourly sweep is the normal path and remains so. This exists for the
       * two cases it cannot serve: a draw that must run early or be re-run
       * after a failure, and a draw an administrator has authorized to resume
       * (19), the sweep only ever selects `active` giveaways, so without this
       * a resumption would never execute at all.
       *
       * Every rule about *whether* a draw may run stays in the engine's own
       * validation rather than being restated here, so the button, the sweep
       * and this endpoint can never disagree about it.
       */
      /**
       * What could this giveaway award, at a given number of participants?
       *
       * Read-only and unauthenticated by nothing: it writes nothing, starts
       * nothing and touches no winner. Available to any admin rather than
       * super-admins alone, because the whole point is that it should be
       * consulted freely while a pool is being decided, and a check people
       * need permission for is a check they skip.
       */
      path: "/:id/simulate",
      method: "post",
      handler: async (req) => {
        if (req.user?.collection !== "admins") {
          return Response.json({ message: "Admins only." }, { status: 403 });
        }

        const id = req.routeParams?.id as string | undefined;
        if (!id) {
          return Response.json(
            { message: "Missing giveaway id." },
            { status: 400 }
          );
        }

        const body = req.json
          ? ((await req.json()) as {
              participants?: number;
              eligible?: Record<string, number>;
            })
          : {};

        const participants = Number(body.participants ?? 0);
        if (!Number.isFinite(participants) || participants < 0) {
          return Response.json(
            { message: "participants must be a number of 0 or more." },
            { status: 400 }
          );
        }

        const { simulateDraw } = await import(
          "../../lib/giveaway/simulateDraw"
        );

        try {
          const result = await simulateDraw(req.payload, id, {
            participants,
            eligible: body.eligible as never,
          });
          return Response.json(result);
        } catch (error) {
          req.payload.logger.error(
            { err: error, giveawayId: id },
            "[giveaway] simulation failed"
          );
          return Response.json(
            { message: "Could not simulate this giveaway." },
            { status: 500 }
          );
        }
      },
    },
    {
      path: "/:id/run-draw",
      method: "post",
      handler: async (req) => {
        const user = req.user;

        // A draw awards real prizes and cannot be undone, so this is
        // deliberately the narrowest role.
        if (user?.collection !== "admins" || user?.role !== "super-admin") {
          return Response.json(
            { message: "Only a Super Admin can run a draw." },
            { status: 403 }
          );
        }

        const id = req.routeParams?.id as string | undefined;
        if (!id) {
          return Response.json(
            { message: "Missing giveaway id." },
            { status: 400 }
          );
        }

        const body = req.json
          ? ((await req.json()) as { resume?: boolean })
          : {};
        const resume = body.resume === true;

        const { GiveawayEngine, GiveawayEngineError } = await import(
          "../../lib/giveaway/GiveawayEngine"
        );

        try {
          const result = await new GiveawayEngine(req.payload).runDraw(id, {
            resume,
            // An administrator is pressing the button and reads the refusal in
            // the response below, so there is nothing for a status change to
            // tell them. Leaving the giveaway open lets them fix what
            // validation named and press it again; the scheduled task, which
            // has nobody to read anything, keeps the default.
            recordValidationFailure: false,
          });

          return Response.json({
            message: `Draw complete: ${result.totalWinners} winner${
              result.totalWinners === 1 ? "" : "s"
            } from ${result.totalValidParticipants} participant${
              result.totalValidParticipants === 1 ? "" : "s"
            }.`,
            totalWinners: result.totalWinners,
            totalValidParticipants: result.totalValidParticipants,
            executionId: result.executionId,
          });
        } catch (error) {
          /**
           * A refused draw is an ordinary answer, not a fault: the countdown
           * has not ended, prizes are unconfigured, a draw is already running.
           * The engine phrases each of those for an administrator, so its
           * message is returned verbatim as a 409 rather than being flattened
           * into a generic failure.
           */
          if (error instanceof GiveawayEngineError) {
            req.payload.logger.warn(
              { giveawayId: id, code: error.code, resume },
              "[giveaway] manual draw refused"
            );
            return Response.json(
              { message: error.message, code: error.code },
              { status: 409 }
            );
          }

          const message =
            error instanceof Error ? error.message : "Unknown error";
          req.payload.logger.error(
            { err: error, giveawayId: id, resume },
            "[giveaway] manual draw failed"
          );
          return Response.json(
            { message: `Draw failed: ${message}` },
            { status: 500 }
          );
        }
      },
    },
    {
      /**
       * Authorize a stopped draw to resume (19).
       *
       * The status alone is what the engine checks, so an administrator can
       * reach `resumption_authorized` by editing the select, and that is how
       * it was done before this existed. It works, and it records nothing: no
       * name, no timestamp, no audit entry, because the stamping lives in
       * `authorizeResumption` rather than in the field.
       *
       * 19 exists so a draw can be defended afterwards. "Someone changed a
       * dropdown" is the wrong answer to who allowed prizes to be awarded, so
       * this routes the same decision through the engine, which records it.
       */
      path: "/:id/authorize-resumption",
      method: "post",
      handler: async (req) => {
        const user = req.user;

        if (user?.collection !== "admins" || user?.role !== "super-admin") {
          return Response.json(
            { message: "Only a Super Admin can authorize a resumption." },
            { status: 403 }
          );
        }

        const id = req.routeParams?.id as string | undefined;
        if (!id) {
          return Response.json(
            { message: "Missing giveaway id." },
            { status: 400 }
          );
        }

        const body = req.json ? ((await req.json()) as { note?: string }) : {};

        const { GiveawayEngine } = await import(
          "../../lib/giveaway/GiveawayEngine"
        );

        const result = await new GiveawayEngine(
          req.payload
        ).authorizeResumption(id, {
          // Identifies the person in the audit log and on the attempt.
          authorizedBy: user.email ?? String(user.id),
          note: body.note,
        });

        if (result.authorized) {
          return Response.json({
            message: result.message ?? "Resumption authorized.",
          });
        }

        return Response.json({ message: result.message }, { status: 409 });
      },
    },
    {
      /**
       * Resend the Winner Report (spec 21, "provide Resend Winner Report
       * button in CMS").
       *
       * A resend is recorded as its own delivery rather than overwriting the
       * original, so the log always answers "when did the report first go
       * out, and how many times has it been sent since?".
       */
      path: "/:id/resend-winner-report",
      method: "post",
      handler: async (req) => {
        const user = req.user;

        // The report carries winners' names, emails and phone numbers, so
        // sending it is deliberately the narrowest role.
        if (user?.collection !== "admins" || user?.role !== "super-admin") {
          return Response.json(
            { message: "Only a Super Admin can send the Winner Report." },
            { status: 403 }
          );
        }

        const id = req.routeParams?.id as string | undefined;
        if (!id) {
          return Response.json(
            { message: "Missing giveaway id." },
            { status: 400 }
          );
        }

        const { sendWinnerReport } = await import(
          "../../lib/giveaway/sendWinnerReport"
        );

        const result = await sendWinnerReport(req.payload, id, {
          kind: "resend",
          requestedBy: user.email ?? String(user.id),
        });

        if (result.sent) {
          return Response.json({ message: "Winner Report sent." });
        }

        return Response.json({ message: result.message }, { status: 409 });
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ req, data, originalDoc, operation }) => {
        const nextStatus = data?.status as GiveawayStatus | undefined;
        const prevStatus = originalDoc?.status as GiveawayStatus | undefined;

        // Only one giveaway may be active at a time.
        if (nextStatus === "active" && prevStatus !== "active") {
          const active = await req.payload.find({
            collection: "giveaways",
            where: { status: { equals: "active" } },
            limit: 1,
            pagination: false,
          });

          const clash = active.docs[0];
          if (clash && clash.id !== originalDoc?.id) {
            /**
             * `APIError`, not `ValidationError`, because this message is the
             * whole value of the error.
             *
             * `ValidationError` composes its own message from the field path
             * and discards the per-error `message`, so the administrator saw
             * "The following field is invalid: status" and had to go and work
             * out for themselves which giveaway was holding the slot. The one
             * fact that resolves the situation — the name of the giveaway to
             * close out first — never reached them. `APIError`'s message is
             * shown verbatim.
             */
            throw new APIError(
              `"${clash.name}" is already active, and only one giveaway may be active at a time. Set "${clash.name}" to Completed or Cancelled first, then activate this one.`,
              400
            );
          }
        }

        // Configuration locks when the draw begins (spec 5, 16).
        if (
          operation === "update" &&
          prevStatus &&
          LOCKED_GIVEAWAY_STATUSES.includes(prevStatus)
        ) {
          const lockedFields = [
            "ticketPrice",
            "tier1WinnerPercentage",
            "tier2WinnerPercentage",
            "tier3WinnerPercentage",
            "minTicketsRequired",
            "budgetUtilizationPct",
            "maxBudgetCapNaira",
            "startDate",
            "endDate",
          ] as const;

          const mutated = lockedFields.filter(
            (field) =>
              data?.[field] !== undefined &&
              data[field] !== originalDoc?.[field]
          );

          if (mutated.length > 0) {
            throw new ValidationError({
              collection: "giveaways",
              errors: mutated.map((path) => ({
                path,
                message: `Cannot be changed once the draw has begun (giveaway is "${prevStatus}").`,
              })),
            });
          }
        }

        if (
          data?.startDate &&
          data?.endDate &&
          new Date(data.endDate) <= new Date(data.startDate)
        ) {
          throw new ValidationError({
            collection: "giveaways",
            errors: [
              {
                path: "endDate",
                message: "End date must be after start date.",
              },
            ],
          });
        }

        return data;
      },
    ],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
      defaultValue: () =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
          .toLocaleDateString("en-GB")
          .replace(/\//g, ""),
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "startDate",
      type: "date",
      required: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
      defaultValue: () =>
        startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
    },
    {
      name: "endDate",
      type: "date",
      required: true,
      admin: {
        date: { pickerAppearance: "dayAndTime" },
        description:
          "When the countdown ends and the draw becomes eligible to run.",
      },
      defaultValue: () =>
        addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 2).toISOString(),
    },
    {
      name: "ticketPrice",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 50,
      admin: { description: "Points charged per ticket." },
    },
    {
      name: "minTicketsRequired",
      label: "Minimum tickets per purchase",
      type: "number",
      required: true,
      min: 1,
      defaultValue: 1,
      admin: {
        description:
          "The smallest number of tickets a user may buy at once (spec 1). This is a purchase floor, not a tier requirement.",
      },
      validate: (value: number | null | undefined) => {
        if (value === null || value === undefined) {
          return "A minimum is required. Use 1 for no restriction.";
        }
        if (!Number.isInteger(value) || value < 1) {
          return "Must be a whole number of at least 1.";
        }
        return true;
      },
    },
    {
      type: "collapsible",
      label: "Winner Distribution",
      admin: {
        description:
          "Maximum percentage of Total Valid Participants that may win in each tier. Enter 0 to disable a tier.",
      },
      fields: [
        winnerPercentageField("tier1WinnerPercentage", "Tier 1 (%)", 0.1),
        winnerPercentageField("tier2WinnerPercentage", "Tier 2 (%)", 0.5),
        winnerPercentageField("tier3WinnerPercentage", "Tier 3 (%)", 5),
      ],
    },
    {
      type: "collapsible",
      label: "Budget Reserve",
      admin: {
        description:
          "Optional spending limits. Both are inert at their defaults, so a giveaway behaves exactly as the specification describes unless these are deliberately changed.",
      },
      fields: [
        {
          name: "budgetUtilizationPct",
          label: "Maximum budget utilisation (%)",
          type: "number",
          required: true,
          min: 1,
          max: 100,
          defaultValue: 100,
          admin: {
            step: 1,
            description:
              "The share of stocked prize units this draw may award. 100 means the Maximum Units figures are the only ceiling; 85 would hold 15% of the stock back for later giveaways.",
          },
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) {
              return "A utilisation percentage is required.";
            }
            if (!Number.isFinite(value) || value <= 0 || value > 100) {
              return "Must be greater than 0 and at most 100.";
            }
            return true;
          },
        },
        {
          name: "maxBudgetCapNaira",
          label: "Hard spend cap (₦)",
          type: "number",
          min: 0,
          admin: {
            description:
              "Total retail value this draw may award. Leave empty for no monetary cap. Every prize in the pool must have a Value (₦) for this to be usable.",
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [...GIVEAWAY_STATUS_OPTIONS],
      admin: { position: "sidebar" },
    },
    {
      name: "totalValidParticipants",
      type: "number",
      admin: {
        readOnly: true,
        position: "sidebar",
        description:
          "Unique users holding at least one valid ticket, captured once when the draw begins. Constant for the whole draw.",
      },
    },
    {
      name: "drawSeed",
      type: "text",
      admin: {
        readOnly: true,
        position: "sidebar",
        description:
          "Cryptographic seed used for this draw. Enables replay for audit.",
      },
    },
    {
      name: "drawExecutionId",
      type: "text",
      index: true,
      admin: {
        readOnly: true,
        position: "sidebar",
        description:
          "Identifies this draw across every attempt at it. A resumption reuses it rather than starting a new one (19).",
      },
    },
    {
      name: "lastCheckpoint",
      type: "select",
      options: [...DRAW_CHECKPOINT_OPTIONS],
      admin: {
        readOnly: true,
        position: "sidebar",
        description:
          "The last material step the draw completed. A resumption continues from the next one (19).",
      },
    },
    {
      name: "currentAttempt",
      type: "relationship",
      relationTo: "giveaway-draw-attempts",
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "The most recent execution attempt.",
      },
    },
    {
      name: "resumptionAuthorizedBy",
      type: "text",
      admin: {
        readOnly: true,
        position: "sidebar",
        condition: (data) =>
          data?.status === "resumption_authorized" ||
          data?.status === "interrupted",
      },
    },
    {
      name: "resumptionAuthorizedAt",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        condition: (data) => Boolean(data?.resumptionAuthorizedBy),
      },
    },
    {
      name: "drawStartedAt",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "drawCompletedAt",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "drawError",
      type: "textarea",
      admin: {
        readOnly: true,
        position: "sidebar",
        condition: (data) =>
          data?.status === "failed" || data?.status === "interrupted",
      },
    },
    {
      name: "runDraw",
      type: "ui",
      label: "Draw",
      admin: {
        components: {
          Field:
            "@news-spend-media/payload/components/RunGiveawayDraw#RunGiveawayDraw",
        },
      },
    },
    {
      name: "resendWinnerReport",
      type: "ui",
      label: "Winner Report",
      admin: {
        components: {
          Field:
            "@news-spend-media/payload/components/ResendWinnerReport#ResendWinnerReport",
        },
      },
    },
    {
      name: "winnerReportSentAt",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};

/**
 * Percentage field shared by all three tiers: accepts decimals to at least two
 * places, rejects negatives and values above 100, and allows 0 to disable the
 * tier (spec 3).
 */
function winnerPercentageField(
  name: string,
  label: string,
  defaultValue: number
) {
  return {
    name,
    label,
    type: "number" as const,
    required: true,
    min: 0,
    max: 100,
    defaultValue,
    admin: {
      step: 0.01,
      description: "0 disables this tier. Maximum 100.",
    },
    validate: (value: number | null | undefined) => {
      if (value === null || value === undefined) {
        return "A winner percentage is required for every tier.";
      }
      if (Number.isNaN(value)) {
        return "Must be a number.";
      }
      if (value < 0) {
        return "Cannot be negative.";
      }
      if (value > 100) {
        return "Cannot exceed 100%.";
      }
      return true;
    },
  };
}

export default Giveaways;
