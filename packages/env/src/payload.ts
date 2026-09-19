import { skipValidation } from "@news-spend-media/env/helpers/skipValidation";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_PAYLOAD_URL: z
      .string()
      .url()
      .optional()
      .default("http://localhost:3000"),
  },
  emptyStringAsUndefined: true,

  experimental__runtimeEnv: {
    NEXT_PUBLIC_PAYLOAD_URL: process.env.NEXT_PUBLIC_PAYLOAD_URL,
  },
  server: {
    PAYLOAD_PRIVATE_DATABASE_URI: z
      .string()
      .optional()
      .default("postgres://payload:payload@localhost:5432/payload"),
    PAYLOAD_PRIVATE_REVALIDATION_KEY: z
      .string()
      .optional()
      .default("revalidation-key"),
    PAYLOAD_PRIVATE_SECRET: z.string().optional().default("payload-secret"),
  },
  skipValidation,
});
