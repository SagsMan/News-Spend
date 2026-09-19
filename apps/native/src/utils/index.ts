export { addServerErrors as serverValidationError } from "./addServerError";
export { debounce } from "./debounce";
export { formatDistance as formatDistanceUtil } from "./formatDistance";
export { getBaseUrl } from "./getBaseUrl";
export { getImageData } from "./getImageData";
export { isNetworkError } from "./isNetworkError";

/**
 * Avatar background colours, all verified to clear WCAG AA (4.5:1) against the
 * white initial rendered on top. Lowest in the set is #B4552A at 4.91:1.
 *
 * A curated list rather than a hashed hue: the hue wheel is not perceptually
 * uniform, so any single saturation/lightness pair swings from ~2:1 in the
 * yellows and cyans to ~9:1 in the blues. There is no fixed S/L that is
 * readable all the way round.
 */
const AVATAR_PALETTE = [
  "#B23B3B",
  "#B4552A",
  "#8A6A1F",
  "#4F7A32",
  "#2F7A63",
  "#2E6F8E",
  "#3A5CA8",
  "#5B47A8",
  "#8A3D82",
  "#A63A63",
  "#6B5344",
] as const;

/** Neutral used when there is no key to hash — deleted or anonymous authors. */
const AVATAR_FALLBACK = "#4A5568";

/**
 * Picks a stable avatar colour for `key`.
 *
 * Pass the user's `id`, not their username: usernames are unique but editable,
 * so keying on one makes a person's colour jump when they rename themselves.
 *
 * Pure and cheap — call it during render, there is nothing here worth memoising.
 */
export const avatarColor = (key?: string | null): string => {
  if (!key) {
    return AVATAR_FALLBACK;
  }

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0;
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

export const getCtaLabel = (cta?: string | null): string => cta || "Learn more";
