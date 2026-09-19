import type { CollectionConfig } from "payload";

import {
  ADMIN_GROUP_RECORDS,
  DRAW_ATTEMPT_OUTCOME_OPTIONS,
  DRAW_CHECKPOINT_OPTIONS,
} from "./constants";

/**
 * One execution attempt of a draw (spec 19).
 *
 * The specification requires a resumed draw to use "the same draw execution ID"
 * while creating "a linked resumption-attempt ID". That is what this collection
 * records: every attempt at the same draw shares an `executionId`, and each
 * resumption is its own row pointing back at the attempt it continues.
 *
 * The value of keeping them apart is that "when did this draw run?" and "how
 * many times did we have to restart it, and who authorized each one?" are
 * different questions. A single set of timestamps on the giveaway can only
 * answer the first.
 *
 * Attempts are records of what happened, so they are append-only from the
 * admin panel's point of view: written and closed by the engine, never edited.
 */
export const GiveawayDrawAttempts: CollectionConfig = {
  slug: "giveaway-draw-attempts",
  labels: { singular: "Draw Attempt", plural: "Draw Attempts" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: [
      "giveaway",
      "attemptNumber",
      "kind",
      "outcome",
      "lastCheckpoint",
      "startedAt",
    ],
    description:
      "Every execution of a draw, including authorized resumptions. All attempts at one draw share an Execution ID.",
  },
  access: {
    read: () => true,
    // Written by the draw engine through the Local API, which bypasses these.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "giveaway",
      type: "relationship",
      relationTo: "giveaways",
      required: true,
      index: true,
    },
    {
      name: "executionId",
      type: "text",
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Shared by every attempt at the same draw. Unchanged across resumptions.",
      },
    },
    {
      name: "attemptNumber",
      type: "number",
      required: true,
      admin: {
        readOnly: true,
        description:
          "1 for the original run, incrementing for each resumption.",
      },
    },
    {
      name: "kind",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Initial run", value: "initial" },
        { label: "Authorized resumption", value: "resumption" },
      ],
    },
    {
      name: "resumes",
      type: "relationship",
      relationTo: "giveaway-draw-attempts",
      index: true,
      admin: {
        readOnly: true,
        description: "The attempt this one continues.",
      },
    },
    {
      name: "seed",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        description:
          "The draw seed. A resumption reuses the original, because a fresh seed would change the winners of the tiers that had not yet run.",
      },
    },
    {
      name: "outcome",
      type: "select",
      required: true,
      defaultValue: "running",
      index: true,
      options: [...DRAW_ATTEMPT_OUTCOME_OPTIONS],
    },
    {
      name: "lastCheckpoint",
      type: "select",
      options: [...DRAW_CHECKPOINT_OPTIONS],
      admin: {
        readOnly: true,
        description: "The last material step this attempt completed (19).",
      },
    },
    {
      name: "authorizedBy",
      type: "text",
      admin: {
        readOnly: true,
        description:
          "Who authorized this resumption. Empty for an initial run, which needs no authorization.",
      },
    },
    {
      name: "error",
      type: "textarea",
      admin: {
        readOnly: true,
        description: "Why the attempt stopped, if it did not complete.",
      },
    },
    {
      name: "startedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "endedAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};

export default GiveawayDrawAttempts;
