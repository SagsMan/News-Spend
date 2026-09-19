import type { FieldHook, TextField } from "payload";
import { deepMerge } from "payload";

type UrlFieldValidate = (
  value: unknown,
  args: {
    data: Record<string, unknown>;
    siblingData: Record<string, unknown>;
    id?: string | number;
    operation: "create" | "update";
    req: unknown;
  }
) => boolean | string | Promise<boolean | string>;

type UrlFieldOverrides = Omit<Partial<TextField>, "type"> & {
  validate?: UrlFieldValidate;
};

export const isValidUrlValue = (v: unknown): boolean => {
  if (v === null || v === undefined || v === "") {
    return true;
  }
  try {
    new URL(String(v).trim());
    return true;
  } catch {
    return false;
  }
};

/**
 * Stored trimmed, not as typed. Padded URLs pass `new URL` (the parser strips
 * surrounding whitespace) yet crash the app's WebView, which encodes the
 * padding to `%20...` and rejects it as "not a file URL" (NEWS-SPEND-MEDIA-DZ).
 */
export const trimUrlHook: FieldHook = ({ value }) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v.trim() : v));
  }
  return value;
};

const defaultUrlField: TextField = {
  name: "url",
  type: "text",
  hooks: {
    beforeChange: [trimUrlHook],
  },
  validate: (value: string | string[] | null | undefined) => {
    if (Array.isArray(value)) {
      for (const v of value) {
        if (!isValidUrlValue(v)) {
          return "Please enter a valid URL";
        }
      }
      return true;
    }

    return isValidUrlValue(value) ? true : "Please enter a valid URL";
  },
};

export const urlField = (overrides?: UrlFieldOverrides): TextField => {
  const { validate: extraValidate, ...rest } = overrides ?? {};
  const base = deepMerge(defaultUrlField, rest) as TextField;
  if (extraValidate) {
    const baseValidate = defaultUrlField.validate as UrlFieldValidate;
    const combined: UrlFieldValidate = (val, ctx) => {
      const urlResult = baseValidate(val, ctx);
      if (urlResult !== true) {
        return urlResult;
      }
      return extraValidate(val, ctx);
    };
    base.validate = combined as TextField["validate"];
  }
  return base;
};
