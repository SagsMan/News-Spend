import type { AnyRouter, RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";

import type { Context } from "./context";

/**
 * Test harness for the oRPC routers.
 *
 * Procedures are called directly (see https://v2.orpc.dev/docs/advanced/testing-and-mocking)
 * with `call()` or with a router client built by {@link createTestClient}, so
 * validation, middleware and handler logic all run without going over HTTP.
 * The only thing a test has to supply is a context: {@link mockContext} builds
 * one, and {@link createFakePayload} stands in for the Payload instance.
 */

// Documents are shaped by the Payload collections under test, which the fake
// does not know about; tests assert on the fields they seeded.
// biome-ignore lint/suspicious/noExplicitAny: intentionally untyped test fixture
export type Doc = Record<string, any>;

export type MockContextOverrides = Partial<Omit<Context, "payload">> & {
  payload?: Record<string, unknown>;
};

/**
 * Build a minimal Context for unit-testing procedures via `call()`.
 *
 * Procedures under test only touch a small slice of the real context, so the
 * defaults here are deliberately cheap. Pass overrides to simulate an
 * authenticated user, a guest, or a request with headers.
 *
 * `request` defaults to a real (localhost) Request rather than `undefined`
 * because the rate-limit middleware reads `context.request.headers` when
 * deriving the key for an anonymous caller.
 *
 * `payload` is deliberately loose (`Record<string, unknown>`): the full
 * Payload `BasePayload` is a huge type and procedures only stub the handful
 * of methods they call.
 */
export function mockContext(overrides: MockContextOverrides = {}): Context {
  const { user, payload, headers, request, ...rest } = overrides;
  const resolvedHeaders = headers ?? new Headers();

  return {
    session: user ? { id: "session-1", userId: user.id } : null,
    user: user ?? null,
    payload: (payload ?? {}) as unknown as Context["payload"],
    request:
      request ??
      new Request("http://localhost/test", { headers: resolvedHeaders }),
    headers: resolvedHeaders,
    ...rest,
  } as Context;
}

/**
 * A server-side client for a router, bound to one context.
 *
 * Lets a test call `client.notificationSettings.get()` instead of threading
 * `{ context }` through every `call()`. Equivalent otherwise: the same
 * middleware and validation run.
 */
export function createTestClient<T extends AnyRouter>(
  router: T,
  context: Context
): RouterClient<T> {
  return createRouterClient(router, {
    context,
  } as never) as RouterClient<T>;
}

/**
 * Run a call that is expected to reject and hand the error back to the test.
 *
 * Throws if the call resolves, so a passing assertion can never be a
 * false positive from a procedure that quietly succeeded.
 */
export async function expectError(
  promise: Promise<unknown>
): Promise<{ code: string; message: string; data?: unknown }> {
  try {
    await promise;
  } catch (error) {
    return error as { code: string; message: string; data?: unknown };
  }
  throw new Error("expected the call to reject, but it resolved");
}

type Operation = {
  op: "find" | "findByID" | "create" | "update" | "delete" | "count";
  collection: string;
  args: Doc;
};

export type FakePayloadOptions = {
  /** Seed documents keyed by collection slug. */
  collections?: Record<string, Doc[]>;
  /** Generate an id for a created doc. Defaults to `<collection>-<n>`. */
  generateID?: (collection: string, index: number) => string;
};

/**
 * An in-memory stand-in for the Payload local API.
 *
 * Covers the operations the routers actually use (find / findByID / create /
 * update / delete / count plus the `db` transaction hooks) over seeded
 * documents, with enough `where` support (see {@link matchesWhere}) that
 * queries in handlers filter for real instead of being stubbed away per test.
 *
 * Anything a specific router needs beyond this (drizzle queries, `payload.jobs`)
 * should be spread over the result in that test rather than added here.
 */
export function createFakePayload(options: FakePayloadOptions = {}) {
  const collections: Record<string, Doc[]> = {};
  for (const [slug, docs] of Object.entries(options.collections ?? {})) {
    collections[slug] = [...docs];
  }

  const generateID =
    options.generateID ??
    ((collection: string, index: number) => `${collection}-${index}`);

  /** Every operation the handler performed, in order, for assertions. */
  const calls: Operation[] = [];
  const record = (op: Operation["op"], collection: string, args: Doc) => {
    calls.push({ op, collection, args });
  };

  const docsIn = (collection: string): Doc[] => {
    collections[collection] ??= [];
    return collections[collection];
  };

  const transactions: string[] = [];
  let transactionCount = 0;

  const payload = {
    /** Live view of the seeded data; assert against it after a mutation. */
    collections,
    /** The (always-defined) document list for a collection, for assertions. */
    docs: (collection: string): Doc[] => docsIn(collection),
    calls,
    transactions,

    logger: {
      error: () => undefined,
      warn: () => undefined,
      info: () => undefined,
      debug: () => undefined,
    },

    db: {
      beginTransaction: async () => {
        transactionCount += 1;
        const id = `tx-${transactionCount}`;
        transactions.push(`begin:${id}`);
        return id;
      },
      commitTransaction: async (id: string) => {
        transactions.push(`commit:${id}`);
      },
      rollbackTransaction: async (id: string) => {
        transactions.push(`rollback:${id}`);
      },
      drizzle: undefined as unknown,
    },

    find: async ({ collection, where, sort, limit, page }: Doc) => {
      record("find", collection, { where, sort, limit, page });

      const matched = docsIn(collection).filter((doc) =>
        matchesWhere(doc, where)
      );
      const sorted = sort ? sortDocs(matched, sort) : matched;

      const perPage = limit ?? 10;
      const currentPage = page ?? 1;
      const start = (currentPage - 1) * perPage;
      const docs = perPage > 0 ? sorted.slice(start, start + perPage) : sorted;
      const totalPages = perPage > 0 ? Math.ceil(sorted.length / perPage) : 1;

      return {
        docs,
        totalDocs: sorted.length,
        limit: perPage,
        page: currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        pagingCounter: start + 1,
      };
    },

    findByID: async ({ collection, id }: Doc) => {
      record("findByID", collection, { id });
      return (
        docsIn(collection).find((doc) => String(doc.id) === String(id)) ?? null
      );
    },

    count: async ({ collection, where }: Doc) => {
      record("count", collection, { where });
      return {
        totalDocs: docsIn(collection).filter((doc) => matchesWhere(doc, where))
          .length,
      };
    },

    create: async ({ collection, data }: Doc) => {
      record("create", collection, { data });
      const now = new Date().toISOString();
      const doc = {
        id: generateID(collection, docsIn(collection).length + 1),
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      docsIn(collection).push(doc);
      return doc;
    },

    update: async ({ collection, id, where, data }: Doc) => {
      record("update", collection, { id, where, data });
      const targets = docsIn(collection).filter((doc) =>
        id === undefined
          ? matchesWhere(doc, where)
          : String(doc.id) === String(id)
      );

      for (const doc of targets) {
        Object.assign(doc, data, { updatedAt: new Date().toISOString() });
      }

      // Payload returns the doc for an id update and `{ docs }` for a bulk one.
      return id === undefined
        ? { docs: targets, errors: [] }
        : (targets[0] ?? null);
    },

    delete: async ({ collection, id, where }: Doc) => {
      record("delete", collection, { id, where });
      const remaining: Doc[] = [];
      const removed: Doc[] = [];

      for (const doc of docsIn(collection)) {
        const hit =
          id === undefined
            ? matchesWhere(doc, where)
            : String(doc.id) === String(id);
        (hit ? removed : remaining).push(doc);
      }
      collections[collection] = remaining;

      return id === undefined
        ? { docs: removed, errors: [] }
        : (removed[0] ?? null);
    },
  };

  return payload;
}

export type FakePayload = ReturnType<typeof createFakePayload>;

/**
 * Read a field, unwrapping a populated relationship down to its id.
 *
 * Handles the dotted paths the routers query (`user.id`, `target.value`,
 * `notificationPreferences.types.BREAKING_NEWS`, `schedule.startDate`). A path
 * ending in `.id` also resolves against an *unpopulated* relationship, where
 * the field is the raw id string, matching how Payload treats depth 0.
 */
function fieldValue(doc: Doc, field: string): unknown {
  // A doc may carry the path as a literal flat key (`{"target.value": "c1"}`),
  // which is how Payload stores a polymorphic relationship's parts.
  if (field in doc) {
    return unwrapRelation(doc[field]);
  }

  const parts = field.split(".");
  let value: unknown = doc;

  for (const [index, part] of parts.entries()) {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value !== "object") {
      // `user.id` against `user: "u1"`: the id itself is the last segment.
      return part === "id" && index === parts.length - 1 ? value : undefined;
    }
    value = (value as Doc)[part];
  }

  return unwrapRelation(value);
}

/** A populated relationship reads as its id. */
function unwrapRelation(value: unknown): unknown {
  if (value && typeof value === "object" && "id" in value) {
    return (value as Doc).id;
  }
  return value;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

/**
 * Evaluate a Payload `where` clause against a document.
 *
 * Supports the operators the routers use: equals / not_equals, in / not_in,
 * exists, the four comparisons, like / contains, and nested and / or. An
 * operator that is not implemented is treated as a match, so an unsupported
 * query loosens the filter rather than silently excluding everything.
 */
const operators: Record<
  string,
  (actual: unknown, expected: unknown) => boolean
> = {
  equals: (actual, expected) => String(actual) === String(expected),
  not_equals: (actual, expected) => String(actual) !== String(expected),
  in: (actual, expected) =>
    toList(expected).some((v) => String(v) === String(actual)),
  not_in: (actual, expected) =>
    !toList(expected).some((v) => String(v) === String(actual)),
  exists: (actual, expected) =>
    (actual !== undefined && actual !== null) === Boolean(expected),
  greater_than: (actual, expected) => compare(actual, expected) > 0,
  greater_than_equal: (actual, expected) => compare(actual, expected) >= 0,
  less_than: (actual, expected) => compare(actual, expected) < 0,
  less_than_equal: (actual, expected) => compare(actual, expected) <= 0,
  like: contains,
  contains,
};

function contains(actual: unknown, expected: unknown): boolean {
  return String(actual ?? "")
    .toLowerCase()
    .includes(String(expected).toLowerCase());
}

export function matchesWhere(doc: Doc, where: Doc | undefined): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === "and") {
      return (condition as Doc[]).every((clause) => matchesWhere(doc, clause));
    }
    if (field === "or") {
      return (condition as Doc[]).some((clause) => matchesWhere(doc, clause));
    }

    const clause = condition as Doc;
    const actual = fieldValue(doc, field);

    return Object.entries(clause).every(([operator, expected]) => {
      const check = operators[operator];
      // An operator the fake does not implement loosens the filter rather than
      // silently excluding every document.
      return check ? check(actual, expected) : true;
    });
  });
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return String(value).split(",");
}

/** Apply a Payload sort string (`"-createdAt"` for descending). */
function sortDocs(docs: Doc[], sort: string): Doc[] {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;

  return [...docs].sort((a, b) => {
    const result = compare(fieldValue(a, field), fieldValue(b, field));
    return descending ? -result : result;
  });
}

/** A statement captured by `stubDrizzle`, with its bound parameters. */
export type CapturedQuery = { sql: string; params: unknown[] };

/**
 * Attach a drizzle stub to a fake payload, for routers that drop to raw SQL.
 *
 * Several hot paths deliberately bypass Payload (bulk analytics inserts,
 * GROUP BY aggregations, the atomic view counter), so the fake's collection
 * store never sees them. This records what was executed — so a test can assert
 * on the statement — and returns whichever rows the test supplies.
 *
 * `rows` may be a fixed array, or a function of the captured query when one
 * handler has to answer differently for different statements.
 */
export function stubDrizzle(
  payload: ReturnType<typeof createFakePayload>,
  rows: unknown[] | ((query: CapturedQuery) => unknown[]) = []
): { queries: CapturedQuery[] } {
  const queries: CapturedQuery[] = [];

  Object.assign(payload.db, {
    drizzle: {
      execute: (statement: { queryChunks?: unknown[] } | string) => {
        // Drizzle's tagged-template object exposes its chunks; stringify
        // whatever shape arrives so assertions can match on substrings.
        const text =
          typeof statement === "string" ? statement : JSON.stringify(statement);
        const query: CapturedQuery = { sql: text, params: [] };
        queries.push(query);

        return Promise.resolve({
          rows: typeof rows === "function" ? rows(query) : rows,
        });
      },
    },
  });

  return { queries };
}
