/**
 * SFTP Connection Pool with health checks and graceful shutdown
 *
 * Manages a pool of reusable SFTP connections to avoid the overhead
 * of creating new connections for every operation.
 */

import { logger } from "@news-spend-media/logger";
import type { ConnectOptions } from "ssh2-sftp-client";

import { SftpConnectionError } from "./errors";
import { withRetry } from "./utils/retry";

type SftpClientInstance = any;

let SftpClientClass: SftpClientInstance = null;

async function getSftpClient() {
	if (!SftpClientClass) {
		const mod = await import("ssh2-sftp-client");
		SftpClientClass = mod.default;
	}
	return SftpClientClass;
}

/**
 * Connection wrapper that tracks usage and health
 */
type PooledConnection = {
	client: SftpClientInstance;
	id: string;
	createdAt: number;
	lastUsedAt: number;
	inUse: boolean;
	isHealthy: boolean;
};

/**
 * Pool configuration options
 */
export type ConnectionPoolOptions = {
	/**
	 * SFTP connection configuration
	 */
	connection: ConnectOptions;

	/**
	 * Minimum number of connections to maintain
	 * @default 1
	 */
	minConnections?: number;

	/**
	 * Maximum number of connections allowed
	 * @default 10
	 */
	maxConnections?: number;

	/**
	 * Time in milliseconds before an idle connection is closed
	 * @default 60000 (1 minute)
	 */
	idleTimeoutMs?: number;

	/**
	 * Connection timeout in milliseconds
	 * @default 30000 (30 seconds)
	 */
	connectionTimeoutMs?: number;

	/**
	 * Interval for health check runs in milliseconds
	 * @default 30000 (30 seconds)
	 */
	healthCheckIntervalMs?: number;

	/**
	 * Enable debug logging
	 * @default false
	 */
	debug?: boolean;
};

const DEFAULT_POOL_OPTIONS = {
	minConnections: 1,
	maxConnections: 10,
	idleTimeoutMs: 60_000,
	connectionTimeoutMs: 30_000,
	healthCheckIntervalMs: 30_000,
	debug: false,
} as const;

/**
 * SFTP Connection Pool
 *
 * Manages a pool of SFTP connections with automatic health checks,
 * idle timeout handling, and graceful shutdown.
 */
export class SftpConnectionPool {
	private readonly options: Required<ConnectionPoolOptions>;
	private readonly pool: PooledConnection[] = [];
	private connectionCounter = 0;
	private isShuttingDown = false;
	private healthCheckTimer: NodeJS.Timeout | null = null;
	private readonly connectionConfig: ConnectOptions;

	// Backoff state: consecutive failures since last successful connection
	private consecutiveFailures = 0;
	private lastFailureTime = 0;

	constructor(options: ConnectionPoolOptions) {
		this.options = {
			...DEFAULT_POOL_OPTIONS,
			...options,
		};

		// Add timeout to connection config if not present
		this.connectionConfig = {
			...options.connection,
			readyTimeout:
				options.connection.readyTimeout ?? this.options.connectionTimeoutMs,
		};

		this.log("Connection pool initialized", {
			minConnections: this.options.minConnections,
			maxConnections: this.options.maxConnections,
		});

		// Start health check timer
		this.startHealthCheck();

		// Setup graceful shutdown handlers
		this.setupShutdownHandlers();
	}

	/**
	 * Log helper that respects debug setting
	 */
	private log(message: string, meta?: Record<string, unknown>): void {
		if (this.options.debug) {
			logger.debug(meta ?? {}, `[SftpConnectionPool] ${message}`);
		}
	}

	/**
	 * Creates a new SFTP connection
	 */
	private async createConnection(): Promise<PooledConnection> {
		if (this.isShuttingDown) {
			throw new SftpConnectionError(
				"Pool is shutting down, cannot create new connections",
			);
		}

		const connectionId = `sftp-${++this.connectionCounter}`;
		const SftpClientClass = await getSftpClient();
		const client = new SftpClientClass();

		this.log(`Creating connection ${connectionId}`);

		try {
			await withRetry(
				async () => {
					await client.connect(this.connectionConfig);
				},
				{
					maxAttempts: 3,
					operationName: `createConnection-${connectionId}`,
				},
			);

			const connection: PooledConnection = {
				client,
				id: connectionId,
				createdAt: Date.now(),
				lastUsedAt: Date.now(),
				inUse: false,
				isHealthy: true,
			};

			this.pool.push(connection);
			this.log(`Connection ${connectionId} created successfully`, {
				poolSize: this.pool.length,
			});

			return connection;
		} catch (error) {
			this.log(`Failed to create connection ${connectionId}`, {
				error: error instanceof Error ? error.message : String(error),
			});

			// Ensure client is cleaned up
			try {
				await client.end();
			} catch {
				// Ignore cleanup errors
			}

			throw new SftpConnectionError(
				`Failed to create SFTP connection: ${error instanceof Error ? error.message : String(error)}`,
				error,
			);
		}
	}

	/**
	 * Checks if a connection is still healthy
	 */
	private async checkConnectionHealth(
		connection: PooledConnection,
	): Promise<boolean> {
		try {
			// Simple health check: list current directory
			await connection.client.cwd();
			return true;
		} catch (error) {
			this.log(`Connection ${connection.id} failed health check`, {
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Removes and closes a connection from the pool
	 */
	private async removeConnection(connection: PooledConnection): Promise<void> {
		const index = this.pool.indexOf(connection);
		if (index > -1) {
			this.pool.splice(index, 1);
		}

		try {
			await connection.client.end();
			this.log(`Connection ${connection.id} closed`, {
				poolSize: this.pool.length,
			});
		} catch (error) {
			this.log(`Error closing connection ${connection.id}`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Runs health checks and removes unhealthy or idle connections
	 */
	private async runHealthCheck(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.log("Running health check", { poolSize: this.pool.length });

		const now = Date.now();
		const connectionsToRemove: PooledConnection[] = [];

		for (const connection of this.pool) {
			// Skip connections currently in use
			if (connection.inUse) {
				continue;
			}

			// Check for idle timeout
			const idleTime = now - connection.lastUsedAt;
			if (idleTime > this.options.idleTimeoutMs) {
				// Keep minimum connections even if idle
				const availableConnections =
					this.pool.length - connectionsToRemove.length;
				if (availableConnections > this.options.minConnections) {
					this.log(
						`Connection ${connection.id} idle for ${idleTime}ms, marking for removal`,
					);
					connectionsToRemove.push(connection);
					continue;
				}
			}

			// Check connection health
			const isHealthy = await this.checkConnectionHealth(connection);
			if (!isHealthy) {
				connection.isHealthy = false;
				connectionsToRemove.push(connection);
			}
		}

		// Remove unhealthy and idle connections
		for (const connection of connectionsToRemove) {
			await this.removeConnection(connection);
		}

		// Ensure we maintain minimum connections
		await this.ensureMinimumConnections();
	}

	/**
	 * Ensures the pool has at least the minimum number of connections
	 *
	 * Implements exponential backoff to avoid hammering the server
	 * when connections keep failing (e.g. bad credentials).
	 */
	private async ensureMinimumConnections(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		const currentSize = this.pool.length;
		if (currentSize >= this.options.minConnections) {
			// Pool is healthy; reset backoff counter
			this.consecutiveFailures = 0;
			return;
		}

		// Exponential backoff: 30s, 60s, 120s, 240s, ... capped at ~1 hour
		if (this.consecutiveFailures > 0) {
			const backoffMs = Math.min(
				30_000 * 2 ** (this.consecutiveFailures - 1),
				3_600_000,
			);
			const elapsed = Date.now() - this.lastFailureTime;
			if (elapsed < backoffMs) {
				this.log(
					`Skipping connection attempt, next retry in ${Math.round((backoffMs - elapsed) / 1000)}s (failure #${this.consecutiveFailures})`,
				);
				return;
			}
		}

		const needed = this.options.minConnections - currentSize;
		this.log(`Creating ${needed} connection(s) to meet minimum`, {
			current: currentSize,
			minimum: this.options.minConnections,
		});

		const promises = Array.from({ length: needed }, () =>
			this.createConnection()
				.then(() => {
					this.consecutiveFailures = 0;
				})
				.catch((error) => {
					this.consecutiveFailures++;
					this.lastFailureTime = Date.now();
					logger.error(
						{
							error: error instanceof Error ? error.message : String(error),
							consecutiveFailures: this.consecutiveFailures,
						},
						"Failed to create minimum connection",
					);
				}),
		);

		await Promise.all(promises);
	}

	/**
	 * Starts the health check timer
	 */
	private startHealthCheck(): void {
		if (this.healthCheckTimer) {
			return;
		}

		this.healthCheckTimer = setInterval(() => {
			this.runHealthCheck();
		}, this.options.healthCheckIntervalMs);

		// Don't prevent Node.js from exiting
		if (
			typeof this.healthCheckTimer === "object" &&
			"unref" in this.healthCheckTimer
		) {
			this.healthCheckTimer.unref();
		}
	}

	/**
	 * Stops the health check timer
	 */
	private stopHealthCheck(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
			this.log("Health check timer stopped");
		}
	}

	/**
	 * Setup handlers for graceful shutdown
	 */
	private setupShutdownHandlers(): void {
		const shutdown = (): void => {
			this.shutdown();
		};

		process.on("SIGTERM", shutdown);
		process.on("SIGINT", shutdown);
	}

	/**
	 * Releases a connection back to the pool
	 *
	 * @param client - The SFTP client to release
	 */
	release(client: SftpClientInstance): void {
		const connection = this.pool.find((conn) => conn.client === client);

		if (connection) {
			connection.inUse = false;
			connection.lastUsedAt = Date.now();

			this.log(`Connection ${connection.id} released`, {
				activeConnections: this.pool.filter((c) => c.inUse).length,
			});
		}
	}

	/**
	 * Executes an operation with an auto-acquired and released connection
	 *
	 * @param operation - Function that receives an SFTP client
	 * @returns Result of the operation
	 *
	 * @example
	 * ```typescript
	 * const result = await pool.withConnection(async (sftp) => {
	 *   return await sftp.list('/path');
	 * });
	 * ```
	 */
	async withConnection<T>(
		operation: (client: SftpClientInstance) => Promise<T>,
	): Promise<T> {
		const client = await this.acquire();

		try {
			const result = await operation(client);
			return result;
		} finally {
			this.release(client);
		}
	}

	/**
	 * Gets current pool statistics
	 */
	getStats(): {
		totalConnections: number;
		activeConnections: number;
		idleConnections: number;
		healthyConnections: number;
	} {
		return {
			totalConnections: this.pool.length,
			activeConnections: this.pool.filter((c) => c.inUse).length,
			idleConnections: this.pool.filter((c) => !c.inUse).length,
			healthyConnections: this.pool.filter((c) => c.isHealthy).length,
		};
	}

	/**
	 * Performs graceful shutdown of the pool
	 *
	 * Stops accepting new connections and closes all existing connections
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.isShuttingDown = true;
		logger.info("SFTP connection pool shutting down");

		// Stop health checks
		this.stopHealthCheck();

		// Wait for active connections to finish (with timeout)
		const maxWaitTime = 5000; // 5 seconds
		const startTime = Date.now();

		while (this.pool.some((conn) => conn.inUse)) {
			if (Date.now() - startTime > maxWaitTime) {
				logger.warn("Forcing connection pool shutdown after timeout");
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Close all connections
		const closePromises = this.pool.map((connection) =>
			this.removeConnection(connection),
		);

		await Promise.all(closePromises);

		logger.info("SFTP connection pool shutdown complete");
	}

	private growthLock: Promise<void> = Promise.resolve();

	/**
	 * Acquires a connection from the pool
	 *
	 * @returns A healthy SFTP client
	 * @throws {SftpConnectionError} If unable to acquire a connection
	 */
	async acquire(this: any): Promise<any> {
		if (this.isShuttingDown) {
			throw new this.SftpConnectionError("Pool is shutting down");
		}

		// Try to find an available healthy connection first - no locking needed
		// for reads.
		let connection = this.pool.find(
			(conn: any) => !conn.inUse && conn.isHealthy,
		);

		if (!connection) {
			// Chain onto growthLock so concurrent callers each wait their turn
			// to check-and-possibly-create, rather than all racing at once.
			const myTurn = this.growthLock.then(() => {
				// Re-check after acquiring our turn - an earlier caller in the
				// queue may have already created a connection we can reuse.
				const existing = this.pool.find(
					(conn: any) => !conn.inUse && conn.isHealthy,
				);
				if (existing) {
					return existing;
				}

				if (this.pool.length < this.options.maxConnections) {
					return this.createConnection();
				}

				return null;
			});

			// Keep the lock chain alive past success or failure so the next
			// caller in line proceeds regardless of this attempt's outcome.
			this.growthLock = myTurn.then(
				() => undefined,
				() => undefined,
			);

			connection = (await myTurn) ?? undefined;
		}

		// --- Everything below this line is unchanged from the original ---

		// Wait briefly for a connection to become available (covers the case
		// where maxConnections was already reached and we're waiting on a
		// release rather than a new connection).
		if (!connection) {
			const maxWaitTime = 10_000;
			const checkInterval = 100;
			let waited = 0;

			while (waited < maxWaitTime) {
				connection = this.pool.find(
					(conn: any) => !conn.inUse && conn.isHealthy,
				);
				if (connection) {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, checkInterval));
				waited += checkInterval;
			}
		}

		if (!connection) {
			throw new this.SftpConnectionError(
				`Unable to acquire connection. Pool size: ${this.pool.length}, Max: ${this.options.maxConnections}`,
			);
		}

		connection.inUse = true;
		connection.lastUsedAt = Date.now();

		return connection.client;
	}
}
