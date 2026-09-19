/**
 * Find partner-content rows whose link URLs carry leading/trailing whitespace.
 *
 * Padded URLs pass CMS validation (`new URL` strips surrounding whitespace
 * before parsing) but crash the app's iOS WebView, which encodes the padding
 * to `%20...` and rejects it as "not a file URL" (NEWS-SPEND-MEDIA-DZ). New
 * saves are trimmed by the `urlField` hook; this cleans up rows saved before it.
 *
 * Usage, from apps/cms:
 *
 *   bun run src/scripts/trim-padded-urls.ts
 *       Report padded URLs. Touches nothing.
 *
 *   bun run src/scripts/trim-padded-urls.ts --write
 *       Trim and re-save the reported rows.
 *
 * TARGETING A DEPLOYED ENVIRONMENT
 *
 * Set DATABASE_URI to that environment and NODE_ENV=production:
 *
 *   DATABASE_URI=<prod uri> NODE_ENV=production \
 *     bun run src/scripts/trim-padded-urls.ts --write
 *
 * The NODE_ENV is not optional and the script refuses without it. Payload's
 * Postgres adapter pushes the schema whenever NODE_ENV is anything else, so a
 * local run pointed at production would rewrite that database's schema from
 * whatever happens to be checked out.
 */

import { getPayload } from "@news-spend-media/payload";

const WRITE = process.argv.includes("--write");

const LOCAL_DB_RE = /@(localhost|127\.0\.0\.1)[:/]/;

const LINK_FIELDS = ["website", "iosAppStore", "androidPlayStore"] as const;

type DirtyField = {
  docId: string | number;
  title: string;
  field: (typeof LINK_FIELDS)[number];
  raw: string;
  clean: string;
};

function assertSafeTarget(): void {
  const uri = process.env.DATABASE_URI ?? "";
  const isLocal = LOCAL_DB_RE.test(uri);

  if (!(isLocal || process.env.NODE_ENV === "production")) {
    throw new Error(
      "Refusing to run against a non-local database without NODE_ENV=production.\n" +
        "Payload pushes its schema in any other mode, which would rewrite the " +
        "target environment's schema from your working copy."
    );
  }
}

type DirtyDoc = {
  id: string | number;
  title: string;
  next: PartnerLinks;
};

type PartnerLinks = {
  website?: string | null;
  iosAppStore?: string | null;
  androidPlayStore?: string | null;
};

type ScannedDoc = {
  id: string | number;
  title?: unknown;
  links?: unknown;
};

type ScannedPage = {
  docs: ScannedDoc[];
  hasNextPage: boolean;
  nextPage?: number | null;
};

async function collectDirty(
  find: (page: number) => Promise<ScannedPage>
): Promise<DirtyField[]> {
  const dirty: DirtyField[] = [];
  let page = 1;

  for (;;) {
    const res = await find(page);
    for (const doc of res.docs) {
      const links = doc.links;
      if (!links || typeof links !== "object") {
        continue;
      }
      const record = links as Record<string, unknown>;
      for (const field of LINK_FIELDS) {
        const raw = record[field];
        if (typeof raw === "string" && raw !== raw.trim()) {
          dirty.push({
            docId: doc.id,
            title: String(doc.title ?? ""),
            field,
            raw,
            clean: raw.trim(),
          });
        }
      }
    }

    if (!res.hasNextPage) {
      return dirty;
    }
    page = res.nextPage ?? page + 1;
  }
}

async function applyFixes(
  dirty: DirtyField[],
  read: (id: string | number) => Promise<PartnerLinks>,
  save: (id: string | number, links: PartnerLinks) => Promise<void>
): Promise<void> {
  const byDoc = new Map<string | number, DirtyDoc>();
  for (const d of dirty) {
    const entry = byDoc.get(d.docId) ?? {
      id: d.docId,
      title: d.title,
      next: {},
    };
    entry.next[d.field] = d.clean;
    byDoc.set(d.docId, entry);
  }

  for (const { id, next } of byDoc.values()) {
    const current = await read(id);
    await save(id, { ...current, ...next });
    console.log(`Updated [${String(id)}]`);
  }
}

async function main() {
  assertSafeTarget();

  const payload = await getPayload();
  console.log(WRITE ? "\nWRITE\n" : "\nDRY RUN: nothing will be changed\n");

  const dirty = await collectDirty(async (page) => {
    const res = await payload.find({
      collection: "partner-content",
      depth: 0,
      limit: 100,
      page,
    });
    return {
      docs: res.docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        links: doc.links as unknown,
      })),
      hasNextPage: res.hasNextPage,
      nextPage: res.nextPage,
    };
  });

  if (dirty.length === 0) {
    console.log("No padded URLs found in partner-content links.");
    return;
  }

  for (const d of dirty) {
    console.log(
      `- [${String(d.docId)}] ${d.title} links.${d.field}: ${JSON.stringify(d.raw)} -> ${JSON.stringify(d.clean)}`
    );
  }

  if (!WRITE) {
    console.log(
      `\n${String(dirty.length)} padded value(s). Re-run with --write to trim and re-save.`
    );
    return;
  }

  await applyFixes(
    dirty,
    async (id) => {
      const current = await payload.findByID({
        collection: "partner-content",
        id,
        depth: 0,
      });
      return (current.links ?? {}) as PartnerLinks;
    },
    (id, links) =>
      payload
        .update({ collection: "partner-content", id, data: { links } })
        .then(() => undefined)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
