"use client";

import type { LexicalBlockClientProps } from "@payloadcms/richtext-lexical";
import { BlockCollapsible } from "@payloadcms/richtext-lexical/client";
import { useFormFields, useTheme } from "@payloadcms/ui";
import { Tweet } from "react-tweet";

function extractTweetId(input: string): string | undefined {
  if (!input) {
    return;
  }

  const trimmed = input.trim();

  // If it's already just a numeric ID, return it
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL
  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Handle both twitter.com and x.com
    if (
      url.hostname.includes("twitter.com") ||
      url.hostname.includes("x.com")
    ) {
      // URL format: /username/status/{tweetId}
      const statusIndex = pathParts.indexOf("status");
      if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
        return pathParts[statusIndex + 1];
      }
    }
  } catch {
    // Invalid URL
  }

  return;
}

export const TwitterPostBlockComponent: React.FC<
  LexicalBlockClientProps
> = () => {
  const tweetIdField = useFormFields(([fields]) => fields.tweetId);
  const { theme } = useTheme();

  const tweetId = extractTweetId(tweetIdField?.value as string);

  const apiUrl = tweetId && `/api/tweet/${tweetId}`;

  return (
    <BlockCollapsible>
      {tweetId ? (
        <div data-theme={theme}>
          <Tweet apiUrl={apiUrl} />
        </div>
      ) : null}
    </BlockCollapsible>
  );
};
