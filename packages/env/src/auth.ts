import { skipValidation } from "@news-spend-media/env/helpers/skipValidation";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,

  experimental__runtimeEnv: {},
  server: {
    AUTH_SECRET: z.string(),
  },
  skipValidation,
});
