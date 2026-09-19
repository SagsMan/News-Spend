import { createSlug } from "@news-spend-media/utils/createSlug";
import type { FieldHook } from "payload";

export const formatSlugHook =
  (fallback: string): FieldHook =>
  ({ data, operation, value }) => {
    if (typeof value === "string") {
      return createSlug(value);
    }

    if (
      data &&
      (operation === "create" || !data.slug) &&
      fallback &&
      fallback in data &&
      typeof data[fallback] === "string"
    ) {
      return createSlug(data[fallback]);
    }

    return value;
  };
