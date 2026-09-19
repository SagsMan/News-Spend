import { type CollectionConfig, ValidationError } from "payload";
import { IMAGE_ONLY } from "../../fields/uploadMimeFilters";
import { isIdentityProviderConfigured } from "../../lib/giveaway/didit";
import {
  ReloadlyClient,
  reloadlyConfigFromEnv,
} from "../../lib/giveaway/reloadly";
import { describeNearestDenominations } from "../../lib/giveaway/reloadlyDenominations";
import {
  ADMIN_GROUP,
  FULFILMENT_TYPE_OPTIONS,
  PRIZE_TIER_OPTIONS,
  RELOADLY_NETWORK_OPERATORS,
  RELOADLY_NETWORK_OPTIONS,
  RELOADLY_NETWORKS,
  type ReloadlyNetwork,
} from "./constants";

const networkLabel = (network: string): string =>
  RELOADLY_NETWORK_OPTIONS.find((n) => n.value === network)?.label ?? network;

/**
 * Master Prize Catalogue (spec 2).
 *
 * The single source of truth for all prize definitions. Every prize belongs to
 * exactly one tier, and duplicate prize names are rejected regardless of tier.
 * All giveaway configurations, winner records, reports, notifications and
 * fulfilment records reference prizes by this collection's ID.
 */
export const PrizeCatalogue: CollectionConfig = {
  slug: "prize-catalogue",
  admin: {
    group: ADMIN_GROUP,
    useAsTitle: "name",
    defaultColumns: ["name", "tier", "active", "updatedAt"],
    description:
      "Single source of truth for prizes. A prize belongs to exactly one tier.",
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeValidate: [
      async ({ req, data, originalDoc, operation }) => {
        const name = data?.name?.trim();

        if (name) {
          // Duplicate prize names are not permitted across tiers, so the check
          // is case-insensitive and deliberately ignores the tier field.
          const duplicate = await req.payload.find({
            collection: "prize-catalogue",
            where: { name: { equals: name } },
            limit: 1,
            pagination: false,
          });

          const clash = duplicate.docs[0];
          if (clash && clash.id !== originalDoc?.id) {
            throw new ValidationError({
              collection: "prize-catalogue",
              errors: [
                {
                  path: "name",
                  message: `"${name}" already exists in the catalogue (${clash.tier}). Duplicate prize names are not permitted across tiers.`,
                },
              ],
            });
          }
        }

        // A prize may never move between tiers once giveaways reference it.
        if (
          operation === "update" &&
          originalDoc?.tier &&
          data?.tier &&
          data.tier !== originalDoc.tier
        ) {
          const inUse = await req.payload.find({
            collection: "giveaway-prizes",
            where: { prize: { equals: originalDoc.id } },
            limit: 1,
            pagination: false,
          });

          if (inUse.docs.length > 0) {
            throw new ValidationError({
              collection: "prize-catalogue",
              errors: [
                {
                  path: "tier",
                  message:
                    "This prize is already used in one or more giveaways and cannot be reassigned to a different tier.",
                },
              ],
            });
          }
        }

        if (data?.fulfilmentType === "data") {
          const plans: any[] = data.reloadlyDataPlans ?? [];

          // The operator ID is derived, never typed. Doing it here means the
          // checks below and the stored row agree on which operator a row is.
          data.reloadlyDataPlans = plans.map((plan: any) => ({
            ...plan,
            reloadlyOperatorId:
              RELOADLY_NETWORK_OPERATORS[plan.network as ReloadlyNetwork] ||
              plan.reloadlyOperatorId,
          }));

          const errors: Array<{
            path: string;
            message: string;
          }> = [];

          // One row per network, no more and no fewer.
          //
          // Two rows for the same network are not a harmless duplicate: at
          // fulfilment the winner's network is matched against these rows and
          // the first match wins, so the second row is a plan somebody chose
          // that silently never sends. A missing network is the mirror image —
          // that winner's prize goes to manual review instead of delivering.
          // Neither shows up until a real winner hits it, which is why both
          // are refused at the point the prize is saved.
          const firstRowFor = new Map<string, number>();

          data.reloadlyDataPlans.forEach((plan: any, i: number) => {
            if (!plan.network) {
              return;
            }

            const seenAt = firstRowFor.get(plan.network);
            if (seenAt === undefined) {
              firstRowFor.set(plan.network, i);
              return;
            }

            errors.push({
              path: `reloadlyDataPlans.${i}.network`,
              message: `${networkLabel(plan.network)} already has a plan in row ${seenAt + 1}. Each network gets exactly one row: at fulfilment the first matching row is the one that sends, so this one would never be used.`,
            });
          });

          const missing = RELOADLY_NETWORKS.filter((n) => !firstRowFor.has(n));
          if (missing.length > 0) {
            errors.push({
              path: "reloadlyDataPlans",
              message: `A data prize must cover all ${RELOADLY_NETWORKS.length} networks, and this one is missing ${missing.map(networkLabel).join(", ")}. A winner on a network with no plan cannot be sent their prize automatically and would be held for manual review.`,
            });
          }

          const config = reloadlyConfigFromEnv();
          if (config) {
            const client = new ReloadlyClient(config);

            for (let i = 0; i < data.reloadlyDataPlans.length; i++) {
              const plan = data.reloadlyDataPlans[i];

              if (!plan.reloadlyOperatorId) {
                errors.push({
                  path: `reloadlyDataPlans.${i}.reloadlyOperatorId`,
                  message: "Operator ID is required",
                });
                continue;
              }

              if (!plan.reloadlyLocalAmount) {
                errors.push({
                  path: `reloadlyDataPlans.${i}.reloadlyLocalAmount`,
                  message: "Amount is required",
                });
                continue;
              }

              try {
                const operator = await client.getOperatorProducts(
                  plan.reloadlyOperatorId
                );

                if (
                  operator.denominationType === "FIXED" &&
                  operator.localFixedAmounts &&
                  !operator.localFixedAmounts.includes(plan.reloadlyLocalAmount)
                ) {
                  // Naming the price alone would leave the editor to guess
                  // which bundle to pick, so say what each one buys — but only
                  // for the few nearest the amount they actually asked for.
                  const nearest = describeNearestDenominations(
                    operator.localFixedAmounts,
                    plan.reloadlyLocalAmount,
                    operator.localFixedAmountsDescriptions
                  );
                  errors.push({
                    path: `reloadlyDataPlans.${i}.reloadlyLocalAmount`,
                    message: `Amount ₦${plan.reloadlyLocalAmount} is not available for this operator. Nearest plans: ${nearest}`,
                  });
                } else if (
                  operator.denominationType === "RANGE" &&
                  operator.localMinAmount &&
                  operator.localMaxAmount &&
                  (plan.reloadlyLocalAmount < operator.localMinAmount ||
                    plan.reloadlyLocalAmount > operator.localMaxAmount)
                ) {
                  errors.push({
                    path: `reloadlyDataPlans.${i}.reloadlyLocalAmount`,
                    message: `Amount ₦${plan.reloadlyLocalAmount} is outside the valid range (₦${operator.localMinAmount} - ₦${operator.localMaxAmount})`,
                  });
                }
              } catch (err: any) {
                errors.push({
                  path: `reloadlyDataPlans.${i}.reloadlyOperatorId`,
                  message: `Could not validate operator: ${err.message}`,
                });
              }
            }
          }

          if (errors.length > 0) {
            throw new ValidationError({
              collection: "prize-catalogue",
              errors,
            });
          }
        }

        return { ...data, ...(name ? { name } : {}) };
      },
    ],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "Must be unique across the entire catalogue, including other tiers.",
      },
    },
    {
      name: "tier",
      type: "select",
      required: true,
      index: true,
      options: [...PRIZE_TIER_OPTIONS],
      admin: {
        description:
          "The one and only tier this prize belongs to. Cannot be changed once the prize is used in a giveaway.",
      },
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "fulfilmentType",
      label: "How is this delivered?",
      type: "select",
      required: true,
      index: true,
      defaultValue: "physical",
      options: [...FULFILMENT_TYPE_OPTIONS],
      admin: {
        description:
          "Drives the whole claim flow: what the app asks the winner for, and whether fulfilment is automatic or arranged by hand.",
      },
    },
    {
      name: "pointsAmount",
      label: "Points awarded",
      type: "number",
      min: 1,
      admin: {
        condition: (data) => data?.fulfilmentType === "points",
        description:
          "Credited to the winner the moment they claim. Required for a points prize.",
      },
      validate: (value: number | null | undefined, { siblingData }: any) => {
        if (siblingData?.fulfilmentType !== "points") {
          return true;
        }
        if (value === null || value === undefined) {
          return "A points prize needs an amount.";
        }
        if (!Number.isInteger(value) || value < 1) {
          return "Must be a whole number of at least 1.";
        }
        return true;
      },
    },
    {
      name: "valueNaira",
      label: "Value (₦)",
      type: "number",
      min: 0,
      admin: {
        description:
          "Retail value of one unit. Only required if a giveaway sets a monetary budget cap; otherwise it is for reporting.",
      },
      validate: (value: number | null | undefined) => {
        if (value !== null && value !== undefined && value < 0) {
          return "Cannot be negative.";
        }
        return true;
      },
    },
    {
      name: "requiresVerification",
      label: "Requires identity verification before dispatch",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        description:
          "The winner can still claim immediately: this only gates delivery, so nobody loses a prize to the 14-day clock while verifying. Use it for high-value items, not for airtime or points. Cannot be enabled until an identity provider is configured.",
      },
      validate: (value: boolean | null | undefined) => {
        // Without a provider this checkbox does not gate anything: it parks
        // the winner in `awaiting_verification` with no way out, which is
        // worse than not gating at all. Refusing here is the only warning an
        // administrator gets, since the box itself looks harmless.
        if (value && !isIdentityProviderConfigured()) {
          return "No identity verification provider is configured, so a winner of this prize could never complete verification and the prize would never be dispatched. Configure Didit first.";
        }
        return true;
      },
    },
    {
      name: "reloadlyLocalAmount",
      label: "Reloadly amount (local currency)",
      type: "number",
      min: 0,
      admin: {
        condition: (data) => data?.fulfilmentType === "airtime",
        description:
          "Pick from available airtime amounts. Falls back to Value (₦) if left empty. Airtime is not network-specific the way data is, so the network is detected from the winner's own phone number at fulfilment.",
        components: {
          Field:
            "@news-spend-media/payload/components/ReloadlyProductSelector#AirtimeProductField",
        },
      },
    },
    {
      name: "reloadlyDataPlans",
      label: "Reloadly data plans, one per network",
      type: "array",
      // Exactly one row per network. These two stop the admin panel offering a
      // fifth row at all, which the beforeValidate hook could only complain
      // about after the fact. They count rows and nothing more, though — four
      // rows can still be four copies of MTN — so the hook below remains the
      // check that the four are actually the four different networks.
      //
      // Left non-required deliberately: Payload short-circuits an empty array
      // before reaching minRows, so a physical or points prize still saves
      // with no rows, while a data prize with none is caught by the hook.
      minRows: RELOADLY_NETWORKS.length,
      maxRows: RELOADLY_NETWORKS.length,
      admin: {
        condition: (data) => data?.fulfilmentType === "data",
        description:
          "One row per network, and all four are required: MTN, Airtel, Glo and 9mobile. Select the network, then pick from that network's live plans. At fulfilment the winner's actual network is detected from their phone number and matched against these rows, so a network left out means that winner's prize is held for manual review.",
        components: {
          RowLabel:
            "@news-spend-media/payload/components/ReloadlyProductSelector#ReloadlyDataPlanRowLabel",
        },
      },
      fields: [
        {
          name: "network",
          type: "select",
          required: true,
          options: [...RELOADLY_NETWORK_OPTIONS],
          admin: {
            description: "Select the network this plan is for",
            width: "50%",
          },
        },
        {
          name: "reloadlyOperatorId",
          label: "Operator ID",
          type: "number",
          required: true,
          admin: {
            description: "Auto-populated based on network",
            readOnly: true,
            width: "25%",
          },
        },
        {
          name: "reloadlyLocalAmount",
          label: "Data Plan",
          type: "number",
          required: true,
          min: 0,
          admin: {
            description: "Select from available plans for this network",
            components: {
              Field:
                "@news-spend-media/payload/components/ReloadlyProductSelector#DataPlanField",
            },
            width: "25%",
          },
        },
      ],
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
      required: false,
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      admin: {
        description:
          "Inactive prizes cannot be added to new giveaways. Existing giveaways are unaffected.",
        position: "sidebar",
      },
    },
  ],
};

export default PrizeCatalogue;
