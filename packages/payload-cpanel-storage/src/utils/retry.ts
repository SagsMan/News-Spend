/**
 * Retry utility with exponential backoff for transient failures
 */

import { logger } from "@news-spend-media/logger";

import { isRetryableError } from "../errors";

export interface RetryOptions {
	/**
	 * Maximum number of retry attempts
	 * @default 3
	 */
	maxAttempts?: number;

	/**
	 * Initial delay in milliseconds before first retry
	 * @default 1000
	 */
	initialDelayMs?: number;

	/**
	 * Maximum delay in milliseconds between retries
	 * @default 10000
	 */
	maxDelayMs?: number;

	/**
	 * Multiplier for exponential backoff
	 * @default 2
	 */
	backoffMultiplier?: number;

	/**
	 * Custom function to determine if an error should trigger a retry
	 */
	shouldRetry?: (error: unknown, attempt: number) => boolean;

	/**
	 * Operation name for logging
	 */
	operationName?: string;
}

const DEFAULT_RETRY_OPTIONS: Required<
	Omit<RetryOptions, "shouldRetry" | "operationName">
> = {
	maxAttempts: 3,
	initialDelayMs: 1000,
	maxDelayMs: 10_000,
	backoffMultiplier: 2,
};

/**
 * Delays execution for the specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the delay before the next retry using exponential backoff
 */
function calculateDelay(
	attempt: number,
	initialDelay: number,
	maxDelay: number,
	multiplier: number,
): number {
	const exponentialDelay = initialDelay * multiplier ** (attempt - 1);
	return Math.min(exponentialDelay, maxDelay);
}

/**
 * Executes an async operation with retry logic and exponential backoff
 *
 * @param operation - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await uploadFile(data),
 *   {
 *     maxAttempts: 3,
 *     operationName: 'uploadFile',
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = {
		...DEFAULT_RETRY_OPTIONS,
		...options,
	};

	const shouldRetry = options.shouldRetry ?? isRetryableError;
	const operationName = options.operationName ?? "operation";

	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const result = await operation();

			if (attempt > 1) {
				logger.info(
					{ attempt },
					`${operationName} succeeded after ${attempt} attempts`,
				);
			}

			return result;
		} catch (error) {
			lastError = error;

			const isLastAttempt = attempt === maxAttempts;
			const shouldRetryError = shouldRetry(error, attempt);

			if (isLastAttempt || !shouldRetryError) {
				logger.error(
					{
						error: error instanceof Error ? error.message : String(error),
						attempt,
						maxAttempts,
					},
					`${operationName} failed after ${attempt} attempt(s)`,
				);
				throw error;
			}

			const delayMs = calculateDelay(
				attempt,
				initialDelayMs,
				maxDelayMs,
				backoffMultiplier,
			);

			logger.warn(
				{
					error: error instanceof Error ? error.message : String(error),
					attempt,
					maxAttempts,
					nextRetryIn: delayMs,
				},
				`${operationName} failed, retrying in ${delayMs}ms`,
			);

			await delay(delayMs);
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError;
}

/**
 * Creates a retry wrapper function with predefined options
 *
 * @example
 * ```typescript
 * const retryUpload = createRetryWrapper({
 *   maxAttempts: 5,
 *   operationName: 'fileUpload',
 * });
 *
 * const result = await retryUpload(() => uploadFile(data));
 * ```
 */
export function createRetryWrapper(options: RetryOptions) {
	return <T>(operation: () => Promise<T>): Promise<T> =>
		withRetry(operation, options);
}
