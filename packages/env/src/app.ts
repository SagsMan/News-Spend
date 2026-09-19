import { skipValidation } from "@news-spend-media/env/helpers/skipValidation";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,

  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  },
  shared: {
    NEXT_PUBLIC_APP_ENV: z
      .enum(["local", "staging", "production"])
      .default("local"),
  },
  skipValidation,
});
