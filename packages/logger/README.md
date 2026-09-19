# @news-spend-media/logger

Platform-aware structured logging package for the news-spend-media monorepo.

## Features

- **Platform-aware**: Works in Node.js, Bun, and React Native environments
- **Fast**: Uses Pino in Node.js/Bun, optimized console wrapper in React Native
- **Structured**: Consistent logging API across all platforms
- **Environment-aware**: Pretty logs in development, JSON in production (Node.js/Bun)
- **Type-safe**: Full TypeScript support
- **Flexible**: Support for child loggers with context

## Installation

This package is part of the monorepo workspace. Add it to your package.json:

```json
{
  "dependencies": {
    "@news-spend-media/logger": "workspace:*"
  }
}
```

## Usage

### Basic Logging

```typescript
import { logger } from "@news-spend-media/logger";

// Simple messages
logger.info("Server started");
logger.warn("High memory usage detected");
logger.error("Failed to connect to database");
logger.debug("Processing request");

// Structured logging with context
logger.info({ userId: 123, action: "login" }, "User logged in");
logger.error({ err: error, requestId: "abc-123" }, "Request failed");
```

### Platform Detection

The logger automatically detects the runtime environment:

- **Node.js/Bun**: Uses Pino for high-performance structured logging
- **React Native**: Uses a console-based logger with structured output
- **Other environments**: Defaults to console-based logger

No configuration needed - it just works! ✨

### Log Levels

The logger supports the following levels (in order of severity):

- `fatal` - The application is about to crash
- `error` - Errors that require attention
- `warn` - Warning messages
- `info` - General informational messages
- `debug` - Detailed debugging information
- `trace` - Very detailed trace information

### Child Loggers

Create child loggers with additional context that will be included in all logs:

```typescript
import { createLogger } from "@news-spend-media/logger";

// Create a logger with request context
const requestLogger = createLogger({ requestId: "abc-123", userId: 456 });

requestLogger.info("Processing payment");
// Output: { requestId: "abc-123", userId: 456, msg: "Processing payment" }

requestLogger.error({ amount: 100 }, "Payment failed");
// Output: { requestId: "abc-123", userId: 456, amount: 100, msg: "Payment failed" }
```

### Error Logging

When logging errors, use the `err` field for proper error serialization:

```typescript
try {
  await processPayment();
} catch (error) {
  logger.error({ err: error }, "Payment processing failed");
}
```

## Configuration

### Environment Variables

- `LOG_LEVEL` - Set the minimum log level (default: `debug` in dev, `info` in production)
- `NODE_ENV` - Determines output format (`production` = JSON, otherwise pretty-printed)

### Example `.env`

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

## Output Format

### Node.js/Bun - Development (Pretty)

```
[10:30:45 AM] INFO: User logged in
    userId: 123
    action: "login"
```

### Node.js/Bun - Production (JSON)

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:45.123Z",
  "env": "production",
  "userId": 123,
  "action": "login",
  "msg": "User logged in"
}
```

### React Native (All Environments)

```
[INFO] User logged in { level: 'INFO', time: '2024-01-15T10:30:45.123Z', userId: 123, action: 'login', msg: 'User logged in' }
```

The React Native logger uses native console methods, making logs visible in Metro bundler and native debugging tools.

## Best Practices

1. **Use structured logging**: Include relevant context as fields instead of in the message

   ```typescript
   // Good ✅
   logger.info({ userId: 123, orderId: 456 }, "Order created");

   // Bad ❌
   logger.info(`Order 456 created by user 123`);
   ```

2. **Use appropriate log levels**: Don't use `error` for warnings or `info` for debugging

3. **Include error objects**: Always pass errors in the `err` field for proper serialization

4. **Use child loggers for context**: Create child loggers for request/user context instead of repeating fields

5. **Avoid logging sensitive data**: Never log passwords, tokens, or PII

## Integration Examples

### Hono Error Handler

```typescript
import { logger } from "@news-spend-media/logger";
import { onError } from "@orpc/server";

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      logger.error({ err: error }, "RPC handler error");
    }),
  ],
});
```

### React Query Error Handler

```typescript
import { logger } from "@news-spend-media/logger";
import { QueryCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      logger.error({ err: error }, "Query cache error");
    },
  }),
});
```

### Request Context Logger

```typescript
import { createLogger } from "@news-spend-media/logger";

app.use(async (c, next) => {
  const requestId = crypto.randomUUID();
  const requestLogger = createLogger({ requestId });

  c.set("logger", requestLogger);
  requestLogger.info({ path: c.req.path }, "Request started");

  await next();

  requestLogger.info({ status: c.res.status }, "Request completed");
});
```

## Migration from console.log

Replace console methods with logger:

```typescript
// Before
console.log("User created");
console.error(error);
console.warn("Deprecated API used");

// After
logger.info("User created");
logger.error({ err: error }, "Operation failed");
logger.warn("Deprecated API used");
```

## Platform-Specific Notes

### React Native

In React Native environments, the logger:

- Uses `console.log`, `console.warn`, and `console.error` under the hood
- Maintains the same API as the Node.js version for consistency
- Automatically formats structured data for React Native debuggers
- Respects log levels (set via `LOG_LEVEL` environment variable if available)

### Node.js/Bun

In Node.js and Bun environments, the logger:

- Uses Pino for high-performance logging
- Supports pretty printing in development with colors
- Outputs structured JSON in production for log aggregation
- Full access to Pino's features and performance optimizations

## Performance

- **Node.js/Bun**: Pino is one of the fastest loggers available (~30x faster than alternatives)
- **React Native**: Minimal overhead wrapper around native console methods
- **Zero runtime overhead** for platform detection (evaluated once at initialization)
