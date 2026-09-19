/**
 * Handle file deletion from SFTP storage with connection pooling and retry logic
 */

import { logger } from "@news-spend-media/logger";
import type { HandleDelete } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";

import type { SftpConnectionPool } from "./connection-pool";
import { SftpDeleteError } from "./errors";
import { withRetry } from "./utils/retry";
import {
	buildSafePath,
	sanitizeFilename,
	sanitizePrefix,
} from "./utils/sanitize";

type HandleDeleteOptions = {
	uploadDir: string;
	pool: SftpConnectionPool;
};

/**
 * Creates a handler for deleting files from SFTP storage
 *
 * Features:
 * - Connection pooling for efficiency
 * - Automatic retry on transient failures
 * - Path sanitization for security
 * - Graceful handling of missing files
 * - Comprehensive error handling and logging
 *
 * @param options - Delete configuration
 * @param collection - Payload collection configuration
 * @returns HandleDelete function for the cloud storage adapter
 */
export const handleDelete = (
	options: HandleDeleteOptions,
	collection: CollectionConfig,
): HandleDelete => {
	return async ({ doc: { prefix = "" }, filename }) => {
		const startTime = Date.now();
		const sanitizedFilename = sanitizeFilename(filename);
		const sanitizedPrefix = sanitizePrefix(prefix);

		logger.info(
			{
				collection: collection.slug,
				filename: sanitizedFilename,
				prefix: sanitizedPrefix,
			},
			"Starting file deletion",
		);

		try {
			// Build safe remote path
			const remotePath = buildSafePath({
				basePath: options.uploadDir,
				collection: collection.slug,
				prefix: sanitizedPrefix,
				filename: sanitizedFilename,
			});

			await withRetry(
				async () => {
					return await options.pool.withConnection(async (sftp) => {
						// Check if file exists before attempting deletion
						const fileExists = await sftp.exists(remotePath);

						if (!fileExists) {
							logger.warn(
								{
									collection: collection.slug,
									filename: sanitizedFilename,
									path: remotePath,
								},
								"File does not exist, skipping deletion",
							);
							return;
						}

						// Delete the file
						await sftp.delete(remotePath);

						logger.debug(
							{
								collection: collection.slug,
								filename: sanitizedFilename,
								path: remotePath,
							},
							"File deleted successfully",
						);
					});
				},
				{
					maxAttempts: 3,
					initialDelayMs: 1000,
					operationName: `deleteFile-${sanitizedFilename}`,
				},
			);

			const duration = Date.now() - startTime;

			logger.info(
				{
					collection: collection.slug,
					filename: sanitizedFilename,
					duration,
				},
				"File deletion completed",
			);
		} catch (error) {
			const duration = Date.now() - startTime;

			logger.error(
				{
					collection: collection.slug,
					filename: sanitizedFilename,
					prefix: sanitizedPrefix,
					duration,
					error: error instanceof Error ? error.message : String(error),
				},
				"File deletion failed",
			);

			throw new SftpDeleteError(
				`Failed to delete file "${sanitizedFilename}" from collection "${collection.slug}"`,
				sanitizedFilename,
				error,
			);
		}
	};
};
