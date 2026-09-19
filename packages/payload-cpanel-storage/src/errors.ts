/**
 * Custom error classes for SFTP storage operations
 */

export class SftpStorageError extends Error {
	readonly code: string;
	readonly cause?: unknown;

	constructor(message: string, code: string, cause?: unknown) {
		super(message);
		this.name = "SftpStorageError";
		this.code = code;
		this.cause = cause;
		Object.setPrototypeOf(this, SftpStorageError.prototype);
	}
}

export class SftpConnectionError extends SftpStorageError {
	constructor(message: string, cause?: unknown) {
		super(message, "SFTP_CONNECTION_ERROR", cause);
		this.name = "SftpConnectionError";
		Object.setPrototypeOf(this, SftpConnectionError.prototype);
	}
}

export class SftpUploadError extends SftpStorageError {
	readonly filename: string;

	constructor(message: string, filename: string, cause?: unknown) {
		super(message, "SFTP_UPLOAD_ERROR", cause);
		this.name = "SftpUploadError";
		this.filename = filename;
		Object.setPrototypeOf(this, SftpUploadError.prototype);
	}
}

export class SftpDeleteError extends SftpStorageError {
	readonly filename: string;

	constructor(message: string, filename: string, cause?: unknown) {
		super(message, "SFTP_DELETE_ERROR", cause);
		this.name = "SftpDeleteError";
		this.filename = filename;
		Object.setPrototypeOf(this, SftpDeleteError.prototype);
	}
}

export class SftpConfigError extends SftpStorageError {
	readonly field: string;

	constructor(message: string, field: string) {
		super(message, "SFTP_CONFIG_ERROR");
		this.name = "SftpConfigError";
		this.field = field;
		Object.setPrototypeOf(this, SftpConfigError.prototype);
	}
}

export class SftpPathError extends SftpStorageError {
	readonly path: string;

	constructor(message: string, path: string, cause?: unknown) {
		super(message, "SFTP_PATH_ERROR", cause);
		this.name = "SftpPathError";
		this.path = path;
		Object.setPrototypeOf(this, SftpPathError.prototype);
	}
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Authentication failures are never transient. Retrying with the same
		// credentials will only produce more failed logins, which risks tripping
		// the server's brute-force protection (e.g. cPHulk).
		if (
			message.includes("authentication") ||
			message.includes("all configured authentication methods failed")
		) {
			return false;
		}

		return (
			message.includes("timeout") ||
			message.includes("econnrefused") ||
			message.includes("econnreset") ||
			message.includes("enotfound") ||
			message.includes("etimedout") ||
			message.includes("network")
		);
	}
	return false;
}
