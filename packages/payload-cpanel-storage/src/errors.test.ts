/**
 * Tests for custom error classes
 */

import { describe, expect, test } from "bun:test";

import {
	isRetryableError,
	SftpConfigError,
	SftpConnectionError,
	SftpDeleteError,
	SftpPathError,
	SftpStorageError,
	SftpUploadError,
} from "./errors";

describe("SftpStorageError", () => {
	test("should create error with code and message", () => {
		const error = new SftpStorageError("Test error", "TEST_CODE");

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error.name).toBe("SftpStorageError");
		expect(error.message).toBe("Test error");
		expect(error.code).toBe("TEST_CODE");
		expect(error.cause).toBeUndefined();
	});

	test("should create error with cause", () => {
		const originalError = new Error("Original error");
		const error = new SftpStorageError(
			"Wrapped error",
			"TEST_CODE",
			originalError,
		);

		expect(error.cause).toBe(originalError);
	});

	test("should maintain prototype chain", () => {
		const error = new SftpStorageError("Test", "CODE");
		expect(error instanceof SftpStorageError).toBe(true);
		expect(error instanceof Error).toBe(true);
	});
});

describe("SftpConnectionError", () => {
	test("should create connection error", () => {
		const error = new SftpConnectionError("Connection failed");

		expect(error).toBeInstanceOf(SftpConnectionError);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("SftpConnectionError");
		expect(error.message).toBe("Connection failed");
		expect(error.code).toBe("SFTP_CONNECTION_ERROR");
	});

	test("should create connection error with cause", () => {
		const cause = new Error("ECONNREFUSED");
		const error = new SftpConnectionError("Connection failed", cause);

		expect(error.cause).toBe(cause);
	});
});

describe("SftpUploadError", () => {
	test("should create upload error with filename", () => {
		const error = new SftpUploadError("Upload failed", "test.jpg");

		expect(error).toBeInstanceOf(SftpUploadError);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error.name).toBe("SftpUploadError");
		expect(error.message).toBe("Upload failed");
		expect(error.code).toBe("SFTP_UPLOAD_ERROR");
		expect(error.filename).toBe("test.jpg");
	});

	test("should create upload error with cause", () => {
		const cause = new Error("Network timeout");
		const error = new SftpUploadError("Upload failed", "test.jpg", cause);

		expect(error.filename).toBe("test.jpg");
		expect(error.cause).toBe(cause);
	});
});

describe("SftpDeleteError", () => {
	test("should create delete error with filename", () => {
		const error = new SftpDeleteError("Delete failed", "test.jpg");

		expect(error).toBeInstanceOf(SftpDeleteError);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error.name).toBe("SftpDeleteError");
		expect(error.message).toBe("Delete failed");
		expect(error.code).toBe("SFTP_DELETE_ERROR");
		expect(error.filename).toBe("test.jpg");
	});

	test("should create delete error with cause", () => {
		const cause = new Error("File not found");
		const error = new SftpDeleteError("Delete failed", "test.jpg", cause);

		expect(error.filename).toBe("test.jpg");
		expect(error.cause).toBe(cause);
	});
});

describe("SftpConfigError", () => {
	test("should create config error with field", () => {
		const error = new SftpConfigError("Invalid config", "baseUrl");

		expect(error).toBeInstanceOf(SftpConfigError);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error.name).toBe("SftpConfigError");
		expect(error.message).toBe("Invalid config");
		expect(error.code).toBe("SFTP_CONFIG_ERROR");
		expect(error.field).toBe("baseUrl");
	});
});

describe("SftpPathError", () => {
	test("should create path error with path", () => {
		const error = new SftpPathError("Invalid path", "/invalid/path");

		expect(error).toBeInstanceOf(SftpPathError);
		expect(error).toBeInstanceOf(SftpStorageError);
		expect(error.name).toBe("SftpPathError");
		expect(error.message).toBe("Invalid path");
		expect(error.code).toBe("SFTP_PATH_ERROR");
		expect(error.path).toBe("/invalid/path");
	});

	test("should create path error with cause", () => {
		const cause = new Error("Path traversal");
		const error = new SftpPathError(
			"Invalid path",
			"../../../etc/passwd",
			cause,
		);

		expect(error.path).toBe("../../../etc/passwd");
		expect(error.cause).toBe(cause);
	});
});

describe("isRetryableError", () => {
	test("should identify timeout errors as retryable", () => {
		const error = new Error("Connection timeout");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should identify ECONNREFUSED as retryable", () => {
		const error = new Error("ECONNREFUSED");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should identify ECONNRESET as retryable", () => {
		const error = new Error("ECONNRESET");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should identify ENOTFOUND as retryable", () => {
		const error = new Error("ENOTFOUND");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should identify ETIMEDOUT as retryable", () => {
		const error = new Error("ETIMEDOUT");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should identify network errors as retryable", () => {
		const error = new Error("Network error occurred");
		expect(isRetryableError(error)).toBe(true);
	});

	test("should not identify generic connection-labeled errors as retryable", () => {
		const error = new Error("Connection failed");
		expect(isRetryableError(error)).toBe(false);
	});

	test("should not identify authentication failures as retryable", () => {
		const error = new Error(
			"getConnection: All configured authentication methods failed",
		);
		expect(isRetryableError(error)).toBe(false);
	});

	test("should not identify other errors as retryable", () => {
		const error = new Error("File not found");
		expect(isRetryableError(error)).toBe(false);
	});

	test("should not identify validation errors as retryable", () => {
		const error = new Error("Invalid filename");
		expect(isRetryableError(error)).toBe(false);
	});

	test("should handle non-Error objects", () => {
		expect(isRetryableError("string error")).toBe(false);
		expect(isRetryableError(null)).toBe(false);
		expect(isRetryableError(undefined)).toBe(false);
		expect(isRetryableError(123)).toBe(false);
		expect(isRetryableError({})).toBe(false);
	});

	test("should be case-insensitive", () => {
		expect(isRetryableError(new Error("TIMEOUT"))).toBe(true);
		expect(isRetryableError(new Error("TimeOut"))).toBe(true);
		expect(isRetryableError(new Error("Network"))).toBe(true);
		expect(isRetryableError(new Error("AUTHENTICATION failed"))).toBe(false);
	});
});

describe("Error serialization", () => {
	test("should serialize SftpUploadError with all properties", () => {
		const error = new SftpUploadError(
			"Upload failed",
			"test.jpg",
			new Error("Original"),
		);

		const serialized = {
			name: error.name,
			message: error.message,
			code: error.code,
			filename: error.filename,
			stack: error.stack,
		};

		expect(serialized.name).toBe("SftpUploadError");
		expect(serialized.message).toBe("Upload failed");
		expect(serialized.code).toBe("SFTP_UPLOAD_ERROR");
		expect(serialized.filename).toBe("test.jpg");
		expect(serialized.stack).toContain("SftpUploadError");
	});

	test("should serialize SftpConfigError with field", () => {
		const error = new SftpConfigError("Config invalid", "connection.host");

		const serialized = {
			name: error.name,
			message: error.message,
			code: error.code,
			field: error.field,
		};

		expect(serialized.field).toBe("connection.host");
	});
});
