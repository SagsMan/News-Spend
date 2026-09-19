# Integration tests

These run against a **real Payload instance on a real Postgres**, so collection
hooks, field validation and the engine all execute together.

```bash
bun run --filter @news-spend-media/payload test:integration
```

They are deliberately not part of `bun test` / `turbo test`. Booting Payload and
pushing the schema costs ~15 seconds, which does not belong in a pre-commit
hook. The fast unit tests in `packages/api/test` stay where they are.

## Why they exist

The unit tests run against a hand-written `payload` stand-in: an object with
`find`, `findByID`, `create` and `update` on it. That is the right tool for pure
logic and it is fast, but it has **no collection hooks**, so anything that
depends on them is invisible to it.

That gap shipped a real bug. The section 5 prize-pool lock refuses writes to
`giveaway-prizes` while a giveaway sits in a locked status, and the draw engine
writes `unitsAwarded` to that collection *while the giveaway is
`draw_in_progress`*. The lock stopped the engine one write after the first
winner, so no draw could ever complete. 633 unit tests passed throughout,
because the fake payload never ran the hook.

`giveawayDraw.int.test.ts` fails with that exact error if the fix is reverted.

## Database

`TEST_DATABASE_URI` must name a database called exactly `newsspend_test`. The
helper refuses anything else and creates it if missing.

The check is a whole-name match, not a suffix: these tests let Drizzle **push**
the schema, which rewrites whatever it is aimed at. Pointed at `newsspend`, it
would rewrite the development database, which nothing automated in this repo is
allowed to touch.

For the same reason `NODE_ENV` must not be `production`: that swaps push for
`prodMigrations` (see `@payloadcms/db-postgres`'s `connect`), and the point here
is to test the collections exactly as they are configured right now.

## Credentials

`testPayload.ts` **overwrites** every credential the config reads, it does not
default them. Bun loads `.env` from the working directory before any test code
runs, and `packages/payload/.env` holds a live Resend key. An earlier version of
this helper used `||=`, left the real key in place, and sent three section 21 Winner
Reports to `rewards@newsspend.com` from a test run.

The Winner Report does **not** go through Payload's email adapter. It uses
`packages/mail` directly, whose from address comes from `SMTP_USER_FROM` and
whose key is read lazily from `RESEND_API_KEY` on first send. Both are stubbed.

Three things stop a test mailing a real inbox, in order of how much they matter:

1. **The overwrite.** `RESEND_API_KEY` and `SMTP_USER_FROM` are replaced, not
   defaulted. This is what actually prevents a send.
2. **The injected sender.** Draws pass a no-op `reportSender` to
   `GiveawayEngine`, so tests never reach the send path at all.
3. **A loud failure if both are bypassed.** Resend rejects the stub key with a
   401 and `sendGiveawayWinnerReport` throws rather than swallowing it.
   `mailsafety.int.test.ts` asserts this, so the last line of defence is itself
   tested.

`assertNoLiveMailKey` runs *after* the config import, which is the only point
where a transitive `.env` re-read could undo the stub. It is deliberately not
called straight after `stubEnv`: there it would only re-read the assignment
above it and could never fail. It is a narrow check, not the main protection.
