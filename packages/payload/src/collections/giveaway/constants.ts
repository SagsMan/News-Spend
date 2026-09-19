/**
 * Shared constants for the giveaway draw engine.
 *
 * Tier eligibility thresholds are platform business rules and are deliberately
 * NOT configurable by the giveaway administrator (spec 1, 7, 8, 11).
 */

/**
 * Admin sidebar grouping.
 *
 * The engine needs thirteen collections, but an administrator only ever
 * creates or edits five of them. The rest are written by the draw and
 * fulfilment code and read only when something needs explaining. Splitting the
 * two apart keeps the sidebar showing the giveaway you run, rather than
 * implying a pool snapshot is something you fill in by hand.
 */
export const ADMIN_GROUP = "Giveaway";

/** Machine-written collections: consulted during an investigation, not run. */
export const ADMIN_GROUP_RECORDS = "Giveaway records";

export const PRIZE_TIERS = ["tier1", "tier2", "tier3"] as const;
export type PrizeTier = (typeof PRIZE_TIERS)[number];

export const PRIZE_TIER_OPTIONS = [
  { label: "Tier 1 – High Tier Prizes", value: "tier1" },
  { label: "Tier 2 – Mid Tier Prizes", value: "tier2" },
  { label: "Tier 3 – Low Tier Prizes", value: "tier3" },
] as const;

/** Order in which tiers are processed during a draw (spec 12). */
export const TIER_PROCESSING_ORDER: readonly PrizeTier[] = [
  "tier1",
  "tier2",
  "tier3",
];

/**
 * Primary eligibility path: must all be satisfied within the active giveaway
 * period (spec 11).
 */
export const PRIMARY_ELIGIBILITY: Record<
  PrizeTier,
  { tickets: number; boosts: number; featuredOffers: number }
> = {
  tier1: { tickets: 10, boosts: 3, featuredOffers: 1 },
  tier2: { tickets: 4, boosts: 2, featuredOffers: 1 },
  tier3: { tickets: 1, boosts: 0, featuredOffers: 0 },
};

/**
 * Consecutive giveaway eligibility path: the per-giveaway bar that must be met
 * in each of `CONSECUTIVE_GIVEAWAYS_REQUIRED` giveaways in a row (spec 11).
 * Tier 3 has no consecutive path; one valid ticket already qualifies.
 */
export const CONSECUTIVE_ELIGIBILITY: Record<
  PrizeTier,
  { tickets: number; boosts: number; featuredOffers: number } | null
> = {
  tier1: { tickets: 3, boosts: 3, featuredOffers: 1 },
  tier2: { tickets: 2, boosts: 2, featuredOffers: 1 },
  tier3: null,
};

export const CONSECUTIVE_GIVEAWAYS_REQUIRED = 4;

/**
 * Fairness and anti-abuse rules (spec 22, and 20 rules 16–19).
 *
 * These are platform rules, not per-giveaway settings: the specification
 * states them unconditionally, so there is deliberately no toggle to disable
 * them. Use a dry run to see their effect without committing a draw.
 */

/** 22.1: a Tier 1 or Tier 2 win bars both tiers for this many draws. */
export const HIGH_TIER_COOLDOWN_DRAWS = 1;

/** 22.2: a Tier 1 win bars Tier 1 for this many subsequent draws. */
export const TIER1_COOLDOWN_DRAWS = 4;

/** 22.3: winning Tier 1 this many draws running triggers a suspension. */
export const MAX_CONSECUTIVE_TIER1_WINS = 2;

/** 22.3: length of that suspension, in draws. */
export const TIER1_SUSPENSION_DRAWS = 2;

/** 22.4: participating this many draws running with no prize earns a waiver. */
export const LOYALTY_WAIVER_AFTER_DRAWS = 4;

/**
 * How many previously completed giveaways the draw needs to look back over.
 *
 * Every rule above resolves within this window: the Tier 1 cooldown and the
 * loyalty waiver both reach four draws back, and the consecutive-win rules
 * reach less. A win older than this is simply out of cooldown, which is the
 * correct outcome, so there is no need to load more history.
 */
export const FAIRNESS_LOOKBACK_DRAWS = Math.max(
  TIER1_COOLDOWN_DRAWS,
  LOYALTY_WAIVER_AFTER_DRAWS,
  MAX_CONSECUTIVE_TIER1_WINS + TIER1_SUSPENSION_DRAWS
);

/** Account-level trust states used by 22.5–22.8. */
export const ACCOUNT_TRUST_STATUSES = [
  "ok",
  "suspicious",
  "disqualified",
] as const;
export type AccountTrustStatus = (typeof ACCOUNT_TRUST_STATUSES)[number];

export const ACCOUNT_TRUST_STATUS_OPTIONS = [
  { label: "OK", value: "ok" },
  { label: "Suspicious, winners held for review", value: "suspicious" },
  { label: "Disqualified, excluded from draws", value: "disqualified" },
] as const;

/** Ticket states. Only `valid` participates in the draw (spec 6). */
export const TICKET_STATUSES = [
  "valid",
  "cancelled",
  "refunded",
  "reversed",
  "unpaid",
  "fraudulent",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_OPTIONS = [
  { label: "Valid", value: "valid" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
  { label: "Reversed", value: "reversed" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Fraudulent", value: "fraudulent" },
] as const;

/**
 * The two engagement activities that contribute to Tier 1 and Tier 2
 * eligibility (spec 7, 8).
 *
 * Both are already real surfaces in the app, backed by `partner-content`:
 * a Boost is watching a Connect Brand advertisement (placements
 * `connect-brands-tab` / `connect-brand-video`), and a Featured Offer is an
 * item on the Lucky App Wall (placement `lucky-app-wall`). They share one
 * collection because they differ only in which surface produced them.
 */
export const ENGAGEMENT_TYPES = ["boost", "featured_offer"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const ENGAGEMENT_TYPE_OPTIONS = [
  { label: "Boost Your Luck", value: "boost" },
  { label: "Featured Offer", value: "featured_offer" },
] as const;

/**
 * Engagement completion states. Only `completed` counts towards tier
 * eligibility (spec 7, 8).
 */
export const COMPLETION_STATUSES = [
  "completed",
  "incomplete",
  "abandoned",
  "failed",
] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const COMPLETION_STATUS_OPTIONS = [
  { label: "Completed", value: "completed" },
  { label: "Incomplete", value: "incomplete" },
  { label: "Abandoned", value: "abandoned" },
  { label: "Failed", value: "failed" },
] as const;

/**
 * Giveaway lifecycle and draw-engine state machine (spec 19).
 *
 * The specification names ten statuses. `active` is an eleventh, added here
 * because 1 requires a countdown period (the window in which tickets are
 * sold) and the 19 list jumps straight from DRAFT to READY without naming
 * it. Everything else is the specification's list, in its order.
 *
 * These live in one field rather than two. A giveaway is only ever doing one
 * thing at a time, and splitting "lifecycle" from "draw state" would mean two
 * fields that must be kept consistent with each other by hand, the exact
 * failure 19 exists to prevent.
 */
export const GIVEAWAY_STATUSES = [
  "draft",
  "active",
  "ready",
  "pool_building",
  "pool_locked",
  "draw_in_progress",
  "interrupted",
  "resumption_authorized",
  "completed",
  "failed",
  "cancelled",
] as const;
export type GiveawayStatus = (typeof GIVEAWAY_STATUSES)[number];

export const GIVEAWAY_STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Active, countdown running", value: "active" },
  { label: "Ready, validated, awaiting draw", value: "ready" },
  { label: "Pool Building", value: "pool_building" },
  { label: "Pool Locked", value: "pool_locked" },
  { label: "Draw In Progress", value: "draw_in_progress" },
  { label: "Interrupted, awaiting authorization", value: "interrupted" },
  { label: "Resumption Authorized", value: "resumption_authorized" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

/**
 * Statuses in which giveaway configuration may no longer be edited (spec 5,
 * 16). Everything from the moment the first candidate pool is built onwards:
 * changing a percentage or a date after that point would make the draw already
 * in progress incoherent with its own configuration.
 */
export const LOCKED_GIVEAWAY_STATUSES: readonly GiveawayStatus[] = [
  "pool_building",
  "pool_locked",
  "draw_in_progress",
  "interrupted",
  "resumption_authorized",
  "completed",
];

/** A draw is part-way through and its records must be preserved (19). */
export const IN_FLIGHT_GIVEAWAY_STATUSES: readonly GiveawayStatus[] = [
  "ready",
  "pool_building",
  "pool_locked",
  "draw_in_progress",
];

/** Statuses from which an administrator may authorize a resumption (19). */
export const RESUMABLE_GIVEAWAY_STATUSES: readonly GiveawayStatus[] = [
  "interrupted",
  "failed",
];

/**
 * The thirteen material execution checkpoints of 19, in order.
 *
 * The engine saves state after each one, and a resumed draw continues from the
 * next incomplete checkpoint. Order matters: progress is monotonic, so a step
 * that has already been passed is skipped rather than repeated, which is what
 * makes every step idempotent.
 *
 * Two notes on the mapping. The specification lists pool generation and pool
 * lock once each, but this engine builds and locks a pool per tier, so those
 * checkpoints are reached at the first tier that runs and the remaining locks
 * are recorded in the audit log. And winner selection and prize allocation are
 * interleaved per winner: deliberately, so unit accounting stays exact when a
 * prize runs out mid-tier, so a tier's two checkpoints are both reached when
 * that tier finishes.
 */
export const DRAW_CHECKPOINTS = [
  "config_validated",
  "pool_generated",
  "pool_locked",
  "tier1_winners_selected",
  "tier1_prizes_allocated",
  "tier2_winners_selected",
  "tier2_prizes_allocated",
  "tier3_winners_selected",
  "tier3_prizes_allocated",
  "final_validation",
  "result_confirmed",
  "audit_completed",
  "winner_report_generated",
] as const;
export type DrawCheckpoint = (typeof DRAW_CHECKPOINTS)[number];

export const DRAW_CHECKPOINT_OPTIONS = DRAW_CHECKPOINTS.map((value, index) => ({
  label: `${index + 1}. ${value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")}`,
  value,
}));

/** Per-tier checkpoint names, so the tier loop does not build strings. */
export const TIER_CHECKPOINTS: Record<
  PrizeTier,
  { selected: DrawCheckpoint; allocated: DrawCheckpoint }
> = {
  tier1: {
    selected: "tier1_winners_selected",
    allocated: "tier1_prizes_allocated",
  },
  tier2: {
    selected: "tier2_winners_selected",
    allocated: "tier2_prizes_allocated",
  },
  tier3: {
    selected: "tier3_winners_selected",
    allocated: "tier3_prizes_allocated",
  },
};

/** Position of a checkpoint in the sequence; -1 when nothing has been reached. */
export function checkpointIndex(
  checkpoint: DrawCheckpoint | null | undefined
): number {
  if (!checkpoint) {
    return -1;
  }
  return DRAW_CHECKPOINTS.indexOf(checkpoint);
}

/** How an execution attempt ended (spec 19). */
export const DRAW_ATTEMPT_OUTCOMES = [
  "running",
  "completed",
  "interrupted",
  "failed",
] as const;
export type DrawAttemptOutcome = (typeof DRAW_ATTEMPT_OUTCOMES)[number];

export const DRAW_ATTEMPT_OUTCOME_OPTIONS = [
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Interrupted", value: "interrupted" },
  { label: "Failed", value: "failed" },
] as const;

/** Audit log event types (spec 17). */
export const AUDIT_EVENT_TYPES = [
  "ticket_purchase",
  "ticket_status_change",
  "boost_completion",
  "featured_offer_completion",
  "participants_snapshot",
  "candidate_pool_built",
  "candidate_pool_locked",
  "checkpoint_reached",
  "draw_interrupted",
  "resumption_authorized",
  "giveaway_cancelled",
  "winner_disqualified",
  "replacement_selected",
  "winner_held_ticket_invalid",
  "account_excluded",
  "fairness_exclusion",
  "loyalty_waiver_applied",
  "winner_held_for_review",
  "winner_selected",
  "prize_allocated",
  "prize_exhausted",
  "budget_limit_reached",
  "tier_completed",
  "draw_started",
  "draw_resumed",
  "draw_completed",
  "draw_error",
  "winner_report_sent",
  "claim_status_change",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_EVENT_TYPE_OPTIONS = AUDIT_EVENT_TYPES.map((value) => ({
  label: value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" "),
  value,
}));

export const WINNER_REPORT_RECIPIENT = "rewards@newsspend.com";

/**
 * How a prize actually reaches its winner.
 *
 * The claim flow branches entirely on this: points land instantly, airtime and
 * data go to a phone number, physical goods need an address, and experiences
 * are arranged by hand. Without it the app cannot tell a ₦500 airtime top-up
 * from a refrigerator, and both would have to ask for the same details.
 */
export const FULFILMENT_TYPES = [
  "points",
  "airtime",
  "data",
  "gift_card",
  "physical",
  "experience",
] as const;
export type FulfilmentType = (typeof FULFILMENT_TYPES)[number];

export const FULFILMENT_TYPE_OPTIONS = [
  { label: "Reward Points, credited instantly", value: "points" },
  { label: "Airtime, sent to a phone number", value: "airtime" },
  { label: "Data, sent to a phone number", value: "data" },
  { label: "Gift Card, code issued to the winner", value: "gift_card" },
  { label: "Physical Item, delivered to an address", value: "physical" },
  { label: "Experience / Voucher, arranged manually", value: "experience" },
] as const;

/**
 * The mobile networks a data prize must cover.
 *
 * A data bundle is provisioned by one network for that network's own SIMs, so
 * a data prize needs one row per network. At fulfilment the winner's real
 * network is detected from their phone number; a network with no row holds the
 * prize for manual review rather than sending a bundle that would not deliver.
 * That is why a data prize must cover all four rather than as many as the
 * administrator felt like entering — the gap only shows up as a stuck winner,
 * long after the prize was saved.
 */
export const RELOADLY_NETWORKS = ["mtn", "airtel", "glo", "t2"] as const;
export type ReloadlyNetwork = (typeof RELOADLY_NETWORKS)[number];

export const RELOADLY_NETWORK_OPTIONS = [
  { label: "MTN Nigeria", value: "mtn" },
  { label: "Airtel Nigeria", value: "airtel" },
  { label: "Glo Nigeria", value: "glo" },
  { label: "9mobile / T2 Nigeria", value: "t2" },
] as const;

/** Reloadly's DATA operator per network, not the airtime one. */
export const RELOADLY_NETWORK_OPERATORS: Record<ReloadlyNetwork, number> = {
  mtn: 345,
  airtel: 646,
  glo: 647,
  t2: 645,
};

/** Fulfilment types that need a phone number from the winner. */
export const PHONE_FULFILMENT_TYPES: readonly FulfilmentType[] = [
  "airtime",
  "data",
];

/** Fulfilment types that need a delivery address. */
export const ADDRESS_FULFILMENT_TYPES: readonly FulfilmentType[] = ["physical"];

/**
 * How long a winner has to claim (21, settled with the app owner).
 *
 * The window also closes the moment the next giveaway starts, whichever comes
 * first, a prize from a giveaway that is over cannot be claimed once its
 * successor is running. See `claimWindowClosed`.
 */
export const CLAIM_WINDOW_DAYS = 14;

/**
 * Minimum age to take part in a giveaway.
 *
 * A compliance requirement rather than a product setting: promotions with
 * prizes of real value are age-restricted in Nigeria and in every other
 * jurisdiction this could expand to, so it is deliberately not configurable
 * per giveaway.
 */
export const MINIMUM_PARTICIPANT_AGE = 18;

/**
 * Where the platform currently operates.
 *
 * Nigeria is the only market today, so this is the assumed country for anyone
 * who has not said otherwise. It is a named constant rather than an inline
 * "NG" so that the places making a country assumption are greppable on the
 * day a second market is added, expansion is a legal question per country
 * before it is a technical one.
 */
export const DEFAULT_GIVEAWAY_COUNTRY = "NG";

/**
 * Where a prize has got to on its way to the winner.
 *
 * `on_hold` and `awaiting_verification` both stop a dispatch, but they mean
 * opposite things and the app has to say different words for each: on_hold is
 * *we* are reviewing you (22.8) and there is nothing to do; awaiting
 * verification is *you* have a step left.
 */
export const FULFILMENT_STATUSES = [
  "pending",
  "awaiting_verification",
  "on_hold",
  "in_progress",
  "fulfilled",
  "cancelled",
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export const FULFILMENT_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  {
    label: "Awaiting Verification, the winner has a step left",
    value: "awaiting_verification",
  },
  { label: "On Hold, manual review", value: "on_hold" },
  { label: "In Progress", value: "in_progress" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
] as const;

/** Fulfilment states in which nothing is dispatched. */
export const BLOCKED_FULFILMENT_STATUSES: readonly FulfilmentStatus[] = [
  "awaiting_verification",
  "on_hold",
  "cancelled",
];
