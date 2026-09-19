import { ORPCError, os } from "@orpc/server";

// Utility function to format current time
const formatNow = (): string => {
  const now = new Date();
  return now.toISOString().replace("T", " ").substring(0, 19);
};

// Utility function to colorize status codes for console output
const colorStatus = (status: number): string => {
  const statusStr = status.toString();

  if (status >= 200 && status < 300) {
    return `\x1b[32m${statusStr}\x1b[0m`; // Green for success
  }
  if (status >= 400 && status < 500) {
    return `\x1b[33m${statusStr}\x1b[0m`; // Yellow for client errors
  }
  if (status >= 500) {
    return `\x1b[31m${statusStr}\x1b[0m`; // Red for server errors
  }
  return statusStr; // No color for other statuses
};

export const loggerMiddleware = os
  .$context<{ request: Request }>()
  .middleware(async ({ context, next, path }) => {
    const start = Date.now();
    const method = context.request?.method ?? "N/A";
    const pathname = `/rpc/${path.join("/")}`;

    try {
      console.log(`[${formatNow()}] REQ ${method} ${pathname}`);
      const result = await next({});
      const duration = Date.now() - start;
      const status = 200; // Success status

      console.log(
        `[${formatNow()}] RES ${method} ${pathname} ${colorStatus(status)} ${duration}ms`
      );

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      let status: number;
      if (error instanceof ORPCError) {
        switch (error.code) {
          case "UNAUTHORIZED":
            status = 401;
            break;
          case "BAD_REQUEST":
            status = 400;
            break;
          case "NOT_FOUND":
            status = 404;
            break;
          case "FORBIDDEN":
            status = 403;
            break;
          default:
            status = 500;
            break;
        }
      } else {
        status = 500;
      }

      console.error(
        `[${formatNow()}] ERR ${method} ${pathname} ${colorStatus(status)} ${duration}ms | Error: ${error instanceof Error ? error.message : String(error)}`
      );

      throw error;
    }
  });
