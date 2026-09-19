import type { PartnerContent } from "@news-spend-media/payload/types";
import type { Payload } from "payload";

import { withCache } from "../../lib/cache";
import { type AdItem, buildGoogleAd, buildInHouseAd } from "./content-builders";
import { fetchPartnerContent } from "./content-fetchers";

export type AdConfig = {
  inHouseAdProbability: number;
  googleAdSlot: string;
  placements: string[];
  /** How many partner content items to pre-fetch during init (default: 10) */
  poolSize?: number;
  /** TTL in seconds for the Redis partner content pool cache (default: 300 = 5 min) */
  poolCacheTtl?: number;
};

export type AdManagerOptions = {
  config: AdConfig;
};

/**
 * Default ad configuration for homepage
 */
export const DEFAULT_AD_CONFIG: AdConfig = {
  inHouseAdProbability: 0.65, // 65% chance for in-house ads
  googleAdSlot: "banner_1",
  placements: ["homepage-ads-banner"],
  poolSize: 10,
};

/**
 * Share of voice for one item, relative to the others in its pool.
 *
 * An unset or malformed weight reads as 1, the field's default, so content
 * that predates the field still competes normally rather than silently
 * dropping out. Only an explicit 0 withholds an item.
 */
function weightOf(item: PartnerContent): number {
  const weight = (item as { weight?: number | null }).weight;
  if (typeof weight !== "number" || !Number.isFinite(weight)) {
    return 1;
  }
  return Math.max(0, weight);
}

/**
 * Ad Manager class for handling ad decisioning logic.
 *
 * Pre-fetches a pool of partner content during initialization so that
 * subsequent pickAd() and getPartnerContent() calls are synchronous
 * and avoid N+1 database queries.
 */
export class AdManager {
  private readonly config: AdConfig;
  private pool: PartnerContent[] = [];
  /** Indices into `pool` with a non-zero weight, i.e. actually drawable. */
  private eligible: number[] = [];
  /** Indices already served this request; see `nextFromPool`. */
  private readonly drawn = new Set<number>();

  constructor(options: AdManagerOptions) {
    this.config = options.config;
  }

  /**
   * Initialize the ad manager by pre-fetching a pool of partner content.
   * Checks Redis cache first (5 min TTL), falls back to DB query.
   */
  async initialize(payload: Payload): Promise<void> {
    try {
      const placements = this.config.placements;
      const limit = this.config.poolSize ?? 10;
      const ttl = this.config.poolCacheTtl ?? 300; // 5 minutes
      const cacheKey = `partner-content:pool:${placements.sort().join(",")}`;

      const docs = await withCache<PartnerContent[]>(
        cacheKey,
        { ttl },
        async () => {
          const result = await fetchPartnerContent({
            payload,
            placements,
            limit,
          });
          return result.docs;
        }
      );

      // No shuffle: `nextFromPool` draws at random already, so ordering the
      // pool decides nothing. (The previous `sort(() => Math.random() - 0.5)`
      // was not a uniform shuffle either.)
      this.pool = [...docs];
      this.resetDraw();
    } catch {
      // If fetching fails, pool stays empty, and pickAd() will return Google ads
      this.pool = [];
      this.resetDraw();
    }
  }

  /**
   * Picks an ad based on configured probability.
   * Synchronous: draws from the pre-fetched pool.
   */
  pickAd(): AdItem {
    try {
      if (
        Math.random() < this.config.inHouseAdProbability &&
        this.pool.length > 0
      ) {
        const item = this.nextFromPool();
        if (item) {
          return buildInHouseAd(item);
        }
      }
      return buildGoogleAd(this.config.googleAdSlot);
    } catch {
      return buildGoogleAd(this.config.googleAdSlot);
    }
  }

  /**
   * Gets a partner content item from the pre-fetched pool.
   * Used by FeedComposer for reward tasks and related news sections.
   * Returns undefined if pool is exhausted.
   */
  getPartnerContent(): PartnerContent | undefined {
    return this.nextFromPool();
  }

  /**
   * Whether the pool has any partner content available.
   */
  get hasPartnerContent(): boolean {
    return this.eligible.length > 0;
  }

  /**
   * Creates a Google ad as fallback
   */
  createGoogleAd(): AdItem {
    return buildGoogleAd(this.config.googleAdSlot);
  }

  private resetDraw(): void {
    this.drawn.clear();
    this.eligible = this.pool
      .map((_, index) => index)
      .filter((index) => weightOf(this.pool[index] as PartnerContent) > 0);
  }

  /**
   * Draws the next item from the pool, weighted by share of voice.
   *
   * Weighted, but *without replacement* within a request, which is what makes
   * the weight mean anything. A feed page asks for fewer ads than the pool
   * holds, so which items make the cut is where share of voice is decided;
   * drawing with replacement would instead let one ad appear twice on a single
   * page, and drawing every item once per cycle — what the old round-robin did
   * — would make weight affect nothing but order.
   *
   * Once every eligible item has been served the set clears and the cycle
   * begins again, preserving the old behaviour that content can repeat across
   * slots rather than the feed running out of ads.
   */
  private nextFromPool(): PartnerContent | undefined {
    if (this.eligible.length === 0) {
      return;
    }
    if (this.drawn.size >= this.eligible.length) {
      this.drawn.clear();
    }

    const candidates = this.eligible.filter((index) => !this.drawn.has(index));
    if (candidates.length === 0) {
      return;
    }

    let total = 0;
    for (const index of candidates) {
      total += weightOf(this.pool[index] as PartnerContent);
    }

    let roll = Math.random() * total;
    for (const index of candidates) {
      roll -= weightOf(this.pool[index] as PartnerContent);
      if (roll <= 0) {
        this.drawn.add(index);
        return this.pool[index];
      }
    }

    // Floating-point remainder can leave the loop without a pick; the last
    // candidate is the one the roll landed in.
    const last = candidates.at(-1) as number;
    this.drawn.add(last);
    return this.pool[last];
  }
}

/**
 * Creates and initializes an AdManager instance.
 * Pre-fetches the partner content pool (single DB query).
 */
export async function createAdManager(
  payload: Payload,
  config: AdConfig = DEFAULT_AD_CONFIG
): Promise<AdManager> {
  const adManager = new AdManager({ config });
  await adManager.initialize(payload);
  return adManager;
}
