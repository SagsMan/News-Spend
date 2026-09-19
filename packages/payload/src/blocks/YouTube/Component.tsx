"use client";

import type { LexicalBlockClientProps } from "@payloadcms/richtext-lexical";
import { BlockCollapsible } from "@payloadcms/richtext-lexical/client";
import { useFormFields } from "@payloadcms/ui";

function extractVideoId(input: string): string | undefined {
  if (!input) {
    return;
  }

  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);

    if (
      url.hostname.includes("youtube.com") ||
      url.hostname.includes("youtu.be")
    ) {
      if (url.hostname.includes("youtu.be")) {
        return url.pathname.slice(1);
      }

      return url.searchParams.get("v") || url.searchParams.get("video_id");
    }
  } catch {
    // Invalid URL
  }

  return;
}

export const YouTubeBlockComponent: React.FC<LexicalBlockClientProps> = () => {
  const videoUrlField = useFormFields(([fields]) => fields.videoUrl);

  const videoId = extractVideoId(videoUrlField?.value as string);

  return (
    <BlockCollapsible>
      {videoId ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          src={`https://www.youtube.com/embed/${videoId}`}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            maxWidth: "560px",
          }}
          title="YouTube video player"
        />
      ) : null}
    </BlockCollapsible>
  );
};
