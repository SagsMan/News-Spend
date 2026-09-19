/**
 * Mime-type filters for `upload` fields pointing at Media.
 *
 * Media deliberately accepts `image/*` and `video/*` (it carries video
 * thumbnail sizing), so an unfiltered upload field offers every file in the
 * library regardless of what the field is for. That is how a video ended up
 * selectable as a news article's header image: nothing was wrong with the
 * upload, it was simply offered somewhere it could never render.
 *
 * `filterOptions` narrows the picker AND is enforced when the document is
 * saved, so it holds for API writes too, not just for someone using the admin
 * panel carefully.
 *
 * Fields that genuinely take either kind — the rich-text media block, the
 * reusable `mediaField` — are deliberately left unfiltered.
 */

/** For a field that must be a still image: thumbnails, logos, avatars. */
export const IMAGE_ONLY = {
  mimeType: { contains: "image" },
} as const;

/** For a field that must be a video file, e.g. one labelled "Upload an MP4". */
export const VIDEO_ONLY = {
  mimeType: { contains: "video" },
} as const;
