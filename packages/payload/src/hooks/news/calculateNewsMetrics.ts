import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import type { CollectionBeforeChangeHook } from "payload";

// Calculate word count from plain text
const getWordCount = (text: string): number => {
  if (!text) {
    return 0;
  }
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
};

// Calculate estimated read time in minutes
const getReadTime = (wordCount: number, wordsPerMinute = 200): number => {
  if (!wordCount) {
    return 0;
  }
  const minutes = wordCount / wordsPerMinute;
  return Math.max(1, Math.ceil(minutes));
};
export const calculateNewsMetrics: CollectionBeforeChangeHook = ({
  data,
  operation,
}) => {
  if (operation !== "create" && operation !== "update") {
    return data;
  }

  const contentField = "content";
  const wordCountField = "wordCount";
  const readTimeField = "readTimeMinutes";
  const excerptField = "excerpt";
  const wordsPerMinute = 200;

  try {
    const editorState = data?.[contentField];
    if (!editorState) {
      return data;
    }

    const plainText = convertLexicalToPlaintext({ data: editorState });

    const wordCount = getWordCount(plainText);
    const readTimeMinutes = getReadTime(wordCount, wordsPerMinute);

    return {
      ...data,
      [wordCountField]: wordCount,
      [readTimeField]: readTimeMinutes,
      [excerptField]: plainText.substring(0, 100),
    };
  } catch (error) {
    console.error("Error calculating Lexical metrics:", error);
    return data;
  }
};
