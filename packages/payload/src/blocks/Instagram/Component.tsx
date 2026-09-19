"use client";

import type { LexicalBlockClientProps } from "@payloadcms/richtext-lexical";
import { BlockCollapsible } from "@payloadcms/richtext-lexical/client";
import { useFormFields } from "@payloadcms/ui";

function extractPostId(input: string): string | undefined {
  if (!input) {
    return;
  }

  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("instagram.com")) {
      const pathParts = url.pathname.split("/").filter(Boolean);

      const postIndex = pathParts.indexOf("p");
      if (postIndex !== -1 && pathParts[postIndex + 1]) {
        return `p/${pathParts[postIndex + 1]}`;
      }

      const reelIndex = pathParts.indexOf("reel");
      if (reelIndex !== -1 && pathParts[reelIndex + 1]) {
        return `reel/${pathParts[reelIndex + 1]}`;
      }

      const tvIndex = pathParts.indexOf("tv");
      if (tvIndex !== -1 && pathParts[tvIndex + 1]) {
        return `tv/${pathParts[tvIndex + 1]}`;
      }
    }
  } catch {
    // Invalid URL
  }

  return;
}

export const InstagramBlockComponent: React.FC<
  LexicalBlockClientProps
> = () => {
  const postUrlField = useFormFields(([fields]) => fields.postUrl);

  const postId = extractPostId(postUrlField?.value as string);

  return (
    <BlockCollapsible>
      {postId ? (
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          frameBorder="0"
          src={`https://www.instagram.com/${postId}/embed`}
          style={{
            width: "100%",
            minHeight: "480px",
          }}
          title="Instagram post"
        />
      ) : null}
    </BlockCollapsible>
  );
};
