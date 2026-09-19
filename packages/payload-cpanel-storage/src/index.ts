/**
 * Payload CMS cPanel SFTP Storage Plugin
 *
 * A production-ready storage adapter for Payload CMS that uses SFTP to store files
 * on cPanel hosting or any SFTP-accessible server.
 *
 * Features:
 * - Connection pooling for efficient resource usage
 * - Automatic retry with exponential backoff
 * - Path sanitization and validation for security
 * - Health checks and graceful shutdown
 * - Comprehensive error handling and logging
 * - TypeScript support with full type safety
 *
 * @example
 * ```typescript
 * import { cpanelSftpStorage } from '@news-spend-media/payload-cpanel-storage';
 *
 * export default buildConfig({
 *   plugins: [
 *     cpanelSftpStorage({
 *       collections: {
 *         media: true,
 *         documents: {
 *           disableLocalStorage: true,
 *         },
 *       },
 *       connection: {
 *         host: process.env.SFTP_HOST!,
 *         port: 22,
 *         username: process.env.SFTP_USERNAME!,
 *         password: process.env.SFTP_PASSWORD,
 *       },
 *       baseUrl: process.env.STORAGE_BASE_URL!,
 *       uploadDir: '/home/username/public_html/uploads',
 *       pool: {
 *         minConnections: 1,
 *         maxConnections: 10,
 *       },
 *     }),
 *   ],
 * });
 * ```
 */

import { logger } from "@news-spend-media/logger";
import { cloudStoragePlugin } from "@payloadcms/plugin-cloud-storage";
import type {
	Adapter,
	CollectionOptions,
	GeneratedAdapter,
} from "@payloadcms/plugin-cloud-storage/types";
import type { Config, Plugin } from "payload";
import type { ConnectOptions } from "ssh2-sftp-client";

import type { ConnectionPoolOptions } from "./connection-pool";
import { SftpConnectionPool } from "./connection-pool";
import { handleDelete } from "./handleDelete";
import { handleUpload } from "./handleUpload";
import { staticHandler } from "./staticHandler";
import { validatePluginConfig } from "./utils/validation";

export type { ConnectionPoolOptions } from "./connection-pool";
export { SftpConnectionPool } from "./connection-pool";
export * from "./errors";
// Re-export types and utilities for consumers
export type { CpanelStorageOptions } from "./utils/validation";

/**
 * Plugin configuration options
 */
export type CpanelStoragePluginOptions = {
	/**
	 * Collections to enable SFTP storage for
	 *
	 * @example
	 * ```typescript
	 * collections: {
	 *   media: true,
	 *   documents: {
	 *     disableLocalStorage: true,
	 *   }
	 * }
	 * ```
	 */
	collections: Record<string, Omit<CollectionOptions, "adapter"> | true>;

	/**
	 * Enable or disable the plugin
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * SFTP connection configuration
	 */
	connection: ConnectOptions;

	/**
	 * Public base URL where files will be accessible
	 * Should NOT include trailing slash
	 *
	 * @example "https://example.com/uploads"
	 */
	baseUrl: string;

	/**
	 * Upload directory on the SFTP server (absolute path)
	 * Should start with / and NOT include trailing slash
	 *
	 * @example "/home/username/public_html/uploads"
	 */
	uploadDir: string;

	/**
	 * Connection pool configuration
	 */
	pool?: {
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
		 * Enable debug logging for connection pool
		 * @default false
		 */
		debug?: boolean;
	};

	/**
	 * Static file handler configuration
	 */
	static?: {
		/**
		 * If true, proxy files through the server instead of redirecting
		 * @default false
		 */
		proxyFiles?: boolean;

		/**
		 * Cache control header value for proxied files
		 * @default "public, max-age=31536000, immutable"
		 */
		cacheControl?: string;
	};
};

/**
 * Default plugin options
 */
const DEFAULT_OPTIONS: Partial<CpanelStoragePluginOptions> = {
	enabled: true,
	pool: {
		minConnections: 1,
		maxConnections: 10,
		idleTimeoutMs: 60_000,
		connectionTimeoutMs: 30_000,
		healthCheckIntervalMs: 30_000,
		debug: false,
	},
	static: {
		proxyFiles: false,
		cacheControl: "public, max-age=31536000, immutable",
	},
};

/**
 * Global connection pool instance
 * Shared across all collections to optimize resource usage.
 *
 * Stored on globalThis to survive HMR/module re-evaluations in development.
 */
declare global {
	var __sftpConnectionPool: SftpConnectionPool | undefined;
}

/**
 * Creates the internal SFTP storage adapter
 */
function createSftpAdapter(
	options: Required<CpanelStoragePluginOptions>,
): Adapter {
	return ({ collection }): GeneratedAdapter => {
		const pool = globalThis.__sftpConnectionPool;
		if (!pool) {
			throw new Error(
				"SFTP connection pool not initialized. This should not happen.",
			);
		}

		return {
			name: "cpanel-sftp-storage",

			/**
			 * Generates the public URL for accessing uploaded files
			 */
			generateURL: ({ filename }) =>
				`${options.baseUrl}/${collection.slug}/${filename}`,

			/**
			 * Handles file uploads
			 */
			handleUpload: handleUpload(
				{
					uploadDir: options.uploadDir,
					pool,
				},
				collection,
			),

			/**
			 * Handles file deletions
			 */
			handleDelete: handleDelete(
				{
					uploadDir: options.uploadDir,
					pool,
				},
				collection,
			),

			/**
			 * Handles static file requests
			 */
			staticHandler: staticHandler(
				{
					baseUrl: options.baseUrl,
					uploadDir: options.uploadDir,
					proxyFiles: options.static.proxyFiles,
					cacheControl: options.static.cacheControl,
				},
				collection,
			),
		};
	};
}

/**
 * cPanel SFTP Storage Plugin for Payload CMS
 *
 * Stores uploaded files on an SFTP server (such as cPanel hosting) instead of
 * the local filesystem. Uses connection pooling and retry logic for reliability.
 *
 * @param pluginOptions - Plugin configuration
 * @returns Payload plugin
 *
 * @example
 * ```typescript
 * export default buildConfig({
 *   plugins: [
 *     cpanelSftpStorage({
 *       collections: {
 *         media: true,
 *       },
 *       connection: {
 *         host: 'ftp.example.com',
 *         username: 'user',
 *         password: 'pass',
 *       },
 *       baseUrl: 'https://cdn.example.com/uploads',
 *       uploadDir: '/home/user/public_html/uploads',
 *     }),
 *   ],
 * });
 * ```
 */
export const cpanelSftpStorage = (
	pluginOptions: CpanelStoragePluginOptions,
): Plugin => {
	return (incomingConfig: Config): Config => {
		// If plugin is disabled, return config unchanged
		if (pluginOptions.enabled === false) {
			logger.info({}, "cPanel SFTP storage plugin is disabled");
			return incomingConfig;
		}

		// Validate configuration
		try {
			validatePluginConfig(pluginOptions);
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
				},
				"Invalid cPanel SFTP storage plugin configuration",
			);
			throw error;
		}

		// Merge options with defaults
		const options: Required<CpanelStoragePluginOptions> = {
			...DEFAULT_OPTIONS,
			...pluginOptions,
			pool: {
				...DEFAULT_OPTIONS.pool!,
				...pluginOptions.pool,
			},
			static: {
				...DEFAULT_OPTIONS.static!,
				...pluginOptions.static,
			},
		} as Required<CpanelStoragePluginOptions>;

		if (!globalThis.__sftpConnectionPool) {
			if (options.pool.debug) {
				logger.info(
					{
						collections: Object.keys(options.collections),
						poolConfig: {
							min: options.pool.minConnections,
							max: options.pool.maxConnections,
						},
					},
					"Initializing cPanel SFTP storage plugin",
				);
			}

			const poolOptions: ConnectionPoolOptions = {
				connection: options.connection,
				minConnections: options.pool.minConnections,
				maxConnections: options.pool.maxConnections,
				idleTimeoutMs: options.pool.idleTimeoutMs,
				connectionTimeoutMs: options.pool.connectionTimeoutMs,
				healthCheckIntervalMs: options.pool.healthCheckIntervalMs,
				debug: options.pool.debug,
			};

			globalThis.__sftpConnectionPool = new SftpConnectionPool(poolOptions);

			if (options.pool.debug) {
				logger.info(
					{
						min: options.pool.minConnections,
						max: options.pool.maxConnections,
					},
					"SFTP connection pool initialized",
				);
			}
		}

		// Create adapter
		const adapter = createSftpAdapter(options);

		// Build collections configuration for cloud storage plugin
		const collectionsWithAdapter: Record<string, CollectionOptions> =
			Object.entries(options.collections).reduce(
				(acc, [slug, collOptions]) => {
					acc[slug] = {
						...(collOptions === true ? {} : collOptions),
						adapter,
					};
					return acc;
				},
				{} as Record<string, CollectionOptions>,
			);

		// Update collection configs to disable local storage
		const config: Config = {
			...incomingConfig,
			collections: (incomingConfig.collections || []).map((collection) => {
				if (!collectionsWithAdapter[collection.slug]) {
					return collection;
				}

				return {
					...collection,
					upload: {
						...(typeof collection.upload === "object" ? collection.upload : {}),
						disableLocalStorage: true,
					},
				};
			}),
		};

		// Apply cloud storage plugin
		return cloudStoragePlugin({
			collections: collectionsWithAdapter,
		})(config);
	};
};

/**
 * Helper to get the current connection pool instance
 * Useful for monitoring and testing
 *
 * @returns The global connection pool instance or null if not initialized
 */
export function getConnectionPool(): SftpConnectionPool | null {
	return globalThis.__sftpConnectionPool ?? null;
}

/**
 * Manually shutdown the connection pool
 * Useful for testing or custom shutdown logic
 */
export async function shutdownConnectionPool(): Promise<void> {
	if (globalThis.__sftpConnectionPool) {
		await globalThis.__sftpConnectionPool.shutdown();
		globalThis.__sftpConnectionPool = undefined;
		logger.info({}, "SFTP connection pool shut down manually");
	}
}
