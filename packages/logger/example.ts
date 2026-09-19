import { createLogger, logger } from "./src/index";

// Basic logging examples
logger.info("Application started");
logger.debug({ port: 3000 }, "Server listening on port");
logger.warn("Memory usage is high");

// Structured logging with context
logger.info(
  { userId: 123, email: "user@example.com" },
  "User authenticated successfully"
);

// Error logging
const testError = new Error("Database connection failed");
logger.error(
  { err: testError, retryCount: 3 },
  "Failed to connect to database"
);

// Child logger with persistent context
const requestLogger = createLogger({
  requestId: "req-abc-123",
  userId: 456,
  path: "/api/users",
});

requestLogger.info("Processing request");
requestLogger.debug({ queryParams: { page: 1, limit: 10 } }, "Fetching users");
requestLogger.info({ duration: 150 }, "Request completed");

// Different log levels
logger.trace("Very detailed trace information");
logger.debug("Debugging information");
logger.info("General information");
logger.warn("Warning message");
logger.error("Error occurred");
logger.fatal("Critical error - application shutting down");

console.log("\n✅ Logger examples completed");
