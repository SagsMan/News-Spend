import { type CollectionConfig, ValidationError } from "payload";

import {
  ADMIN_GROUP,
  LOCKED_GIVEAWAY_STATUSES,
  PRIZE_TIER_OPTIONS,
} from "./constants";

/**
 * Prize Pool and Maximum Units for a single giveaway (spec 4, 5).
 *
 * One row per prize selected for a giveaway. Only prizes represented here may
 * be awarded; a prize in the Master Prize Catalogue that has not been selected
 * is never considered during allocation.
 */
export const GiveawayPrizes: CollectionConfig = {
  slug: "giveaway-prizes",
  admin: {
    group: ADMIN_GROUP,
    useAsTitle: "id",
    defaultColumns: [
      "giveaway",
      "prize",
      "tier",
      "maxUnits",
      "unitsAwarded",
      "unitsRemaining",
    ],
    description:
      "The prizes selected for a giveaway, and how many units of each may be awarded.",
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeValidate: [
      async ({ req, data, originalDoc, operation }) => {
        const giveawayId = data?.giveaway ?? originalDoc?.giveaway;
        const prizeId = data?.prize ?? originalDoc?.prize;

        if (!(giveawayId && prizeId)) {
          return data;
        }

        const giveaway = await req.payload.findByID({
          collection: "giveaways",
          id: typeof giveawayId === "object" ? giveawayId.id : giveawayId,
          depth: 0,
        });

        /**
         * Max Units is editable until the countdown ends, then locked (5).
         *
         * The lock is aimed at people: it stops an administrator changing the
         * pool out from under a draw. The draw itself must still record what
         * it awarded, and it does so while the giveaway is
         * `draw_in_progress`, one of the locked statuses. Without the engine
         * exemption below, the lock stops the engine one write after the first
         * winner is created, and no draw can ever complete.
         */
        if (
          giveaway &&
          LOCKED_GIVEAWAY_STATUSES.includes(giveaway.status) &&
          !req.context?.giveawayEngine
        ) {
          throw new ValidationError({
            collection: "giveaway-prizes",
            errors: [
              {
                path: "giveaway",
                message: `The prize pool is locked because the giveaway is "${giveaway.status}".`,
              },
            ],
          });
        }

        const prize = await req.payload.findByID({
          collection: "prize-catalogue",
          id: typeof prizeId === "object" ? prizeId.id : prizeId,
          depth: 0,
        });

        if (!prize) {
          throw new ValidationError({
            collection: "giveaway-prizes",
            errors: [
              { path: "prize", message: "Prize not found in the catalogue." },
            ],
          });
        }

        // A prize may only be selected under the tier assigned to it in the
        // Master Prize Catalogue (spec 4).
        if (data?.tier && data.tier !== prize.tier) {
          throw new ValidationError({
            collection: "giveaway-prizes",
            errors: [
              {
                path: "tier",
                message: `"${prize.name}" is a ${prize.tier} prize in the catalogue and cannot be selected under ${data.tier}.`,
              },
            ],
          });
        }

        // The same prize may not be selected twice for one giveaway.
        const existing = await req.payload.find({
          collection: "giveaway-prizes",
          where: {
            and: [
              { giveaway: { equals: giveaway?.id } },
              { prize: { equals: prize.id } },
            ],
          },
          limit: 1,
          pagination: false,
        });

        const clash = existing.docs[0];
        if (clash && clash.id !== originalDoc?.id) {
          throw new ValidationError({
            collection: "giveaway-prizes",
            errors: [
              {
                path: "prize",
                message: `"${prize.name}" is already selected for this giveaway.`,
              },
            ],
          });
        }

        if (operation === "create" && prize.active === false) {
          throw new ValidationError({
            collection: "giveaway-prizes",
            errors: [
              {
                path: "prize",
                message: `"${prize.name}" is inactive and cannot be added to a giveaway.`,
              },
            ],
          });
        }

        // Tier is denormalised from the catalogue so draws can filter without a join.
        return { ...data, tier: prize.tier };
      },
    ],
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
      name: "prize",
      type: "relationship",
      relationTo: "prize-catalogue",
      required: true,
      index: true,
    },
    {
      name: "tier",
      type: "select",
      required: true,
      index: true,
      options: [...PRIZE_TIER_OPTIONS],
      admin: {
        readOnly: true,
        description: "Inherited from the Master Prize Catalogue.",
      },
    },
    {
      name: "maxUnits",
      type: "number",
      required: true,
      min: 1,
      admin: {
        step: 1,
        description:
          "Maximum units of this prize that may be awarded. Positive whole numbers only.",
      },
      validate: (value: number | null | undefined) => {
        if (value === null || value === undefined) {
          return "Maximum Units is required for every selected prize.";
        }
        if (!Number.isInteger(value)) {
          return "Must be a whole number. Decimals are not permitted.";
        }
        if (value < 1) {
          return "Must be at least 1. Remove the prize instead of setting it to zero.";
        }
        return true;
      },
    },
    {
      name: "unitsAwarded",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        description: "Incremented by the draw engine as prizes are allocated.",
      },
    },
    {
      name: "unitsRemaining",
      type: "number",
      virtual: true,
      admin: {
        readOnly: true,
        description: "Maximum Units − Units Awarded.",
      },
      hooks: {
        afterRead: [
          ({ data }) => (data?.maxUnits ?? 0) - (data?.unitsAwarded ?? 0),
        ],
      },
    },
  ],
};

export default GiveawayPrizes;
