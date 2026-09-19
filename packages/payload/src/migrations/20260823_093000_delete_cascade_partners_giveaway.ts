import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Finishes the delete-cascade work begun in
 * 20260821_010000_reapply_cascade_fixes and continued in
 * 20260823_090000_delete_cascade_notifications.
 *
 * Same shape throughout: the column is `required: true` in the collection
 * config so Postgres has it NOT NULL, but Payload created the foreign key
 * ON DELETE SET NULL. Postgres cannot SET NULL on a NOT NULL column, so
 * deleting the parent aborts the whole transaction.
 *
 * A pg_constraint scan found 34 foreign keys with this shape. Five go with the
 * lottery tables, seven were fixed in the previous migration, and these are
 * the remaining 22. After this there are none left.
 *
 * Most of them belong to the giveaway engine, which is the live draw, and they
 * are why two ordinary operations fail today:
 *
 *   deleting a user      fails for anyone holding a giveaway ticket, an
 *                        engagement, a streak or an account flag. None of
 *                        those are in the Users pre-delete hook, so account
 *                        deletion — a user-facing feature — is broken for most
 *                        active users rather than for an edge case.
 *   deleting a giveaway  fails on eight child tables: audit log, draw
 *                        attempts, engagements, pool snapshots, prizes,
 *                        report deliveries, tickets and winners.
 *
 * And for partners, deleting one now removes their partner_content, their
 * partner_conversions and their shop_analytics; deleting the content removes
 * its conversions too, so a partner delete cascades two levels.
 *
 * Two exceptions get NO ACTION rather than cascade: giveaway_prizes.prize_id
 * and giveaway_winners.prize_id. prize_catalogue is reference data while
 * prizes and winners are historical fact, so cascading would let a catalogue
 * tidy-up erase who won what — reference data destroying history is the wrong
 * direction. NO ACTION keeps the history and refuses the delete with a plain
 * foreign-key error ("still referenced from table giveaway_winners") instead
 * of today's confusing NOT NULL one. Deleting a prize that has been awarded
 * is meant to be refused; the point of the change is that it now fails
 * legibly rather than aborting the transaction.
 *
 * Every other foreign key here cascades, so this is the only place where a
 * delete is still blocked by design.
 *
 * giveaway_winners and partner_conversions are both empty in production today,
 * so applying this now settles the behaviour before there is history to lose.
 *
 * Statements were generated from the live schema and are idempotent (DROP
 * CONSTRAINT IF EXISTS then ADD), matching the earlier migrations.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "activities"
      DROP CONSTRAINT IF EXISTS "activities_user_id_users_id_fk",
      ADD CONSTRAINT "activities_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_account_flags"
      DROP CONSTRAINT IF EXISTS "giveaway_account_flags_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_account_flags_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_audit_log"
      DROP CONSTRAINT IF EXISTS "giveaway_audit_log_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_audit_log_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_draw_attempts"
      DROP CONSTRAINT IF EXISTS "giveaway_draw_attempts_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_draw_attempts_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_engagements"
      DROP CONSTRAINT IF EXISTS "giveaway_engagements_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_engagements_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_engagements"
      DROP CONSTRAINT IF EXISTS "giveaway_engagements_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_engagements_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_fulfilment_attempts"
      DROP CONSTRAINT IF EXISTS "giveaway_fulfilment_attempts_winner_id_giveaway_winners_id_fk",
      ADD CONSTRAINT "giveaway_fulfilment_attempts_winner_id_giveaway_winners_id_fk"
      FOREIGN KEY ("winner_id") REFERENCES "public"."giveaway_winners"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_pool_snapshots"
      DROP CONSTRAINT IF EXISTS "giveaway_pool_snapshots_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_pool_snapshots_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_prizes"
      DROP CONSTRAINT IF EXISTS "giveaway_prizes_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_prizes_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    -- NO ACTION, not cascade: see the note above about reference data.
    ALTER TABLE "giveaway_prizes"
      DROP CONSTRAINT IF EXISTS "giveaway_prizes_prize_id_prize_catalogue_id_fk",
      ADD CONSTRAINT "giveaway_prizes_prize_id_prize_catalogue_id_fk"
      FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id")
      ON DELETE no action ON UPDATE no action;

    ALTER TABLE "giveaway_report_deliveries"
      DROP CONSTRAINT IF EXISTS "giveaway_report_deliveries_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_report_deliveries_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_streaks"
      DROP CONSTRAINT IF EXISTS "giveaway_streaks_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_streaks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_tickets"
      DROP CONSTRAINT IF EXISTS "giveaway_tickets_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_tickets_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_tickets"
      DROP CONSTRAINT IF EXISTS "giveaway_tickets_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_winners_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE cascade ON UPDATE no action;

    -- NO ACTION, not cascade: see the note above about reference data.
    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_prize_id_prize_catalogue_id_fk",
      ADD CONSTRAINT "giveaway_winners_prize_id_prize_catalogue_id_fk"
      FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id")
      ON DELETE no action ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_winners_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_winning_ticket_id_giveaway_tickets_id_fk",
      ADD CONSTRAINT "giveaway_winners_winning_ticket_id_giveaway_tickets_id_fk"
      FOREIGN KEY ("winning_ticket_id") REFERENCES "public"."giveaway_tickets"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "partner_content"
      DROP CONSTRAINT IF EXISTS "partner_content_partner_id_partners_id_fk",
      ADD CONSTRAINT "partner_content_partner_id_partners_id_fk"
      FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_content_id_partner_content_id_fk",
      ADD CONSTRAINT "partner_conversions_content_id_partner_content_id_fk"
      FOREIGN KEY ("content_id") REFERENCES "public"."partner_content"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_partner_id_partners_id_fk",
      ADD CONSTRAINT "partner_conversions_partner_id_partners_id_fk"
      FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "shop_analytics"
      DROP CONSTRAINT IF EXISTS "shop_analytics_store_id_partners_id_fk",
      ADD CONSTRAINT "shop_analytics_store_id_partners_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."partners"("id")
      ON DELETE cascade ON UPDATE no action;
  `);
}

/**
 * Restores ON DELETE SET NULL, i.e. puts the failures back. Present for
 * symmetry with the migration runner; there is no reason to run it.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "activities"
      DROP CONSTRAINT IF EXISTS "activities_user_id_users_id_fk",
      ADD CONSTRAINT "activities_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_account_flags"
      DROP CONSTRAINT IF EXISTS "giveaway_account_flags_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_account_flags_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_audit_log"
      DROP CONSTRAINT IF EXISTS "giveaway_audit_log_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_audit_log_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_draw_attempts"
      DROP CONSTRAINT IF EXISTS "giveaway_draw_attempts_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_draw_attempts_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_engagements"
      DROP CONSTRAINT IF EXISTS "giveaway_engagements_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_engagements_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_engagements"
      DROP CONSTRAINT IF EXISTS "giveaway_engagements_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_engagements_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_fulfilment_attempts"
      DROP CONSTRAINT IF EXISTS "giveaway_fulfilment_attempts_winner_id_giveaway_winners_id_fk",
      ADD CONSTRAINT "giveaway_fulfilment_attempts_winner_id_giveaway_winners_id_fk"
      FOREIGN KEY ("winner_id") REFERENCES "public"."giveaway_winners"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_pool_snapshots"
      DROP CONSTRAINT IF EXISTS "giveaway_pool_snapshots_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_pool_snapshots_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_prizes"
      DROP CONSTRAINT IF EXISTS "giveaway_prizes_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_prizes_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_prizes"
      DROP CONSTRAINT IF EXISTS "giveaway_prizes_prize_id_prize_catalogue_id_fk",
      ADD CONSTRAINT "giveaway_prizes_prize_id_prize_catalogue_id_fk"
      FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_report_deliveries"
      DROP CONSTRAINT IF EXISTS "giveaway_report_deliveries_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_report_deliveries_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_streaks"
      DROP CONSTRAINT IF EXISTS "giveaway_streaks_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_streaks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_tickets"
      DROP CONSTRAINT IF EXISTS "giveaway_tickets_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_tickets_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_tickets"
      DROP CONSTRAINT IF EXISTS "giveaway_tickets_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_giveaway_id_giveaways_id_fk",
      ADD CONSTRAINT "giveaway_winners_giveaway_id_giveaways_id_fk"
      FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_prize_id_prize_catalogue_id_fk",
      ADD CONSTRAINT "giveaway_winners_prize_id_prize_catalogue_id_fk"
      FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_user_id_users_id_fk",
      ADD CONSTRAINT "giveaway_winners_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "giveaway_winners"
      DROP CONSTRAINT IF EXISTS "giveaway_winners_winning_ticket_id_giveaway_tickets_id_fk",
      ADD CONSTRAINT "giveaway_winners_winning_ticket_id_giveaway_tickets_id_fk"
      FOREIGN KEY ("winning_ticket_id") REFERENCES "public"."giveaway_tickets"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "partner_content"
      DROP CONSTRAINT IF EXISTS "partner_content_partner_id_partners_id_fk",
      ADD CONSTRAINT "partner_content_partner_id_partners_id_fk"
      FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_content_id_partner_content_id_fk",
      ADD CONSTRAINT "partner_conversions_content_id_partner_content_id_fk"
      FOREIGN KEY ("content_id") REFERENCES "public"."partner_content"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_partner_id_partners_id_fk",
      ADD CONSTRAINT "partner_conversions_partner_id_partners_id_fk"
      FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "shop_analytics"
      DROP CONSTRAINT IF EXISTS "shop_analytics_store_id_partners_id_fk",
      ADD CONSTRAINT "shop_analytics_store_id_partners_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."partners"("id")
      ON DELETE set null ON UPDATE no action;
  `);
}
