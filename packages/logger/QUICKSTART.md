# Logger Quick Start

## Installation

Add to your package.json:

```json
{
  "dependencies": {
    "@news-spend-media/logger": "workspace:*"
  }
}
```

Then run:

```bash
bun install
```

## Basic Usage

```typescript
// Named import (recommended)
import { logger } from "@news-spend-media/logger";

// Or default import
import logger from "@news-spend-media/logger";

// Simple logging
logger.info("Server started");
logger.warn("High memory usage");
logger.error("Connection failed");
logger.debug("Debug information");

// Structured logging (recommended)
logger.info({ userId: 123, action: "login" }, "User logged in");
logger.error({ err: error, requestId: "abc" }, "Request failed");
```

## Child Loggers (with context)

```typescript
import { createLogger } from "@news-spend-media/logger";

// Create logger with persistent context
const requestLogger = createLogger({
  requestId: "req-123",
  userId: 456,
});

// All logs include the context automatically
requestLogger.info("Processing payment");
requestLogger.error({ amount: 100 }, "Payment failed");
```

## Environment Variables

```bash
# Set minimum log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=debug

# Control output format
NODE_ENV=production  # JSON output
NODE_ENV=development # Pretty output (Node.js/Bun only)
```

## Platform Behavior

**Node.js/Bun:**

- Uses Pino for high performance
- Pretty colored output in development
- Structured JSON in production

**React Native:**

- Uses console methods (Metro-compatible)
- Structured data format
- Works with native debuggers

## Best Practices

✅ Use structured logging:

```typescript
logger.info({ userId: 123, orderId: 456 }, "Order created");
```

❌ Avoid string concatenation:

```typescript
logger.info(`Order 456 created by user 123`); // Don't do this
```

✅ Pass errors in `err` field:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error({ err: error }, "Operation failed");
}
```

✅ Use child loggers for context:

```typescript
const userLogger = createLogger({ userId: 123 });
userLogger.info("Profile updated");
userLogger.info("Settings changed");
```

## That's it!

The logger works identically across Node.js, Bun, and React Native. No configuration needed.

For full documentation, see [README.md](./README.md)
