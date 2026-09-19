/**
 * Platform-aware logger that works in Node.js, Bun, and React Native environments
 */

import type * as pino from "pino";

// Detect if we're in a React Native environment
// React Native check must come first since it also has process global
const isReactNative =
  typeof navigator !== "undefined" &&
  (navigator as { product?: string }).product === "ReactNative";

// Detect if we're in a Node.js environment (only if not React Native)
const isNode =
  !isReactNative &&
  typeof process !== "undefined" &&
  process.versions !== null &&
  process.versions.node !== null;

export type Logger = {
  trace(message: string): void;
  trace(obj: Record<string, unknown>, message: string): void;
  debug(message: string): void;
  debug(obj: Record<string, unknown>, message: string): void;
  info(message: string): void;
  info(obj: Record<string, unknown>, message: string): void;
  warn(message: string): void;
  warn(obj: Record<string, unknown>, message: string): void;
  error(message: string): void;
  error(obj: Record<string, unknown>, message: string): void;
  fatal(message: string): void;
  fatal(obj: Record<string, unknown>, message: string): void;
  child(context: Record<string, unknown>): Logger;
};

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * React Native compatible logger implementation
 */
class ReactNativeLogger implements Logger {
  private readonly context: Record<string, unknown>;
  private readonly minLevel: number;

  constructor(
    context: Record<string, unknown> = {},
    minLevel: LogLevel = "debug"
  ) {
    this.context = context;
    this.minLevel = LOG_LEVELS[minLevel];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatLog(
    level: LogLevel,
    obj: Record<string, unknown> | string,
    message?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logObj = typeof obj === "string" ? {} : obj;
    const logMessage = typeof obj === "string" ? obj : message || "";

    const data = {
      level: level.toUpperCase(),
      time: timestamp,
      ...this.context,
      ...logObj,
      msg: logMessage,
    };

    // Use appropriate console method
    let consoleMethod: typeof console.log;
    if (level === "fatal" || level === "error") {
      consoleMethod = console.error;
    } else if (level === "warn") {
      consoleMethod = console.warn;
    } else {
      consoleMethod = console.log;
    }

    // Format for React Native console
    if (Object.keys(data).length > 3) {
      consoleMethod(`[${data.level}] ${data.msg}`, data);
    } else {
      consoleMethod(`[${data.level}] ${data.msg}`);
    }
  }

  trace(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("trace", obj, message);
  }

  debug(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("debug", obj, message);
  }

  info(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("info", obj, message);
  }

  warn(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("warn", obj, message);
  }

  error(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("error", obj, message);
  }

  fatal(obj: Record<string, unknown> | string, message?: string): void {
    this.formatLog("fatal", obj, message);
  }

  child(context: Record<string, unknown>): Logger {
    return new ReactNativeLogger(
      { ...this.context, ...context },
      this.getMinLevelName()
    );
  }

  private getMinLevelName(): LogLevel {
    for (const [level, value] of Object.entries(LOG_LEVELS)) {
      if (value === this.minLevel) {
        return level as LogLevel;
      }
    }
    return "info";
  }
}

/**
 * Node.js/Bun logger implementation using Pino
 */
async function createNodeLogger(): Promise<pino.Logger> {
  // Dynamic import of pino only in Node.js environment
  const pinoModule = await import("pino");

  const isDevelopment =
    typeof process !== "undefined" && process.env.NODE_ENV !== "production";

  const loggerOptions: pino.LoggerOptions = {
    level:
      (typeof process !== "undefined" && process.env.LOG_LEVEL) ||
      (isDevelopment ? "debug" : "info"),
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: pinoModule.stdTimeFunctions.isoTime,
    base: {
      env: typeof process === "undefined" ? "unknown" : process.env.NODE_ENV,
    },
  };

  const { build } = await import("pino-pretty");
  const destination = build({
    colorize: isDevelopment,
    translateTime: "SYS:standard",
    ignore: "pid,hostname",
    destination: 1,
    sync: true,
  });

  return pinoModule.default(loggerOptions, destination);
}

/**
 * Get the minimum log level from environment
 */
function getMinLogLevel(): LogLevel {
  if (typeof process !== "undefined" && process.env.LOG_LEVEL) {
    const level = process.env.LOG_LEVEL.toLowerCase() as LogLevel;
    if (level in LOG_LEVELS) {
      return level;
    }
  }

  // Default to debug in development, info in production
  const isDevelopment =
    typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  return isDevelopment ? "debug" : "info";
}

/**
 * Main logger instance - automatically uses the correct implementation
 */
async function initializeLogger(): Promise<Logger> {
  if (isReactNative) {
    return new ReactNativeLogger({}, getMinLogLevel());
  }
  if (isNode) {
    return await createNodeLogger();
  }
  // Fallback to RN logger
  return new ReactNativeLogger({}, getMinLogLevel());
}

let loggerInstance: Logger | null = null;

export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop) {
    if (!loggerInstance) {
      // Synchronously initialize with fallback logger
      loggerInstance = new ReactNativeLogger({}, getMinLogLevel());
      // Asynchronously replace with proper logger
      initializeLogger().then((l) => {
        loggerInstance = l;
      });
    }
    return loggerInstance[prop as keyof Logger];
  },
});

/**
 * Create a child logger with additional context
 * @param context - Additional fields to include in all logs from this logger
 * @returns A new logger instance with the provided context
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

export type { Logger as PinoLogger, pino } from "pino";

export async function getPinoLogger() {
  return initializeLogger();
}

/**
 * Default export for convenience
 */
export default logger;
