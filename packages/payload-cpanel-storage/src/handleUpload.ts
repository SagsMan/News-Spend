/**
 * Handle file upload to SFTP storage with connection pooling and retry logic
 */

import { logger } from "@news-spend-media/logger";
import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";

import type { SftpConnectionPool } from "./connection-pool";
import { SftpUploadError } from "./errors";
import { withRetry } from "./utils/retry";
import {
	buildSafePath,
	sanitizeFilename,
	sanitizePrefix,
} from "./utils/sanitize";

type HandleUploadOptions = {
	uploadDir: string;
	pool: SftpConnectionPool;
};

/**
 * Creates a handler for uploading files to SFTP storage
 *
 * Features:
 * - Connection pooling for efficiency
 * - Automatic retry on transient failures
 * - Path sanitization for security
 * - Automatic directory creation
 * - Comprehensive error handling and logging
 *
 * @param options - Upload configuration
 * @param collection - Payload collection configuration
 * @returns HandleUpload function for the cloud storage adapter
 */
export const handleUpload = (
	options: HandleUploadOptions,
	collection: CollectionConfig,
): HandleUpload => {
	return async ({ data, file: { buffer, filename } }) => {
		const startTime = Date.now();
		const sanitizedFilename = sanitizeFilename(filename);
		const sanitizedPrefix = sanitizePrefix(data.prefix);

		logger.info(
			{
				collection: collection.slug,
				filename: sanitizedFilename,
				prefix: sanitizedPrefix,
				size: buffer.length,
			},
			"Starting file upload",
		);

		try {
			// Build safe remote path
			const remotePath = buildSafePath({
				basePath: options.uploadDir,
				collection: collection.slug,
				prefix: sanitizedPrefix,
				filename: sanitizedFilename,
			});

			// Extract directory path
			const lastSlash = remotePath.lastIndexOf("/");
			const remoteDir = remotePath.slice(0, lastSlash);

			await withRetry(
				async () => {
					return await options.pool.withConnection(async (sftp) => {
						// Check if directory exists, create if needed
						const dirExists = await sftp.exists(remoteDir);

						if (!dirExists) {
							logger.debug(
								{
									directory: remoteDir,
									collection: collection.slug,
								},
								"Creating remote directory",
							);

							await sftp.mkdir(remoteDir, true);
						}

						// Upload the file
						await sftp.put(buffer, remotePath);

						logger.debug(
							{
								collection: collection.slug,
								filename: sanitizedFilename,
								path: remotePath,
								size: buffer.length,
							},
							"File uploaded successfully",
						);
					});
				},
				{
					maxAttempts: 3,
					initialDelayMs: 1000,
					operationName: `uploadFile-${sanitizedFilename}`,
				},
			);

			const duration = Date.now() - startTime;

			logger.info(
				{
					collection: collection.slug,
					filename: sanitizedFilename,
					duration,
					size: buffer.length,
				},
				"File upload completed",
			);

			return data;
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
				"File upload failed",
			);

			throw new SftpUploadError(
				`Failed to upload file "${sanitizedFilename}" to collection "${collection.slug}"`,
				sanitizedFilename,
				error,
			);
		}
	};
};
