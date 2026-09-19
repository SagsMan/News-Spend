import { SQL } from "bun";
import type { BasePayload } from "payload";

/**
 * A real Payload instance, on a real Postgres, for the tests that need one.
 *
 * The unit tests elsewhere run against a hand-written `payload` stand-in with
 * four methods on it. That is fast and right for pure logic, but it has no
 * collection hooks, so code that depends on them is invisible to it. The
 * prize-pool lock and the draw engine had never met until a draw ran against a
 * real database, where the lock refused the engine's own write and no draw
 * could complete. These tests exist to close that gap.
 *
 * Schema comes from Drizzle's push, not from the migration files: the point is
 * to test the collections as currently configured, and push builds exactly
 * that. It is also why `NODE_ENV` must not be `production` here; see
 * `@payloadcms/db-postgres`'s connect, which swaps push for `prodMigrations`.
 */

/**
 * The one database these tests may touch.
 *
 * Deliberately a whole-name match rather than a suffix check. A typo that
 * resolved to the development database would have push rewrite its schema, and
 * the standing rule in this repo is that nothing automated touches it.
 */
const REQUIRED_DB_NAME = "newsspend_test";

/** The only Resend key these tests may run with. Rejected by Resend by design. */
const TEST_RESEND_KEY = "re_test_not_a_real_key";

/**
 * Refuse to continue if a live mail credential survived the stub.
 *
 * Deliberately called AFTER the Payload config has been imported, not straight
 * after `stubEnv`. Called there it would only re-read the assignment two lines
 * above and could never fail; the window worth checking is module
 * initialisation, where a transitive import can re-read `.env` (which is where
 * the live key lives) and undo the stub before anything sends.
 *
 * This is the third line of defence, not the first. The overwrite is what
 * prevents a send, the injected `reportSender` keeps tests off that path
 * entirely, and a bypass still fails loudly because Resend rejects the stub key
 * with a 401 (see `mailsafety.int.test.ts`, which asserts exactly that).
 */
function assertNoLiveMailKey(): void {
  const key = process.env.RESEND_API_KEY;

  if (key !== TEST_RESEND_KEY) {
    throw new Error(
      `Refusing to run: RESEND_API_KEY is "${key?.slice(0, 7) ?? "unset"}…", not the test key. ` +
        "Something re-read the environment during config import. A live key here " +
        "can mail the Winner Report to a real inbox; see test/README.md."
    );
  }
}

function connectionString(): string {
  const uri = process.env.TEST_DATABASE_URI;

  if (!uri) {
    throw new Error(
      "TEST_DATABASE_URI is not set. Point it at a local Postgres, e.g. " +
        `postgresql://postgres:postgres@localhost:5432/${REQUIRED_DB_NAME}`
    );
  }

  const name = new URL(uri).pathname.replace(/^\//, "");

  if (name !== REQUIRED_DB_NAME) {
    throw new Error(
      `Refusing to run: TEST_DATABASE_URI points at "${name}", not "${REQUIRED_DB_NAME}". ` +
        "These tests push a schema, which would rewrite whatever they are aimed at."
    );
  }

  return uri;
}

/** Create the test database if it is not there yet. */
async function ensureDatabase(uri: string): Promise<void> {
  const url = new URL(uri);
  const name = url.pathname.replace(/^\//, "");

  url.pathname = "/postgres";
  const admin = new SQL(url.toString());

  try {
    const existing = await admin`
      select 1 from pg_database where datname = ${name}`;

    if (existing.length === 0) {
      // Identifier, so it cannot be parameterised; safe because the name has
      // already been checked against the single permitted value above.
      await admin.unsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }
}

/**
 * Values the config reads at import time but that no test exercises.
 *
 * Every one of these is OVERWRITTEN, never defaulted. Bun loads `.env` from the
 * working directory before any of this runs, and `packages/payload/.env` holds
 * a live Resend key, so a `||=` here quietly leaves the real credential in
 * place. A completed draw sends the section 21 Winner Report to a real address, which
 * is exactly what happened the first time this file was written with `||=`.
 *
 * Nothing here reaches a network. A test that genuinely needs to assert on mail
 * should inject a sender rather than relax this.
 */
function stubEnv(uri: string): void {
  process.env.DATABASE_URI = uri;
  process.env.PAYLOAD_SECRET = "integration-test-secret";
  process.env.RESEND_API_KEY = TEST_RESEND_KEY;
  process.env.RESEND_DEFAULT_FROM_ADDRESS = "test@example.invalid";
  process.env.RESEND_DEFAULT_FROM_NAME = "Integration Test";
  /**
   * The Winner Report does not use Payload's email adapter at all; it goes
   * through `packages/mail`, whose from address is built from SMTP_USER_FROM
   * and defaults to a real newsspend.com address. Stubbed so no test process
   * ever holds the production sender, even though a rejected key already stops
   * the send.
   */
  process.env.SMTP_USER_FROM = "test@example.invalid";
  process.env.SFTP_HOST = "sftp.example.invalid";
  process.env.SFTP_USERNAME = "test";
  process.env.SFTP_PASSWORD = "test";

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NODE_ENV=production would run migrations instead of push, and these " +
        "tests rely on push to build the schema from the current collections."
    );
  }
}

let instance: BasePayload | null = null;

/**
 * Boot Payload once for the whole file and hand the same instance to every
 * test. Initialisation costs seconds, and nothing here needs a fresh one.
 */
export async function getTestPayload(): Promise<BasePayload> {
  if (instance) {
    return instance;
  }

  const uri = connectionString();
  await ensureDatabase(uri);
  stubEnv(uri);

  // Imported after the environment is set, because the config reads it as it
  // is constructed.
  const { getPayload } = await import("payload");
  const { default: config } = await import("../../src/payload.config");

  // Import is the one place the stub could be undone, so check it here.
  assertNoLiveMailKey();

  instance = await getPayload({ config });
  return instance;
}

export async function destroyTestPayload(): Promise<void> {
  if (!instance) {
    return;
  }
  await instance.db.destroy();
  instance = null;
}

/**
 * Empty every giveaway table between tests.
 *
 * Truncate rather than drop-and-push: pushing the schema again for each test
 * would dominate the runtime, and these tests only ever care that they start
 * from nothing.
 */
export async function resetGiveawayTables(payload: BasePayload): Promise<void> {
  const tables = [
    "giveaway_audit_log",
    "giveaway_draw_attempts",
    "giveaway_engagements",
    "giveaway_fulfilment_attempts",
    "giveaway_pool_snapshots",
    "giveaway_report_deliveries",
    "giveaway_streaks",
    "giveaway_tickets",
    "giveaway_winners",
    "giveaway_account_flags",
    "giveaway_prizes",
    "giveaways",
    "prize_catalogue",
    // The draw notifies its participants, so a test that counts them must not
    // inherit rows from the one before.
    "notifications",
  ];

  await payload.db.drizzle.execute(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}
