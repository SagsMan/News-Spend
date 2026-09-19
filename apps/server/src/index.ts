import { createContext } from "@news-spend-media/api/context";
import { router } from "@news-spend-media/api/router/index";
import { diditWebhookHandler } from "@news-spend-media/api/router/verification/webhook";
import { auth } from "@news-spend-media/auth";
import { logger as appLogger } from "@news-spend-media/logger";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
// import { PinoHandlerPlugin } from "@orpc/pino";
import { RateLimitHandlerPlugin } from "@orpc/ratelimit";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import * as Sentry from "@sentry/bun";
import { AccountDeletionPage } from "./pages/AccountDeletion";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";

const logger = appLogger;

const CORS_ORIGINS = [
  process.env.CORS_ORIGIN || "",
  "http://localhost:9000",
  "http://cms.newsspend.localhost:1355",
  "http://server.newsspend.localhost:1355",
  "https://staging-cms.newsspend.com",
  "https://cms.newsspend.com",
].filter(Boolean);

const servers: Array<{ url: string; description: string }> = [];

if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  servers.push({
    url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`,
    description: process.env.RAILWAY_ENVIRONMENT || "Production",
  });
}

servers.push({
  url: `http://localhost:${process.env.PORT || 9000}/api`,
  description: "Development",
});

servers.push({
  url: "http://server.newsspend.localhost:1355/api",
  description: "Development",
});

export const openAPISpec = await new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
}).generate(router, {
  base: {
    servers,
    info: {
      title: "News Spend Media API",
      version: "1.0.0",
    },
  },
});

const SENSITIVE_KEY_RE = /password|secret|token|authorization|cookie|otp|pin/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_RE.test(key) ? "[REDACTED]" : redact(entry),
      ])
    );
  }
  return value;
}

/**
 * Pull the schema `issues` and offending input out of a validation failure.
 *
 * oRPC surfaces input/output validation as an ORPCError whose `cause` is a
 * ValidationError carrying both. The default `{ err }` log keeps the top-level
 * message ("Input validation failed") but drops exactly what was wrong and
 * what was sent, which is what a failure like API-B needs to be diagnosable.
 */
function validationDetails(
  error: unknown
): { validationIssues: unknown; invalidData: unknown } | undefined {
  if (!error || typeof error !== "object") {
    return;
  }
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") {
    return;
  }
  if (!("issues" in cause && "invalidData" in cause)) {
    return;
  }
  const details = cause as { issues: unknown; invalidData: unknown };
  return {
    validationIssues: details.issues,
    invalidData: redact(details.invalidData),
  };
}

function logHandlerError(scope: "API" | "RPC") {
  return (error: unknown) => {
    const details = validationDetails(error);
    if (details) {
      logger.error(
        { err: error, ...details },
        `${scope} handler error (input validation failed)`
      );
    } else {
      logger.error({ err: error }, `${scope} handler error`);
    }
  };
}

export const apiHandler = new OpenAPIHandler(router, {
  plugins: [
    new BatchHandlerPlugin(),
    new RateLimitHandlerPlugin(),
    // new PinoHandlerPlugin({
    //   logger,
    //   logRequestResponse: true,
    // }),
    new OpenAPIReferenceHandlerPlugin({
      provider: "scalar",
      docsTitle: "OpenAPI Documentation",
      spec: openAPISpec,
    }),
  ],
  interceptors: [onError(logHandlerError("API"))],
});

/**
 * Attach the signed-in user to whatever Sentry reports from this request.
 *
 * Wrapped in an isolation scope rather than calling `setUser` directly. On a
 * custom `Bun.serve` handler there is no per-request scope by default, so a
 * bare `setUser` writes to a scope shared by every concurrent request — one
 * person's identity would end up on another person's error, which is worse
 * than having no identity at all.
 *
 * Deliberately id and email only. Sentry already sees the request; the point
 * here is to answer "who hit this", not to copy the account into it.
 */
function withSentryUser<T>(
  user: { id?: string; email?: string } | undefined,
  run: () => Promise<T>
): Promise<T> {
  return Sentry.withIsolationScope(async (scope) => {
    if (user?.id) {
      scope.setUser({
        id: user.id,
        email: user.email,
        ip_address: "{{auto}}",
      });
    }
    return await run();
  });
}

async function handleApi(req: Request) {
  const origin = req.headers.get("origin");
  const context = await createContext({ request: req });
  return await withSentryUser(context.user, async () => {
    const result = await apiHandler.handle(req, { prefix: "/api", context });
    if (result.matched) {
      // new Headers(...) rather than Object.fromEntries(...entries()), which
      // collapses repeated headers. Auth responses can carry several Set-Cookie
      const headers = new Headers(result.response.headers);
      for (const [key, value] of Object.entries(getCorsHeaders(origin))) {
        headers.set(key, value);
      }
      return new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  });
}

export const rpcHandler = new RPCHandler(router, {
  plugins: [
    new BatchHandlerPlugin(),
    new RateLimitHandlerPlugin(),
    // new PinoHandlerPlugin({
    //   logger,
    //   logRequestResponse: true,
    // }),
  ],
  interceptors: [onError(logHandlerError("RPC"))],
});

async function handleRpc(req: Request) {
  const origin = req.headers.get("origin");
  const context = await createContext({ request: req });
  return await withSentryUser(context.user, async () => {
    const result = await rpcHandler.handle(req, { prefix: "/rpc", context });
    if (result.matched) {
      const headers = new Headers(result.response.headers);
      for (const [key, value] of Object.entries(getCorsHeaders(origin))) {
        headers.set(key, value);
      }
      return new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  });
}

function isCorsOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return true;
  }
  return CORS_ORIGINS.includes(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isCorsOriginAllowed(origin)
    ? origin || "*"
    : CORS_ORIGINS[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Attach CORS headers to a Response, mutating it in place where possible.
 *
 * Constructing `new Response(res.body, ...)` just to add headers re-wraps the
 * body stream on every request; mutating the existing headers avoids that.
 * Responses from Response.redirect() carry an immutable header guard, so fall
 * back to re-wrapping for those.
 */
function withCors(response: Response, origin: string | null): Response {
  const cors = getCorsHeaders(origin);

  try {
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

/**
 * Credential scanners sweep for dotfiles (.env, .git/config, .ssh/id_rsa,
 * .claude.json, ...). Nothing here serves files, but an /api/-prefixed probe
 * would otherwise reach createContext and cost a session lookup to 404.
 * .well-known is exempt; it is a real path better-auth can serve under.
 */
function isDotfileProbe(pathname: string): boolean {
  return pathname
    .split("/")
    .some((segment) => segment.startsWith(".") && segment !== ".well-known");
}

const port = Number(process.env.PORT) || 9000;

function logRequest(req: Request) {
  const now = new Date();
  const isoTimePart = now.toISOString().split("T")[1];
  const timestamp = isoTimePart
    ? isoTimePart.split(".")[0]
    : now.toTimeString().split(" ")[0];
  const msg = `${timestamp} -> ${req.method} ${new URL(req.url).pathname}`;
  logger.info(msg);
}

function logResponse(req: Request, status: number, elapsed: number) {
  const now = new Date();
  const isoTimePart = now.toISOString().split("T")[1];
  const timestamp = isoTimePart
    ? isoTimePart.split(".")[0]
    : now.toTimeString().split(" ")[0];
  const arrow = status >= 400 ? "<" : "<-";
  const msg = `${timestamp} ${arrow} ${req.method} ${new URL(req.url).pathname} ${status} ${elapsed}ms`;
  if (status >= 500) {
    logger.error(msg);
  } else if (status >= 400) {
    logger.warn(msg);
  } else {
    logger.info(msg);
  }
}

const staticRoutes = {
  "/": () => new Response("OK"),

  "/health": () => {
    const mem = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      // rss climbing while heapUsed stays flat means the growth is native
      // (allocator/runtime) rather than anything the JS heap is holding.
      // That distinction is what tells us whether a memory issue is ours
      memory: {
        rssMb: mb(mem.rss),
        heapTotalMb: mb(mem.heapTotal),
        heapUsedMb: mb(mem.heapUsed),
        externalMb: mb(mem.external),
        arrayBuffersMb: mb(mem.arrayBuffers),
      },
    });
  },

  "/account-deletion": () =>
    new Response(AccountDeletionPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),

  "/delete-account": () =>
    new Response(AccountDeletionPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),

  "/privacy-policy": () =>
    new Response(PrivacyPolicy(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
};

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",

  fetch(req) {
    const start = Date.now();
    const url = new URL(req.url);
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    if (isDotfileProbe(url.pathname)) {
      // not logged as a request/response pair: these arrive in bursts of
      // ~200 and drown the real traffic out of the deploy logs
      logger.debug({ path: url.pathname }, "Blocked dotfile probe");
      return new Response("Not Found", { status: 404 });
    }

    const staticHandler =
      staticRoutes[url.pathname as keyof typeof staticRoutes];
    if (staticHandler) {
      logRequest(req);
      const res = staticHandler();
      logResponse(req, res.status, Date.now() - start);
      return res;
    }

    if (url.pathname.startsWith("/api/auth/")) {
      logRequest(req);
      const handler = async () => {
        const expoOrigin = req.headers.get("expo-origin");
        const authRequest = expoOrigin
          ? new Request(req, {
              headers: {
                ...Object.fromEntries(req.headers),
                origin: expoOrigin,
              },
            })
          : req;
        const authResponse = await auth.handler(authRequest);
        return withCors(authResponse, origin);
      };

      return handler().then((res) => {
        logResponse(req, res.status, Date.now() - start);
        return res;
      });
    }

    if (url.pathname === "/rpc" || url.pathname.startsWith("/rpc/")) {
      logRequest(req);
      return handleRpc(req).then((res) => {
        logResponse(req, res.status, Date.now() - start);
        return res;
      });
    }

    // Ahead of the /api/ catch-all: the signature is computed over the exact
    // body Didit sent, so this must not pass through the oRPC handler first.
    if (url.pathname === "/api/verification/didit") {
      logRequest(req);
      return diditWebhookHandler(req).then((res) => {
        logResponse(req, res.status, Date.now() - start);
        return res;
      });
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      logRequest(req);
      return handleApi(req).then((res) => {
        logResponse(req, res.status, Date.now() - start);
        return res;
      });
    }

    logRequest(req);
    logResponse(req, 404, Date.now() - start);
    return new Response("Not Found", { status: 404 });
  },

  error(error) {
    logger.error({ err: error }, "Server error");
    // Last line of defence: anything that escapes fetch() lands here, including
    // the routes that never touch oRPC's sentryMiddleware (auth, webhooks,
    // static pages).
    Sentry.captureException(error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

appLogger.info(
  { port: server.port, hostname: server.hostname },
  "Server is running"
);

// Periodic memory sample. Railway graphs RSS only, which cannot distinguish
// native/allocator retention from the JS heap holding objects, the split is
// what says whether a memory problem is ours. uptimeH is included so a restart
// shows up in the series instead of having to be inferred from a reset counter.
const MEMORY_SAMPLE_INTERVAL_MS = Number(
  process.env.MEMORY_SAMPLE_INTERVAL_MS ?? 15 * 60 * 1000
);

if (MEMORY_SAMPLE_INTERVAL_MS > 0) {
  const sampleMemory = () => {
    const mem = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

    logger.info(
      {
        rssMb: mb(mem.rss),
        heapUsedMb: mb(mem.heapUsed),
        heapTotalMb: mb(mem.heapTotal),
        externalMb: mb(mem.external),
        arrayBuffersMb: mb(mem.arrayBuffers),
        uptimeH: Number((process.uptime() / 3600).toFixed(2)),
      },
      "memory sample"
    );
  };

  sampleMemory(); // t=0, so the series has a baseline for this process
  setInterval(sampleMemory, MEMORY_SAMPLE_INTERVAL_MS).unref();
}

// initialize redis and cron jobs (best-effort)
try {
  if (process.env.REDIS_URL) {
    import("@news-spend-media/api/lib/redis").then(({ getRedis }) => {
      try {
        getRedis();
      } catch {
        // noop
      }
    });
  }
  import("@news-spend-media/api/jobs/trending").then((m) => {
    try {
      m.startTrendingJob();
    } catch {
      // noop
    }
  });
  import("@news-spend-media/api/jobs/giveaway").then((m) => {
    try {
      m.startGiveawayJob();
    } catch {
      // noop
    }
  });
} catch {
  // noop
}

// graceful shutdown
async function gracefulShutdown() {
  try {
    const { disconnectRedis } = await import("@news-spend-media/api/lib/redis");
    await disconnectRedis();
  } catch {
    // redis may not have been initialized
  }

  // Railway SIGTERMs on every deploy; without this the events buffered for the
  // crash that prompted the restart are lost with the process.
  await Sentry.flush(2000).catch(() => {
    // nothing useful to do if the transport is already gone
  });
}

process.on("SIGINT", async () => {
  await server.stop();
  gracefulShutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", async () => {
  await server.stop();
  gracefulShutdown().finally(() => process.exit(0));
});
