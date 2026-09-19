/**
 * Configuration validation utilities for SFTP storage plugin
 */

import type { ConnectOptions } from "ssh2-sftp-client";

import { SftpConfigError } from "../errors";

/**
 * Validates that a required configuration field is present and not empty
 */
function validateRequired(
	value: unknown,
	fieldName: string,
): asserts value is string {
	if (!value || typeof value !== "string" || value.trim().length === 0) {
		throw new SftpConfigError(
			`${fieldName} is required and must be a non-empty string`,
			fieldName,
		);
	}
}

/**
 * Validates that a number is positive
 */
function validatePositiveNumber(
	value: unknown,
	fieldName: string,
): asserts value is number {
	if (typeof value !== "number" || value <= 0) {
		throw new SftpConfigError(
			`${fieldName} must be a positive number`,
			fieldName,
		);
	}
}

/**
 * Validates URL format
 */
function validateUrl(url: string, fieldName: string): void {
	try {
		const parsed = new URL(url);
		if (!(parsed.protocol && parsed.hostname)) {
			throw new Error("Invalid URL structure");
		}
	} catch {
		throw new SftpConfigError(
			`${fieldName} must be a valid URL (e.g., https://example.com)`,
			fieldName,
		);
	}
}

/**
 * Validates SFTP connection configuration
 */
export function validateConnectionConfig(
	connection: ConnectOptions,
): asserts connection is Required<Pick<ConnectOptions, "host" | "username">> &
	ConnectOptions {
	if (!connection || typeof connection !== "object") {
		throw new SftpConfigError(
			"connection must be a valid configuration object",
			"connection",
		);
	}

	// Required fields
	validateRequired(connection.host, "connection.host");
	validateRequired(connection.username, "connection.username");

	// At least one authentication method must be provided
	const hasPassword = connection.password && connection.password.length > 0;
	const hasPrivateKey = connection.privateKey !== undefined;
	const hasAgent = connection.agent !== undefined;

	if (!(hasPassword || hasPrivateKey || hasAgent)) {
		throw new SftpConfigError(
			"connection must include at least one authentication method (password, privateKey, or agent)",
			"connection.auth",
		);
	}

	// Validate port if provided
	if (
		connection.port !== undefined &&
		(typeof connection.port !== "number" ||
			connection.port < 1 ||
			connection.port > 65_535)
	) {
		throw new SftpConfigError(
			"connection.port must be a number between 1 and 65535",
			"connection.port",
		);
	}

	// Validate timeout values if provided
	if (connection.readyTimeout !== undefined) {
		validatePositiveNumber(connection.readyTimeout, "connection.readyTimeout");
	}

	if (
		connection.retries !== undefined &&
		(typeof connection.retries !== "number" ||
			connection.retries < 0 ||
			connection.retries > 10)
	) {
		throw new SftpConfigError(
			"connection.retries must be a number between 0 and 10",
			"connection.retries",
		);
	}
}

/**
 * Validates base URL configuration
 */
export function validateBaseUrl(baseUrl: string): void {
	validateRequired(baseUrl, "baseUrl");
	validateUrl(baseUrl, "baseUrl");

	// Ensure baseUrl doesn't end with a slash
	if (baseUrl.endsWith("/")) {
		throw new SftpConfigError(
			"baseUrl should not end with a trailing slash",
			"baseUrl",
		);
	}
}

/**
 * Validates upload directory configuration
 */
export function validateUploadDir(uploadDir: string): void {
	validateRequired(uploadDir, "uploadDir");

	// Check for dangerous patterns
	if (uploadDir.includes("..")) {
		throw new SftpConfigError(
			"uploadDir cannot contain path traversal patterns (..)",
			"uploadDir",
		);
	}

	// Ensure it's an absolute path (starts with /)
	if (!uploadDir.startsWith("/")) {
		throw new SftpConfigError(
			"uploadDir must be an absolute path (starting with /)",
			"uploadDir",
		);
	}
}

/**
 * Validates collections configuration
 */
export function validateCollections(
	collections: unknown,
): asserts collections is Record<string, unknown> {
	if (!collections || typeof collections !== "object") {
		throw new SftpConfigError(
			"collections must be a valid object",
			"collections",
		);
	}

	const collectionEntries = Object.entries(collections);

	if (collectionEntries.length === 0) {
		throw new SftpConfigError(
			"collections must include at least one collection",
			"collections",
		);
	}

	// Validate collection slugs
	for (const [slug] of collectionEntries) {
		if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
			throw new SftpConfigError(
				"collection slugs must be non-empty strings",
				"collections",
			);
		}

		// Check for dangerous characters in slugs
		if (!/^[\w-]+$/.test(slug)) {
			throw new SftpConfigError(
				`collection slug "${slug}" contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed`,
				`collections.${slug}`,
			);
		}
	}
}

/**
 * Validates pool configuration options
 */
export function validatePoolOptions(options: {
	minConnections?: number;
	maxConnections?: number;
	idleTimeoutMs?: number;
	connectionTimeoutMs?: number;
}): void {
	const { minConnections, maxConnections, idleTimeoutMs, connectionTimeoutMs } =
		options;

	if (
		minConnections !== undefined &&
		(typeof minConnections !== "number" ||
			minConnections < 0 ||
			minConnections > 100)
	) {
		throw new SftpConfigError(
			"minConnections must be a number between 0 and 100",
			"pool.minConnections",
		);
	}

	if (
		maxConnections !== undefined &&
		(typeof maxConnections !== "number" ||
			maxConnections < 1 ||
			maxConnections > 100)
	) {
		throw new SftpConfigError(
			"maxConnections must be a number between 1 and 100",
			"pool.maxConnections",
		);
	}

	// Ensure min <= max
	if (
		minConnections !== undefined &&
		maxConnections !== undefined &&
		minConnections > maxConnections
	) {
		throw new SftpConfigError(
			"minConnections cannot be greater than maxConnections",
			"pool",
		);
	}

	if (idleTimeoutMs !== undefined) {
		validatePositiveNumber(idleTimeoutMs, "pool.idleTimeoutMs");
	}

	if (connectionTimeoutMs !== undefined) {
		validatePositiveNumber(connectionTimeoutMs, "pool.connectionTimeoutMs");
	}
}

/**
 * Validates complete plugin configuration
 */
export interface CpanelStorageOptions {
	collections: Record<string, unknown>;
	enabled?: boolean;
	connection: ConnectOptions;
	baseUrl: string;
	uploadDir: string;
	pool?: {
		minConnections?: number;
		maxConnections?: number;
		idleTimeoutMs?: number;
		connectionTimeoutMs?: number;
	};
}

export function validatePluginConfig(
	options: unknown,
): asserts options is CpanelStorageOptions {
	if (!options || typeof options !== "object") {
		throw new SftpConfigError(
			"plugin options must be a valid configuration object",
			"options",
		);
	}

	const config = options as Partial<CpanelStorageOptions>;

	// Validate required fields
	validateCollections(config.collections);
	validateConnectionConfig(config.connection!);
	validateBaseUrl(config.baseUrl!);
	validateUploadDir(config.uploadDir!);

	// Validate optional pool configuration
	if (config.pool) {
		validatePoolOptions(config.pool);
	}

	// Validate enabled flag if provided
	if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
		throw new SftpConfigError("enabled must be a boolean", "enabled");
	}
}
