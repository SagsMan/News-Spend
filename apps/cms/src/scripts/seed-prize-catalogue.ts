/**
 * Seed the Master Prize Catalogue (spec 2).
 *
 * The fifty prizes the app owner supplied, with a fulfilment type derived from
 * their category, which is the field the whole claim flow turns on, and the
 * one their source data has no equivalent of. Reward Points become `points`
 * with the amount parsed from the name, Airtime & Data splits on whether the
 * name mentions data, Vouchers become `gift_card`, and the rest divide into
 * physical goods and experiences.
 *
 * Reports by default and only writes when told to, matching the other scripts
 * here. Re-running is safe: a prize whose name already exists is left alone,
 * because catalogue names are unique and an existing row may have been edited
 * deliberately.
 *
 * Every prize is seeded with `requiresVerification: false`. Turning the gate on
 * before there is a working verification screen would route those winners into
 * the old ID-upload form, which is worse than not gating at all. Set the
 * checkbox per prize in the CMS once that flow is real.
 *
 * Usage, from apps/cms:
 *
 *   bun run src/scripts/seed-prize-catalogue.ts
 *       Report what would change. Touches nothing.
 *
 *   bun run src/scripts/seed-prize-catalogue.ts --write
 *       Create the missing prizes.
 */

import { getPayload } from "@news-spend-media/payload";

type SeedPrize = {
  name: string;
  tier: "tier1" | "tier2" | "tier3";
  fulfilmentType:
    | "points"
    | "airtime"
    | "data"
    | "gift_card"
    | "physical"
    | "experience";
  pointsAmount?: number;
  valueNaira: number;
  description?: string;
};

const CATALOGUE: SeedPrize[] = [
  {
    name: "Refrigerator",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 450_000,
    description: "Double door smart frost-free refrigerator",
  },
  {
    name: "Deep Freezer",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 350_000,
    description: "Chest freezer with quick freeze function",
  },
  {
    name: "Generator",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 500_000,
    description: "3.5kVA silent inverter generator",
  },
  {
    name: "Laptop",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 650_000,
    description: "15-inch ultra-thin productivity laptop",
  },
  {
    name: "Smart TV",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 750_000,
    description: "55-inch 4K UHD Smart OLED TV",
  },
  {
    name: "PlayStation Console",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 850_000,
    description: "PlayStation 5 Console Edition",
  },
  {
    name: "Xbox Console",
    tier: "tier1",
    fulfilmentType: "physical",
    valueNaira: 800_000,
    description: "Xbox Series X 1TB Console",
  },
  {
    name: "20% Hotel Discount",
    tier: "tier1",
    fulfilmentType: "experience",
    valueNaira: 100_000,
    description: "Luxury hotel stay discount voucher",
  },
  {
    name: "Dinner for Two",
    tier: "tier1",
    fulfilmentType: "experience",
    valueNaira: 80_000,
    description: "Fine dining 3-course dinner experience",
  },
  {
    name: "₦50,000 Shopping Voucher",
    tier: "tier1",
    fulfilmentType: "gift_card",
    valueNaira: 50_000,
    description: "Multi-store shopping e-voucher",
  },
  {
    name: "VIP Event Tickets for Two",
    tier: "tier1",
    fulfilmentType: "experience",
    valueNaira: 120_000,
    description: "Concert/Match premium VIP pass",
  },
  {
    name: "Smartphone",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 250_000,
    description: "5G Android smartphone with OLED display",
  },
  {
    name: "iPad",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 380_000,
    description: "10.2-inch Wi-Fi Tablet",
  },
  {
    name: "Apple Watch",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 320_000,
    description: "Fitness and heart tracking smartwatch",
  },
  {
    name: "Smart Home Assistant",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 95_000,
    description: "Voice-controlled smart hub display",
  },
  {
    name: "Smart Speaker",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 45_000,
    description: "360-degree wireless Bluetooth speaker",
  },
  {
    name: "Headphones",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 75_000,
    description: "Over-ear active noise cancelling headphones",
  },
  {
    name: "Wireless Earbuds",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 35_000,
    description: "True wireless stereo earbuds with charging case",
  },
  {
    name: "Blender",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 40_000,
    description: "High-speed smoothie blender with glass jar",
  },
  {
    name: "Solar Charger",
    tier: "tier2",
    fulfilmentType: "physical",
    valueNaira: 30_000,
    description: "20,000mAh solar power bank",
  },
  {
    name: "Movie Tickets for Two",
    tier: "tier2",
    fulfilmentType: "experience",
    valueNaira: 25_000,
    description: "2x Cinema VIP tickets + snacks",
  },
  {
    name: "Bowling for Two",
    tier: "tier2",
    fulfilmentType: "experience",
    valueNaira: 30_000,
    description: "2-hour bowling game pass for 2",
  },
  {
    name: "Premium Haircut OR Styling",
    tier: "tier2",
    fulfilmentType: "experience",
    valueNaira: 20_000,
    description: "Salon / Barber luxury grooming session",
  },
  {
    name: "One-Month Gym Membership",
    tier: "tier2",
    fulfilmentType: "experience",
    valueNaira: 35_000,
    description: "All-access pass to partner fitness centers",
  },
  {
    name: "Premium Car Wash",
    tier: "tier2",
    fulfilmentType: "experience",
    valueNaira: 15_000,
    description: "Full interior & exterior detailing service",
  },
  {
    name: "₦20,000 Restaurant Voucher",
    tier: "tier2",
    fulfilmentType: "gift_card",
    valueNaira: 20_000,
    description: "Dining voucher for top partner restaurants",
  },
  {
    name: "₦5,000 Airtime",
    tier: "tier2",
    fulfilmentType: "airtime",
    valueNaira: 5000,
    description: "Instant top-up for any network",
  },
  {
    name: "10GB Data",
    tier: "tier2",
    fulfilmentType: "data",
    valueNaira: 4500,
    description: "30-day mobile data package",
  },
  {
    name: "20GB Data",
    tier: "tier2",
    fulfilmentType: "data",
    valueNaira: 8500,
    description: "30-day high-speed data package",
  },
  {
    name: "₦15,000 Gift Card",
    tier: "tier2",
    fulfilmentType: "gift_card",
    valueNaira: 15_000,
    description: "E-commerce shopping gift card",
  },
  {
    name: "₦20,000 Gift Card",
    tier: "tier2",
    fulfilmentType: "gift_card",
    valueNaira: 20_000,
    description: "E-commerce shopping gift card",
  },
  {
    name: "100 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 100,
    valueNaira: 100,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "150 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 150,
    valueNaira: 150,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "200 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 200,
    valueNaira: 200,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "250 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 250,
    valueNaira: 250,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "400 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 400,
    valueNaira: 400,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "500 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 500,
    valueNaira: 500,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "1,000 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 1000,
    valueNaira: 1000,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "2,000 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 2000,
    valueNaira: 2000,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "3,000 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 3000,
    valueNaira: 3000,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "4,000 Points",
    tier: "tier3",
    fulfilmentType: "points",
    pointsAmount: 4000,
    valueNaira: 4000,
    description: "NewsSpend platform loyalty points",
  },
  {
    name: "₦500 Airtime",
    tier: "tier3",
    fulfilmentType: "airtime",
    valueNaira: 500,
    description: "Direct mobile airtime voucher",
  },
  {
    name: "₦1,000 Airtime",
    tier: "tier3",
    fulfilmentType: "airtime",
    valueNaira: 1000,
    description: "Direct mobile airtime voucher",
  },
  {
    name: "₦2,000 Airtime",
    tier: "tier3",
    fulfilmentType: "airtime",
    valueNaira: 2000,
    description: "Direct mobile airtime voucher",
  },
  {
    name: "2GB Data",
    tier: "tier3",
    fulfilmentType: "data",
    valueNaira: 1500,
    description: "Direct mobile data bundle",
  },
  {
    name: "5GB Data",
    tier: "tier3",
    fulfilmentType: "data",
    valueNaira: 2500,
    description: "Direct mobile data bundle",
  },
  {
    name: "₦1,000 Gift Card",
    tier: "tier3",
    fulfilmentType: "gift_card",
    valueNaira: 1000,
    description: "Digital retail shopping code",
  },
  {
    name: "₦2,000 Gift Card",
    tier: "tier3",
    fulfilmentType: "gift_card",
    valueNaira: 2000,
    description: "Digital retail shopping code",
  },
  {
    name: "₦5,000 Gift Card",
    tier: "tier3",
    fulfilmentType: "gift_card",
    valueNaira: 5000,
    description: "Digital retail shopping code",
  },
  {
    name: "₦10,000 Gift Card",
    tier: "tier3",
    fulfilmentType: "gift_card",
    valueNaira: 10_000,
    description: "Digital retail shopping code",
  },
];

const write = process.argv.includes("--write");
const payload = await getPayload();

const existing = await payload.find({
  collection: "prize-catalogue",
  pagination: false,
  depth: 0,
});

const byName = new Set(existing.docs.map((doc) => doc.name));
const missing = CATALOGUE.filter((prize) => !byName.has(prize.name));

console.log(`Catalogue holds ${existing.docs.length} prize(s).`);
console.log(`${missing.length} of ${CATALOGUE.length} seed prizes are absent.`);

if (missing.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

const byType = new Map<string, number>();
for (const prize of missing) {
  byType.set(prize.fulfilmentType, (byType.get(prize.fulfilmentType) ?? 0) + 1);
}
console.log(
  [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `  ${type}: ${count}`)
    .join("\n")
);

if (!write) {
  console.log("\nDry run. Pass --write to create them.");
  process.exit(0);
}

let created = 0;
let failed = 0;

for (const prize of missing) {
  try {
    await payload.create({
      collection: "prize-catalogue",
      data: {
        name: prize.name,
        tier: prize.tier,
        description: prize.description,
        fulfilmentType: prize.fulfilmentType,
        pointsAmount: prize.pointsAmount,
        valueNaira: prize.valueNaira,
        requiresVerification: false,
        active: true,
      },
    });
    created += 1;
  } catch (error) {
    failed += 1;
    console.error(
      `  failed: ${prize.name}: ${error instanceof Error ? error.message : error}`
    );
  }
}

console.log(
  `\nCreated ${created} prize(s).${failed ? ` ${failed} failed.` : ""}`
);
process.exit(failed > 0 ? 1 : 0);
