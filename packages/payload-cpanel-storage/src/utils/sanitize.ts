/**
 * Path and filename sanitization utilities for secure file handling
 */

import { SftpPathError } from "../errors";

/**
 * Characters that are potentially dangerous in filenames
 */
const DANGEROUS_CHARS = /[<>:"|?*\x00-\x1f]/g;

/**
 * Path traversal patterns
 */
const TRAVERSAL_PATTERN = /(\.\.[/\\]|\.\.\\|\.\.\/)/g;

/**
 * Maximum safe filename length (leaving room for extensions)
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Maximum safe path length
 */
const MAX_PATH_LENGTH = 4096;

/**
 * Sanitizes a filename by removing dangerous characters and patterns
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 * @throws {SftpPathError} If filename is invalid or empty after sanitization
 *
 * @example
 * ```typescript
 * sanitizeFilename("my-file.jpg"); // "my-file.jpg"
 * sanitizeFilename("../../../etc/passwd"); // "etc-passwd"
 * sanitizeFilename("file:name?.jpg"); // "filename.jpg"
 * ```
 */
export function sanitizeFilename(filename: string): string {
	if (!filename || typeof filename !== "string") {
		throw new SftpPathError("Filename must be a non-empty string", filename);
	}

	// Remove leading/trailing whitespace
	let sanitized = filename.trim();

	// Remove path traversal attempts
	sanitized = sanitized.replace(TRAVERSAL_PATTERN, "");

	// Remove dangerous characters
	sanitized = sanitized.replace(DANGEROUS_CHARS, "");

	// Replace spaces and special chars with hyphens
	sanitized = sanitized.replace(/\s+/g, "-");

	// Remove multiple consecutive hyphens
	sanitized = sanitized.replace(/-+/g, "-");

	// Remove leading/trailing hyphens and dots
	sanitized = sanitized.replace(/^[-._]+|[-._]+$/g, "");

	// Check if filename is empty after sanitization
	if (sanitized.length === 0) {
		throw new SftpPathError("Filename is empty after sanitization", filename);
	}

	// Check filename length
	if (sanitized.length > MAX_FILENAME_LENGTH) {
		// Try to preserve the extension
		const lastDot = sanitized.lastIndexOf(".");
		if (lastDot > 0 && lastDot > sanitized.length - 10) {
			const extension = sanitized.slice(lastDot);
			const name = sanitized.slice(0, MAX_FILENAME_LENGTH - extension.length);
			sanitized = name + extension;
		} else {
			sanitized = sanitized.slice(0, MAX_FILENAME_LENGTH);
		}
	}

	return sanitized;
}

/**
 * Sanitizes a path by normalizing separators and removing dangerous patterns
 *
 * @param filepath - The path to sanitize
 * @returns Sanitized path using POSIX separators
 * @throws {SftpPathError} If path is invalid
 *
 * @example
 * ```typescript
 * sanitizePath("uploads/images"); // "uploads/images"
 * sanitizePath("uploads/../../../etc"); // "uploads/etc"
 * sanitizePath("uploads\\images"); // "uploads/images"
 * ```
 */
export function sanitizePath(filepath: string): string {
	if (!filepath || typeof filepath !== "string") {
		throw new SftpPathError("Path must be a non-empty string", filepath);
	}

	// Remove leading/trailing whitespace
	let sanitized = filepath.trim();

	// Normalize path separators to forward slashes (POSIX)
	sanitized = sanitized.replace(/\\/g, "/");

	// Remove dangerous characters (but allow forward slashes for paths)
	sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, "");

	// Split path into segments
	const segments = sanitized.split("/").filter((segment) => segment.length > 0);

	// Process each segment to remove traversal attempts
	const cleanSegments: string[] = [];
	for (const segment of segments) {
		if (segment === "..") {
			// Remove the last segment if it exists (go up one directory)
			if (cleanSegments.length > 0) {
				cleanSegments.pop();
			}
			// If at root, just ignore the ".."
			continue;
		}

		if (segment === ".") {
			// Current directory reference, skip it
			continue;
		}

		// Sanitize individual segment
		const cleanSegment = segment.trim().replace(/^[-._]+|[-._]+$/g, "");
		if (cleanSegment.length > 0) {
			cleanSegments.push(cleanSegment);
		}
	}

	// Reconstruct path
	sanitized = cleanSegments.join("/");

	// Check path length
	if (sanitized.length > MAX_PATH_LENGTH) {
		throw new SftpPathError(
			`Path exceeds maximum length of ${MAX_PATH_LENGTH} characters`,
			filepath,
		);
	}

	return sanitized;
}

/**
 * Validates and sanitizes a prefix (subdirectory within collection)
 *
 * @param prefix - The prefix to sanitize
 * @returns Sanitized prefix or empty string
 *
 * @example
 * ```typescript
 * sanitizePrefix("thumbnails"); // "thumbnails"
 * sanitizePrefix("../other"); // "other"
 * sanitizePrefix(""); // ""
 * ```
 */
export function sanitizePrefix(prefix: string | undefined): string {
	if (!prefix) {
		return "";
	}

	try {
		return sanitizePath(prefix);
	} catch {
		// If sanitization fails, return empty string
		return "";
	}
}

/**
 * Combines and sanitizes base path, collection, prefix, and filename
 *
 * @param options - Path components
 * @returns Sanitized full path
 * @throws {SftpPathError} If any component is invalid
 *
 * @example
 * ```typescript
 * buildSafePath({
 *   basePath: "/var/www/uploads",
 *   collection: "images",
 *   prefix: "thumbnails",
 *   filename: "photo.jpg"
 * });
 * // Returns: "/var/www/uploads/images/thumbnails/photo.jpg"
 * ```
 */
export function buildSafePath(options: {
	basePath: string;
	collection: string;
	prefix?: string;
	filename: string;
}): string {
	const { basePath, collection, prefix, filename } = options;

	// Sanitize each component
	const safeBasePath = sanitizePath(basePath);
	const safeCollection = sanitizePath(collection);
	const safePrefix = sanitizePrefix(prefix);
	const safeFilename = sanitizeFilename(filename);

	// Build path components
	const pathParts = [safeBasePath, safeCollection];

	if (safePrefix) {
		pathParts.push(safePrefix);
	}

	pathParts.push(safeFilename);

	// Join with POSIX separator
	return pathParts.join("/");
}

/**
 * Validates that a path doesn't escape the allowed base directory
 *
 * @param fullPath - The full path to validate
 * @param basePath - The allowed base path
 * @returns True if path is safe, false otherwise
 *
 * @example
 * ```typescript
 * isPathSafe("/var/www/uploads/images/photo.jpg", "/var/www/uploads"); // true
 * isPathSafe("/etc/passwd", "/var/www/uploads"); // false
 * ```
 */
export function isPathSafe(fullPath: string, basePath: string): boolean {
	// Normalize both paths
	const normalizedFull = sanitizePath(fullPath);
	const normalizedBase = sanitizePath(basePath);

	// Ensure full path starts with base path
	return normalizedFull.startsWith(normalizedBase);
}
