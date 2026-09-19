import z from "zod";

const PROVIDERS = ["cpx", "rapido", "theorem"] as const;
export type OfferProvider = (typeof PROVIDERS)[number];

export const UnifiedOfferSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  title: z.string(),
  description: z.string().optional(),
  points: z.number(),
  estimatedTime: z.number().optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  country: z.string().optional(),
  type: z.enum(["survey", "game", "offer"]),
  qualificationRate: z.number().optional(),
});

export const OfferInputSchema = z.object({
  limit: z.number().min(1).max(50).nullish().default(20),
  country: z.string().optional(),
  type: z.enum(["survey", "game", "offer", "all"]).optional().default("all"),
});

export type UnifiedOffer = z.infer<typeof UnifiedOfferSchema>;
export type OfferInput = z.infer<typeof OfferInputSchema>;

export const CPX_SECURE_HASH = process.env.CPX_SECURE_HASH;
export const CPX_APP_ID = process.env.CPX_APP_ID;
export const RAPIDO_API_KEY = process.env.RAPIDO_API_KEY;
export const RAPIDO_APP_ID = process.env.RAPIDO_APP_ID;
export const RAPIDO_SECURE_HASH = process.env.RAPIDO_SECURE_HASH;
export const THEOREM_API_KEY = process.env.THEOREM_API_KEY;
export const THEOREM_REACH_URL =
  process.env.THEOREM_REACH_URL ||
  "https://theoremreach.com/respondent_entry/direct";
