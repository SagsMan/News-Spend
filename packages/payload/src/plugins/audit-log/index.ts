import type {
  BasePayload,
  CollectionAfterLoginHook,
  CollectionAfterLogoutHook,
  CollectionAfterOperationHook,
  CollectionConfig,
  GlobalAfterChangeHook,
  GlobalConfig,
  Plugin,
} from "payload";
import { deepMerge } from "payload";

import { cleanupAuditLogsTask } from "./cleanup";

type CrudOperation = "create" | "read" | "update" | "delete";
type AuthOperation = "login" | "logout";
type AuditOperation = CrudOperation | AuthOperation;

type AuditTarget = {
  operations: CrudOperation[];
  /**
   * When set, an update operation is skipped if the ONLY changed fields
   * are in this list. This prevents counter increments (views, read caps,
   * comment totals) from generating audit-log noise.
   */
  ignoreFields?: string[];
};

// Collections to audit and which operations to track
const AUDIT_TARGETS: Record<string, AuditTarget> = {
  // Content: editorial accountability
  news: {
    operations: ["create", "update", "delete"],
    ignoreFields: ["views", "totalComments"],
  },
  comments: { operations: ["create", "update", "delete"] },
  categories: { operations: ["create", "update", "delete"] },
  media: { operations: ["create", "update", "delete"] },
  "partner-content": { operations: ["create", "update", "delete"] },
  contentReports: { operations: ["create", "update", "delete"] },

  // Admin: privilege & role tracking
  admins: { operations: ["create", "update", "delete"] },

  // Compliance: KYC, giveaway, financial
};

// Globals are singletons, so only "update" is meaningful
const GLOBAL_AUDIT_TARGETS: string[] = ["news-category"];

const ADMIN_COLLECTION = "admins";
const USER_COLLECTION = "users";

// Fields to strip from logged data (sensitive / noisy)
const OMIT_FIELDS = new Set([
  "password",
  "salt",
  "hash",
  "tokens",
  "updatedAt",
  "__v",
]);

const MAX_VALUE_CHARS = 1024;

function truncateValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  const serialized = JSON.stringify(value);
  if (serialized && serialized.length > MAX_VALUE_CHARS) {
    return `[truncated: ${serialized.length} chars]`;
  }
  return value;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function sanitize(data: unknown): Record<string, unknown> | unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([key]) => !OMIT_FIELDS.has(key))
      .map(([key, value]) => [key, truncateValue(value)])
  );
}

/**
 * Compute a shallow diff between two objects.
 * Returns only the keys whose values changed, with { from, to } pairs.
 * Returns null if nothing changed (so we can fall back to snapshot).
 */
function diff(
  original: Record<string, unknown>,
  updated: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(updated)]);

  for (const key of keys) {
    if (OMIT_FIELDS.has(key)) {
      continue;
    }
    if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
      changes[key] = {
        from: truncateValue(original[key]),
        to: truncateValue(updated[key]),
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

function extractIp(req: unknown): string | undefined {
  if (!req || typeof req !== "object") {
    return;
  }

  const r = req as Record<string, unknown>;
  const headers = r.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const socket = r.socket as Record<string, unknown> | undefined;

  const forwardedFor = headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (typeof raw === "string") {
      return raw.split(",")[0]?.trim();
    }
  }

  if (typeof headers?.["x-real-ip"] === "string") {
    return headers["x-real-ip"];
  }
  if (socket && typeof socket.remoteAddress === "string") {
    return socket.remoteAddress;
  }
}

/**
 * Resolve the actor from a request into the polymorphic relationship format
 * that Payload's Drizzle adapter expects: `{ relationTo, value }`.
 *
 * Admins come from the CMS panel; users come from the app via oRPC.
 * Returns `null` when no authenticated user is present.
 */
function resolveActor(req: unknown): {
  performedBy: { relationTo: string; value: string | number } | null;
} {
  if (!req || typeof req !== "object") {
    return { performedBy: null };
  }

  const user = (req as Record<string, unknown>).user as
    | Record<string, unknown>
    | null
    | undefined;
  if (!user?.id) {
    return { performedBy: null };
  }

  const collection = (user.collection as string) ?? USER_COLLECTION;
  const relationTo =
    collection === USER_COLLECTION ? USER_COLLECTION : ADMIN_COLLECTION;

  return { performedBy: { relationTo, value: user.id as string | number } };
}

// -------------------------------------------------------------------
// Audit logs collection
// -------------------------------------------------------------------

const auditLogsCollection: CollectionConfig = {
  slug: "audit-logs",
  labels: { singular: "Audit Log", plural: "Audit Logs" },
  admin: {
    hidden: false,
    useAsTitle: "operation",
    defaultColumns: [
      "collection",
      "operation",
      "documentId",
      "performedBy",
      "createdAt",
    ],
    group: "System",
  },
  access: {
    create: () => process.env.NODE_ENV === "development",
    update: () => process.env.NODE_ENV === "development",
    delete: () => process.env.NODE_ENV === "development",
    read: ({ req }) => req.user?.collection === ADMIN_COLLECTION,
  },
  timestamps: true,
  fields: [
    {
      name: "collection",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "documentId",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "operation",
      type: "select",
      required: true,
      index: true,
      options: ["create", "read", "update", "delete", "login", "logout"],
    },
    {
      // Polymorphic: could be a CMS admin or an app user
      name: "performedBy",
      type: "relationship",
      index: true,
      relationTo: [ADMIN_COLLECTION, USER_COLLECTION],
    },
    {
      name: "diff",
      type: "json",
      admin: {
        description:
          "Changed fields only: { field: { from, to } }. Present on updates when originalDoc is available.",
      },
    },
    {
      name: "snapshot",
      type: "json",
      admin: {
        description:
          "Full sanitized document. Present on create, and on update when originalDoc is unavailable (e.g. bulk ops).",
      },
    },
    {
      name: "ip",
      type: "text",
    },
  ],
};

// -------------------------------------------------------------------
// Log writer
// -------------------------------------------------------------------

type LogEntry = {
  collection: string;
  documentId: string;
  operation: AuditOperation;
  performedBy: { relationTo: string; value: string | number } | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
  snapshot?: unknown;
  ip?: string;
};

async function writeLog(payload: BasePayload, entry: LogEntry): Promise<void> {
  try {
    await payload.db.create({
      collection: "audit-logs",
      data: entry,
    });
  } catch (err) {
    payload.logger?.error?.(
      {
        err,
        collection: entry.collection,
        documentId: entry.documentId,
        operation: entry.operation,
      },
      "[audit-log] Failed to write log"
    );
  }
}

// -------------------------------------------------------------------
// Plugin
// -------------------------------------------------------------------

export const auditLogPlugin: Plugin = (incomingConfig) => {
  const config = { ...incomingConfig };

  // Register cleanup task (guard against missing export)
  if (cleanupAuditLogsTask) {
    config.jobs = {
      ...config.jobs,
      tasks: [...(config.jobs?.tasks ?? []), cleanupAuditLogsTask],
    };
  }

  // --- Collection hooks ---
  const patchedCollections = (config.collections ?? []).map((collection) => {
    const target = AUDIT_TARGETS[collection.slug];
    if (!target) {
      return collection;
    }
    const { operations: ops, ignoreFields } = target;

    const hook: CollectionAfterOperationHook = async ({
      operation,
      result,
      args,
      req,
    }) => {
      // Payload uses different operation names for single vs bulk operations
      // (updateByID vs update, deleteByID vs delete). Normalize to the names
      // used in AUDIT_TARGETS so the check works for both paths.
      const normalized =
        operation === "updateByID"
          ? "update"
          : operation === "deleteByID"
            ? "delete"
            : operation;
      if (!ops.includes(normalized as CrudOperation)) {
        return result;
      }

      const { performedBy } = resolveActor(req);
      const ip = extractIp(req);
      const op = normalized as LogEntry["operation"];

      const resultObj = result as Record<string, unknown> | null;
      const bulkDocs = resultObj?.docs as Record<string, unknown>[] | undefined;

      if (bulkDocs) {
        // Bulk operations: no per-doc originalDoc available, always snapshot
        for (const doc of bulkDocs) {
          if (doc?.id === undefined) {
            continue;
          }
          await writeLog(req.payload, {
            collection: collection.slug,
            documentId: String(doc.id),
            operation: op,
            performedBy,
            snapshot: op === "delete" ? undefined : sanitize(doc),
            ip,
          });
        }
      } else {
        const documentId =
          (result as { id?: unknown } | null)?.id ??
          (args as { id?: unknown } | null)?.id ??
          "unknown";

        const originalDoc = (
          args as { originalDoc?: Record<string, unknown> } | null
        )?.originalDoc;

        const logEntry: LogEntry = {
          collection: collection.slug,
          documentId: String(documentId),
          operation: op,
          performedBy,
          ip,
        };

        if (op === "create") {
          logEntry.snapshot = sanitize(result as Record<string, unknown>);
        } else if (op === "update") {
          if (originalDoc) {
            const changes = diff(
              sanitize(originalDoc) as Record<string, unknown>,
              sanitize(result as Record<string, unknown>) as Record<
                string,
                unknown
              >
            );

            const skipAudit =
              changes === null ||
              (ignoreFields?.length
                ? Object.keys(changes).every((key) =>
                    ignoreFields.includes(key)
                  )
                : false);

            if (skipAudit) {
              return result;
            }

            logEntry.diff = changes;
          } else {
            logEntry.snapshot = sanitize(result as Record<string, unknown>);
          }
        }

        await writeLog(req.payload, logEntry);
      }

      return result;
    };

    let patchedCollection: CollectionConfig = {
      ...collection,
      hooks: {
        ...collection.hooks,
        afterOperation: [...(collection.hooks?.afterOperation ?? []), hook],
      },
    };

    // Inject auth hooks for the admin collection so login/logout events
    // are recorded alongside CRUD operations.
    if (collection.slug === ADMIN_COLLECTION) {
      const existingAuth =
        typeof collection.auth === "object" && collection.auth
          ? collection.auth
          : {};

      const afterLoginHook: CollectionAfterLoginHook = async ({
        req,
        user,
      }) => {
        const ip = extractIp(req);
        await writeLog(req.payload, {
          collection: ADMIN_COLLECTION,
          documentId: String(user.id),
          operation: "login",
          performedBy: { relationTo: ADMIN_COLLECTION, value: String(user.id) },
          ip,
        });
      };

      const afterLogoutHook: CollectionAfterLogoutHook = async ({ req }) => {
        const { performedBy } = resolveActor(req);
        const ip = extractIp(req);
        await writeLog(req.payload, {
          collection: ADMIN_COLLECTION,
          documentId: String(performedBy?.value ?? "unknown"),
          operation: "logout",
          performedBy,
          ip,
        });
      };

      patchedCollection = {
        ...patchedCollection,
        auth: deepMerge(existingAuth, {
          afterLogin: [
            ...(((existingAuth as Record<string, unknown>)
              .afterLogin as CollectionAfterLoginHook[]) ?? []),
            afterLoginHook,
          ],
          afterLogout: [
            ...(((existingAuth as Record<string, unknown>)
              .afterLogout as CollectionAfterLogoutHook[]) ?? []),
            afterLogoutHook,
          ],
        }),
      } as CollectionConfig;
    }

    return patchedCollection;
  });

  // --- Global hooks ---
  const patchedGlobals = (config.globals ?? []).map((global) => {
    const g = global as GlobalConfig;
    if (!GLOBAL_AUDIT_TARGETS.includes(g.slug)) {
      return g;
    }

    const hook: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
      const { performedBy } = resolveActor(req);
      const ip = extractIp(req);

      // Globals always have previousDoc, so diff is always possible here
      const changes =
        previousDoc && doc
          ? diff(
              sanitize(previousDoc) as Record<string, unknown>,
              sanitize(doc) as Record<string, unknown>
            )
          : undefined;

      await writeLog(req.payload, {
        collection: g.slug,
        documentId: g.slug,
        operation: "update",
        performedBy,
        // Fall back to snapshot if diff is empty (first-ever save)
        diff: changes ?? undefined,
        snapshot: changes ? undefined : sanitize(doc),
        ip,
      });

      return doc;
    };

    return {
      ...g,
      hooks: {
        ...g.hooks,
        afterChange: [...(g.hooks?.afterChange ?? []), hook],
      },
    } as GlobalConfig;
  });

  return {
    ...config,
    collections: [...patchedCollections, auditLogsCollection],
    globals: patchedGlobals,
  };
};
