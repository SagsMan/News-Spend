"use client";

import { useFormFields } from "@payloadcms/ui";
import type {
  TextFieldClientComponent,
  UploadFieldClientComponent,
} from "payload";
import { useMemo } from "react";

// Works as afterInput on either the `video` upload field or the `url` text field
export const VideoPreviewField: TextFieldClientComponent &
  UploadFieldClientComponent = ({ path }) => {
  // Derive the block's base path: e.g. "content.2" from "content.2.video"
  const basePath = path.split(".").slice(0, -1).join(".");

  const videoSource = useFormFields(
    ([fields]) => fields[`${basePath}.videoSource`]?.value as string | undefined
  );

  // upload field value is an object: { id, url, mimeType, ... } or just an id string
  const videoUpload = useFormFields(
    ([fields]) =>
      fields[`${basePath}.video`]?.value as
        | Record<string, any>
        | string
        | undefined
  );

  const urlValue = useFormFields(
    ([fields]) => fields[`${basePath}.url`]?.value as string | undefined
  );

  const preview = useMemo(() => {
    if (videoSource === "upload") {
      if (!videoUpload) {
        return null;
      }
      // Payload stores the populated relationship as an object with a `url` property
      const src =
        typeof videoUpload === "object" && videoUpload !== null
          ? (videoUpload.url as string)
          : null;
      if (!src) {
        return null;
      }
      return { type: "direct" as const, src };
    }

    if (videoSource === "youtube") {
      if (!urlValue) {
        return null;
      }
      const id = extractYouTubeId(urlValue);
      if (!id) {
        return null;
      }
      return { type: "youtube" as const, id };
    }

    if (videoSource === "normal") {
      if (!urlValue) {
        return null;
      }
      return { type: "direct" as const, src: urlValue };
    }

    return null;
  }, [videoSource, videoUpload, urlValue]);

  if (!preview) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "1rem",
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid var(--theme-elevation-150)",
        background: "var(--theme-elevation-50)",
        maxWidth: "640px",
      }}
    >
      <p
        style={{
          margin: 0,
          padding: "6px 12px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--theme-elevation-500)",
          borderBottom: "1px solid var(--theme-elevation-150)",
        }}
      >
        Preview
      </p>

      {preview.type === "youtube" ? (
        <div
          style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}
        >
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            src={`https://www.youtube.com/embed/${preview.id}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title="YouTube preview"
          />
        </div>
      ) : (
        <video
          controls
          key={preview.src} // remount on src change
          src={preview.src}
          style={{ width: "100%", display: "block", maxHeight: "360px" }}
        />
      )}
    </div>
  );
};

// ── helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("?")[0]!;
    }
    if (u.hostname.includes("youtube.com")) {
      // /watch?v=, /shorts/, /embed/, /v/
      return (
        u.searchParams.get("v") ??
        (() => {
          const parts = u.pathname.split("/");
          const pivot = parts.findIndex((s) =>
            ["embed", "shorts", "v"].includes(s)
          );
          return pivot === -1 ? null : (parts[pivot + 1] ?? null);
        })()
      );
    }
  } catch {
    // user is mid-typing
  }
  return null;
}
