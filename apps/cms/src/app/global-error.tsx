"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// Errors thrown while rendering a root layout escape every nested error
// boundary, so this is the only place they can be captured. It replaces the
// root layout when it renders, hence the <html>/<body> here.
export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
