/**
 * Static file handler for SFTP storage
 *
 * Serves files by redirecting to the public URL instead of proxying,
 * reducing server load and improving performance.
 */

import { logger } from "@news-spend-media/logger";
import type { StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";

import { sanitizeFilename } from "./utils/sanitize";

type StaticHandlerOptions = {
	baseUrl: string;
	uploadDir: string;
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

/**
 * Creates a static file handler for SFTP storage
 *
 * By default, redirects requests to the public CDN/storage URL.
 * Optionally can proxy files through the server if needed.
 *
 * Features:
 * - Redirects to public URL (efficient, no server load)
 * - Optional proxying with caching headers
 * - Path sanitization for security
 * - Comprehensive error handling
 *
 * @param options - Static handler configuration
 * @param collection - Payload collection configuration
 * @returns StaticHandler function for the cloud storage adapter
 */
export const staticHandler = (
	options: StaticHandlerOptions,
	collection: CollectionConfig,
): StaticHandler => {
	const {
		baseUrl,
		proxyFiles = false,
		cacheControl = "public, max-age=31536000, immutable",
	} = options;

	return async (_req, { params: { filename } }) => {
		try {
			// Sanitize filename for security
			const sanitizedFilename = sanitizeFilename(filename);

			// Build public URL
			const publicUrl = `${baseUrl}/${collection.slug}/${sanitizedFilename}`;

			// If not proxying, redirect to the public URL (most efficient)
			if (!proxyFiles) {
				logger.debug(
					{
						collection: collection.slug,
						filename: sanitizedFilename,
						url: publicUrl,
					},
					"Redirecting to public URL",
				);

				return Response.redirect(publicUrl, 302);
			}

			// Proxy mode: fetch and serve file through the server
			logger.debug(
				{
					collection: collection.slug,
					filename: sanitizedFilename,
					url: publicUrl,
				},
				"Proxying file request",
			);

			const response = await fetch(publicUrl, {
				signal: AbortSignal.timeout(30_000), // 30 second timeout
			});

			if (!response.ok) {
				logger.warn(
					{
						collection: collection.slug,
						filename: sanitizedFilename,
						status: response.status,
						statusText: response.statusText,
					},
					"Failed to fetch file from storage",
				);

				return new Response("File not found", { status: 404 });
			}

			// Get content type from response or infer from filename
			const contentType =
				response.headers.get("content-type") ||
				getContentType(sanitizedFilename);

			// Get content length
			const contentLength = response.headers.get("content-length");

			// Build response headers
			const headers: Record<string, string> = {
				"Content-Type": contentType,
				"Content-Disposition": `inline; filename="${sanitizedFilename}"`,
				"Cache-Control": cacheControl,
			};

			if (contentLength) {
				headers["Content-Length"] = contentLength;
			}

			// Add CORS headers if needed (for web font files, etc.)
			if (
				sanitizedFilename.endsWith(".woff") ||
				sanitizedFilename.endsWith(".woff2") ||
				sanitizedFilename.endsWith(".ttf") ||
				sanitizedFilename.endsWith(".otf")
			) {
				headers["Access-Control-Allow-Origin"] = "*";
			}

			return new Response(response.body, {
				status: 200,
				headers,
			});
		} catch (error) {
			logger.error(
				{
					collection: collection.slug,
					filename,
					error: error instanceof Error ? error.message : String(error),
				},
				"Static handler error",
			);

			return new Response("Internal Server Error", { status: 500 });
		}
	};
};

/**
 * Infers content type from filename extension
 */
function getContentType(filename: string): string {
	const extension = filename.split(".").pop()?.toLowerCase();

	const contentTypes: Record<string, string> = {
		// Images
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		ico: "image/x-icon",
		avif: "image/avif",

		// Documents
		pdf: "application/pdf",
		doc: "application/msword",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		xls: "application/vnd.ms-excel",
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		ppt: "application/vnd.ms-powerpoint",
		pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

		// Text
		txt: "text/plain",
		html: "text/html",
		css: "text/css",
		js: "text/javascript",
		json: "application/json",
		xml: "application/xml",

		// Video
		mp4: "video/mp4",
		webm: "video/webm",
		ogg: "video/ogg",
		avi: "video/x-msvideo",
		mov: "video/quicktime",

		// Audio
		mp3: "audio/mpeg",
		wav: "audio/wav",
		flac: "audio/flac",
		aac: "audio/aac",

		// Fonts
		woff: "font/woff",
		woff2: "font/woff2",
		ttf: "font/ttf",
		otf: "font/otf",

		// Archives
		zip: "application/zip",
		rar: "application/x-rar-compressed",
		"7z": "application/x-7z-compressed",
		tar: "application/x-tar",
		gz: "application/gzip",
	};

	return contentTypes[extension || ""] || "application/octet-stream";
}
