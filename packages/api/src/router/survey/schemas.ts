import z from "zod";

const CPX_SECURE_HASH = process.env.CPX_SECURE_HASH;
const CPX_APP_ID = process.env.CPX_APP_ID;

export const CPXSurveySchema = z
  .object({
    id: z.string(),
    loi: z.number().optional(),
    payout: z.string().optional(),
    conversion_rate: z.string().optional(),
    score: z.string().optional(),
    statistics_rating_count: z.number().optional(),
    statistics_rating_avg: z.number().optional(),
    type: z.string().optional(),
    top: z.number().optional(),
    details: z.number().optional(),
    payout_publisher_usd: z.number().optional(),
    href: z.string().optional(),
    href_new: z.string().optional(),
  })
  .passthrough();

export const CPXSurveyResponseSchema = z
  .object({
    status: z.string().optional(),
    count_available_surveys: z.number(),
    count_returned_surveys: z.number(),
    transactions: z.array(z.any()).optional(),
    surveys: z.array(CPXSurveySchema),
  })
  .passthrough();

export const CPXPostBackInputSchema = z
  .object({
    status: z.string(),
    trans_id: z.string(),
    user_id: z.string(),
    amount_local: z.coerce.number().optional(),
    amount_usd: z.coerce.number().optional(),
    ip_click: z.string().optional(),
    type: z.string(),
    secure_hash: z.string(),
  })
  .passthrough();

export const AwardGoogleFormInputSchema = z.object({
  gFormId: z.string(),
  userId: z.string(),
});

export type CPXSurvey = z.infer<typeof CPXSurveySchema>;
export type CPXPostBackInput = z.infer<typeof CPXPostBackInputSchema>;

export { CPX_APP_ID, CPX_SECURE_HASH };
