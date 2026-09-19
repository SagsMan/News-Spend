# News Router Utilities

This directory contains the refactored news router with utilities extracted for better maintainability, testability, and reusability.

## Overview

The news router has been refactored to separate concerns into focused utility modules:

- **Content Fetchers** - Data fetching logic
- **Content Builders** - Content item construction
- **Ad Manager** - Ad decisioning and management
- **Feed Composer** - Feed composition with injection rules

## File Structure

```
news/
├── index.ts              # Main router with handlers
├── content-fetchers.ts   # Data fetching utilities
├── content-builders.ts   # Content item builders
├── ad-manager.ts         # Ad decisioning logic
├── feed-composer.ts      # Feed composition engine
└── README.md            # This file
```

## Content Fetchers (`content-fetchers.ts`)

Handles all data fetching operations with consistent interfaces.

### Key Functions

- `fetchMainNews(params)` - Fetches filtered news items
- `fetchRelatedNews(params)` - Fetches random related news
- `fetchPromotionMedia(params)` - Fetches random promotion media
- `fetchPartnerContent(params)` - Fetches partner content by placement
- `fetchRandomPartnerContent(payload, placements)` - Quick random partner content fetch

### Example Usage

```typescript
const news = await fetchMainNews({
  payload,
  type: "article",
  category: "tech",
  limit: 10,
  page: 1,
});

const related = await fetchRelatedNews({
  payload,
  limit: 3,
});
```

## Content Builders (`content-builders.ts`)

Creates standardized content items for the feed with consistent structure and IDs.

### Key Functions

- `buildRelatedNews(docs, taskItem?)` - Creates related news section
- `buildPromotionMedia(promo)` - Creates promotion media item
- `buildRewardTask(task)` - Creates reward task item
- `buildGoogleAd(slot)` - Creates Google ad item
- `buildInHouseAd(content)` - Creates in-house ad item

### Example Usage

```typescript
const relatedSection = buildRelatedNews(newsDocs, optionalTask);
const promoItem = buildPromotionMedia(promoData);
const adItem = buildGoogleAd("banner_1");
```

## Ad Manager (`ad-manager.ts`)

Handles ad decisioning logic with configurable probability and fallback mechanisms.

### Key Features

- Configurable in-house vs Google ad probability
- Automatic fallback to Google ads on errors
- Partner content counting and random selection
- Reusable across different endpoints

### Configuration

```typescript
const adConfig = {
  inHouseAdProbability: 0.65, // 65% in-house, 35% Google
  googleAdSlot: "banner_1",
  placements: ["homepage_ads_banner"],
};
```

### Usage

```typescript
// Create and initialize manager
const adManager = await createAdManager(payload, adConfig);

// Pick ads
const ad = await adManager.pickAd();

// Or use utility function
const quickAd = await pickRandomAd(payload, adConfig);
```

## Feed Composer (`feed-composer.ts`)

Advanced feed composition engine with configurable injection rules and priorities.

### Features

- Rule-based content injection
- Priority-based processing
- Frequency and probability controls
- Position-based injection (inline vs end)
- Error handling and fallbacks

### Feed Rules

```typescript
const rule = {
  type: "ad", // Content type to inject
  frequency: 3, // Every 3rd item
  probability: 1.0, // 100% chance
  priority: 1, // Highest priority
  position: "inline", // Inject inline with content
};
```

### Usage

```typescript
// Full feed composition
const feedData = {
  mainNews: newsDocs,
  relatedNews: relatedDocs,
  promotionMedia: promoDocs,
};

const composedFeed = await composeFeed(payload, adManager, feedData);

// Simple ad injection only
const simpleFeeds = await composeSimpleFeed(newsDocs, adManager, 4);
```

## Default Configurations

### Ad Configuration

- 65% in-house ads, 35% Google ads
- "banner_1" Google ad slot
- "homepage_ads_banner" placement

### Feed Rules

- **Ads**: Every 3rd item, 100% probability, priority 1
- **Promotion Media**: Every 5th item, 70% probability, priority 2
- **Related News**: At end, 90% probability, priority 3
- **Reward Tasks**: Every 7th item, 50% probability, priority 4

## Benefits of Refactoring

### Before

- 170+ lines of complex logic in single handler
- Duplicate ad logic across handlers
- Hard to test individual components
- Difficult to modify injection rules
- Mixed concerns (fetching, building, composition)

### After

- **Separation of Concerns**: Each utility has single responsibility
- **Reusability**: Utilities can be used across different handlers
- **Testability**: Individual components can be unit tested
- **Configurability**: Rules and probabilities easily adjustable
- **Maintainability**: Changes isolated to specific utilities
- **Consistency**: Standardized interfaces and error handling

## Migration Guide

The refactoring maintains backward compatibility. Existing handlers work unchanged, but new implementations should use the utilities:

```typescript
// Old approach (still works)
const home = publicProcedure.handler(async ({ context }) => {
  // 100+ lines of mixed logic...
});

// New approach (recommended)
const home = publicProcedure.handler(async ({ context }) => {
  const { payload } = context;

  // Fetch data
  const news = await fetchMainNews({ payload, type: "article" });
  const related = await fetchRelatedNews({ payload });
  const promo = await fetchPromotionMedia({ payload });

  // Setup composition
  const adManager = await createAdManager(payload);
  const feedData = {
    mainNews: news.docs,
    relatedNews: related.docs,
    promotionMedia: promo.docs,
  };

  // Compose feed
  const composedFeed = await composeFeed(payload, adManager, feedData);

  return { ...news, docs: composedFeed };
});
```

## Future Enhancements

- Add caching for frequently fetched data
- Implement A/B testing for different feed rules
- Add analytics tracking for content performance
- Support for user-personalized content injection
- Rate limiting for partner content requests
