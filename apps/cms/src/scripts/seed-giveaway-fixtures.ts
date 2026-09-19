/**
 * Seed the records a giveaway needs before anything about it can be tested.
 *
 * A fresh environment has an empty Master Prize Catalogue and no partner
 * content, and that single gap blocks most of the engine from ever running:
 *
 *   - Boosts (7) need Connect Brands content. Without it `BoostLuck` can only
 *     refuse, because the engine will not count an engagement it cannot
 *     attribute to a specific item.
 *   - Featured Offers (8) need Lucky App Wall content, for the same reason.
 *   - Tier 1 and Tier 2 need BOTH of the above, so neither is reachable at all.
 *   - The giveaway reveal plays a Connect Brands advertisement before showing
 *     the outcome, and falls straight through to the result without one.
 *   - Reloadly fulfilment (15) needs an airtime or data prize to exist. It had
 *     never executed in any environment before this script.
 *
 * Everything is created through Payload's local API rather than SQL, so the
 * collection hooks run: the catalogue tier rules, the one-active-giveaway
 * constraint and the prize-pool lock all apply exactly as they would to an
 * administrator working in the CMS.
 *
 * IDEMPOTENT. Records are matched by name and skipped if present, so a second
 * run reports "exists" rather than creating duplicates. It never edits or
 * deletes anything it did not create.
 *
 * Usage, from apps/cms:
 *
 *   bun run src/scripts/seed-giveaway-fixtures.ts
 *       Report what would change. Touches nothing.
 *
 *   bun run src/scripts/seed-giveaway-fixtures.ts --write
 *       Create the missing records.
 *
 * Add --with-giveaway to also create an active giveaway wired to the prizes.
 * Left out by default because only one giveaway may be active at a time, and
 * an environment that already has one would be refused by the hook.
 *
 * TARGETING A DEPLOYED ENVIRONMENT
 *
 * Set DATABASE_URI to that environment and NODE_ENV=production:
 *
 *   DATABASE_URI=<staging uri> NODE_ENV=production \
 *     bun run src/scripts/seed-giveaway-fixtures.ts --write
 *
 * The NODE_ENV is not optional and the script refuses without it. Payload's
 * Postgres adapter pushes the schema whenever NODE_ENV is anything else, so a
 * local run pointed at staging would rewrite that database's schema from
 * whatever happens to be checked out. `production` takes the migration path
 * instead, which is a no-op against an up-to-date environment.
 */

import { getPayload } from "@news-spend-media/payload";

const WRITE = process.argv.includes("--write");
const WITH_GIVEAWAY = process.argv.includes("--with-giveaway");

type CatalogueEntry = {
  name: string;
  tier: "tier1" | "tier2" | "tier3";
  fulfilmentType: "points" | "airtime" | "data" | "physical";
  description: string;
  pointsAmount?: number;
  /**
   * What Reloadly is asked to send, in naira. Airtime operators take a range
   * rather than fixed denominations, so this is sent verbatim; see
   * `fulfilPrizes`, which reads `reloadlyLocalAmount` before `valueNaira`.
   */
  reloadlyLocalAmount?: number;
  valueNaira?: number;
};

const CATALOGUE: CatalogueEntry[] = [
  {
    /**
     * Tier 1 is only reachable with 10 tickets, 3 boosts and a Featured Offer
     * (11), so this prize is unawardable until the partner content below has
     * actually been engaged with. Points rather than a physical item on
     * purpose: the tier is about eligibility, and a physical claim would add
     * an address step and possibly identity verification to a test that is not
     * about either.
     */
    name: "5,000 Dream Points",
    tier: "tier1",
    fulfilmentType: "points",
    description: "The high-tier prize. Credited on claim.",
    pointsAmount: 5000,
    valueNaira: 5000,
  },
  {
    /**
     * Tier 2 exists here only so a seeded giveaway can start at all. The draw
     * refuses to run when any tier with a percentage above zero has an empty
     * pool, and the defaults enable all three, so a catalogue without a tier 2
     * entry produced a giveaway that could never be drawn:
     *
     *   Draw cannot start: tier2 is enabled (0.5%) but its Prize Pool is empty.
     *
     * Points rather than airtime or data on purpose. Tier 2's own reachability
     * (11) is what the seeded content is for; the fulfilment paths are already
     * covered by the tier 3 entries below, and a second Reloadly prize would
     * only spend credit proving the same thing twice.
     */
    name: "1,500 Dream Points",
    tier: "tier2",
    fulfilmentType: "points",
    description: "The mid-tier prize. Credited on claim.",
    pointsAmount: 1500,
    valueNaira: 1500,
  },
  {
    name: "500 Dream Points",
    tier: "tier3",
    fulfilmentType: "points",
    description: "Credited to the winner the moment they claim.",
    pointsAmount: 500,
    valueNaira: 500,
  },
  {
    /**
     * The reason this script exists. Airtime is the only prize type that
     * reaches Reloadly on a claim, and that path had never run anywhere,
     * dev, staging or production.
     */
    name: "₦500 Airtime",
    tier: "tier3",
    fulfilmentType: "airtime",
    description: "Sent to the winner's phone number on the network it detects.",
    reloadlyLocalAmount: 500,
    valueNaira: 500,
  },
  {
    /**
     * Named exactly "2GB Data" because `seed-reloadly-data-plans` matches
     * catalogue entries by name; without that name the plans have nothing to
     * attach to.
     *
     * No `reloadlyLocalAmount` here, unlike airtime. Data is sold as fixed
     * SKUs, so the amount comes from the per-network plan rows that script
     * writes; a network with no row holds the prize for review rather than
     * sending a bundle that would not deliver.
     */
    name: "2GB Data",
    tier: "tier3",
    fulfilmentType: "data",
    description: "A 2GB bundle, sent on the winner's own network.",
    valueNaira: 600,
  },
];

type PartnerItem = {
  title: string;
  placement: "connect-brand-video" | "lucky-app-wall";
  type: "video" | "app";
  condition: string;
  points: number;
  why: string;
};

/**
 * Where a seeded item sends someone who taps it.
 *
 * Not optional in practice: `usePartnerClick` reads the store links, falls
 * back to the website, and returns silently when there is none, so an item
 * seeded without a link is simply dead to the touch, with no error and no
 * toast. The first seeded app-wall offer was exactly that, and looked like a
 * broken button rather than missing data.
 */
const SEED_LINK = "https://newsspend.com";

/**
 * Partner content cannot be conjured from nothing: `media` is a required
 * upload and `partner` a required relationship, so this reuses whatever the
 * environment already has rather than inventing a creative. A seeded ad with a
 * placeholder image would not be a meaningful test of an ad anyway; the point
 * is only to make the engagement surfaces reachable.
 */
const PARTNER_CONTENT: PartnerItem[] = [
  /**
   * Three separate Connect Brands items, because a Boost is recorded against
   * the item watched and the engine refuses the same one twice, so three boosts
   * has to mean three different advertisements, not one watched three times.
   * Tier 1 needs all three (11), so a single item caps everyone at tier 3.
   */
  {
    title: "Sponsor spot: Connect Brands",
    placement: "connect-brand-video",
    type: "video",
    condition: "Watch to the end to boost your entries",
    points: 10,
    why: "Earns Boosts (7) and is what the reveal plays before an outcome.",
  },
  {
    title: "Sponsor spot: Connect Brands 2",
    placement: "connect-brand-video",
    type: "video",
    condition: "Watch to the end to boost your entries",
    points: 10,
    why: "Second distinct Boost item. Three are needed for Tier 1.",
  },
  {
    title: "Sponsor spot: Connect Brands 3",
    placement: "connect-brand-video",
    type: "video",
    condition: "Watch to the end to boost your entries",
    points: 10,
    why: "Third distinct Boost item. Three are needed for Tier 1.",
  },
  {
    title: "Sponsor offer: Lucky App Wall",
    placement: "lucky-app-wall",
    type: "app",
    condition: "Complete the offer to earn a Featured Offer",
    points: 50,
    why: "Earns Featured Offers (8) once a partner confirms the conversion.",
  },
];

function assertSafeTarget(): void {
  const uri = process.env.DATABASE_URI ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(uri);

  if (!(isLocal || process.env.NODE_ENV === "production")) {
    throw new Error(
      "Refusing to run against a non-local database without NODE_ENV=production.\n" +
        "Payload pushes its schema in any other mode, which would rewrite the " +
        "target environment's schema from your working copy."
    );
  }
}

async function main() {
  assertSafeTarget();

  const payload = await getPayload();
  const mode = WRITE ? "WRITE" : "DRY RUN: nothing will be created";
  console.log(`\n${mode}\n`);

  // --- Master Prize Catalogue -------------------------------------------

  /**
   * Keyed by name, carrying the tier as well as the id. A prize may only enter
   * a pool under the tier it holds in the catalogue (4), and the hook enforces
   * that, so the pool below has to read each entry's own tier rather than
   * assume one. It once assumed tier 3 and the tier 1 prize made the seed fail
   * half-way, leaving an active giveaway with an empty pool behind it.
   */
  const prizeIds = new Map<
    string,
    { id: string; tier: CatalogueEntry["tier"] }
  >();

  for (const entry of CATALOGUE) {
    const existing = await payload.find({
      collection: "prize-catalogue",
      where: { name: { equals: entry.name } },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    if (existing.docs[0]) {
      prizeIds.set(entry.name, {
        id: String(existing.docs[0].id),
        tier: entry.tier,
      });
      console.log(`  exists   prize      ${entry.name}`);
      continue;
    }

    if (!WRITE) {
      console.log(`  create   prize      ${entry.name} (${entry.tier})`);
      continue;
    }

    const created = await payload.create({
      collection: "prize-catalogue",
      data: { ...entry, active: true },
    });
    prizeIds.set(entry.name, { id: String(created.id), tier: entry.tier });
    console.log(`  created  prize      ${entry.name}`);
  }

  // --- Partner content --------------------------------------------------

  /**
   * Borrow the environment's existing partner and media rather than creating
   * them. Without both, the collection's own validation would refuse every
   * item, so say why and stop instead of failing item by item.
   */
  const [partners, media] = await Promise.all([
    payload.find({
      collection: "partners",
      limit: 1,
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: "media",
      limit: 1,
      pagination: false,
      depth: 0,
    }),
  ]);

  const partnerId = partners.docs[0]?.id;
  const mediaId = media.docs[0]?.id;

  if (!(partnerId && mediaId)) {
    console.log(
      `\n  skipped  content    needs an existing Partner (${partners.docs.length}) ` +
        `and Media (${media.docs.length}) record.\n` +
        "           Create one of each in the CMS, then re-run. An upload " +
        "cannot be seeded from here.\n"
    );
  }

  for (const item of partnerId && mediaId ? PARTNER_CONTENT : []) {
    const existing = await payload.find({
      collection: "partner-content",
      where: { title: { equals: item.title } },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    if (existing.docs[0]) {
      console.log(`  exists   content    ${item.title}`);
      continue;
    }

    if (!WRITE) {
      console.log(`  create   content    ${item.title} [${item.placement}]`);
      continue;
    }

    await payload.create({
      collection: "partner-content",
      data: {
        title: item.title,
        type: item.type,
        condition: item.condition,
        description: item.why,
        placements: [item.placement],
        points: item.points,
        partner: partnerId,
        media: mediaId,
        links: { website: SEED_LINK },
        // Draft content is invisible to the app, which would leave the
        // surfaces exactly as empty as before.
        status: "active",
      },
    });
    console.log(`  created  content    ${item.title}`);
  }

  // --- An active giveaway, on request -----------------------------------

  if (WITH_GIVEAWAY) {
    const active = await payload.find({
      collection: "giveaways",
      where: { status: { equals: "active" } },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    if (active.docs[0]) {
      /**
       * An active giveaway is left alone except for its pool, which is topped
       * up with any catalogue prize missing from it.
       *
       * This is a repair path, and both of the things it repairs happened for
       * real. A run that failed part-way through left an active giveaway with
       * an empty pool; and a catalogue that gained a tier 2 prize afterwards
       * left the giveaway unable to start, because the draw refuses any
       * enabled tier whose pool is empty. Neither could be fixed by re-running,
       * since the whole branch was skipped whenever a giveaway was active.
       *
       * Safe to do while live: 5 locks the pool from `pool_building` onwards,
       * and `active` is deliberately outside that set, so this cannot disturb a
       * draw that has begun. Existing rows are never touched, only gaps are
       * filled, so units already awarded are left as they are.
       */
      const giveaway = active.docs[0];
      const pool = await payload.find({
        collection: "giveaway-prizes",
        where: { giveaway: { equals: giveaway.id } },
        pagination: false,
        depth: 0,
      });

      const pooled = new Set(
        pool.docs.map((row) =>
          typeof row.prize === "string" ? row.prize : String(row.prize?.id)
        )
      );
      const missing = [...prizeIds].filter(
        ([, prize]) => !pooled.has(prize.id)
      );

      console.log(
        `\n  exists   giveaway   "${giveaway.name}" is already active, leaving its configuration alone.`
      );

      if (missing.length === 0) {
        console.log(`  ok       pool       all ${pooled.size} prizes present`);
        /**
         * A dry run only knows the prizes that already exist, so a catalogue
         * entry it is about to create cannot be reported as a pool gap yet,
         * it has no id to compare against. Say so, rather than let "all
         * present" read as "nothing left to do".
         */
        if (!WRITE && prizeIds.size < CATALOGUE.length) {
          console.log(
            "           pool       (prizes created above would be added too)"
          );
        }
      }

      for (const [name, prize] of missing) {
        if (!WRITE) {
          console.log(`  add      pool       ${name} ×5 (${prize.tier})`);
          continue;
        }
        await payload.create({
          collection: "giveaway-prizes",
          data: {
            giveaway: giveaway.id,
            prize: prize.id,
            tier: prize.tier,
            maxUnits: 5,
          },
        });
        console.log(`  added    pool       ${name} ×5 (${prize.tier})`);
      }
    } else if (WRITE) {
      const now = Date.now();
      const giveaway = await payload.create({
        collection: "giveaways",
        data: {
          name: `Seeded giveaway ${new Date().toISOString().slice(0, 10)}`,
          status: "active",
          startDate: new Date(now - 24 * 3_600_000).toISOString(),
          endDate: new Date(now + 7 * 24 * 3_600_000).toISOString(),
          ticketPrice: 50,
          minTicketsRequired: 1,
          /**
           * Left at the specification's defaults on purpose. A test giveaway
           * once ran with tier 3 at 100%, which awards a prize to every
           * eligible entrant, correct for proving the reveal with a single
           * participant, badly wrong anywhere else.
           */
          tier1WinnerPercentage: 0.1,
          tier2WinnerPercentage: 0.5,
          tier3WinnerPercentage: 5,
          budgetUtilizationPct: 100,
        },
      });

      for (const [name, prize] of prizeIds) {
        await payload.create({
          collection: "giveaway-prizes",
          data: {
            giveaway: giveaway.id,
            prize: prize.id,
            tier: prize.tier,
            maxUnits: 5,
          },
        });
        console.log(`  created  pool       ${name} ×5 (${prize.tier})`);
      }

      console.log(`\n  created  giveaway   ${giveaway.name}`);
    } else {
      console.log(
        "\n  create   giveaway   with the seeded prizes at their catalogue tiers"
      );
    }
  }

  if (!WRITE) {
    console.log("\nRe-run with --write to apply.\n");
  }

  /**
   * Tier 3 needs 20 participants before it can award anything: the cap is
   * `floor(participants × 5 / 100)`. Worth saying out loud, because a draw
   * that correctly awards nothing looks identical to one that is broken.
   */
  if (WITH_GIVEAWAY) {
    console.log(
      "\nNote: at the default 5%, tier 3 awards its first prize at 20 " +
        "participants. Below that the draw completes with no winners.\n"
    );
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
