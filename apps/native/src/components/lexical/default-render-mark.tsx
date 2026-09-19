import { cn } from "heroui-native/utils";
import { tv } from "tailwind-variants";
import { Text } from "../ui";
import type { RenderMark } from "./types";

// ── Tailwind Variants for text marks ─────────────────────────────────────
const markVariants = tv({
  base: "",
  variants: {
    weight: {
      normal: "",
      bold: "font-bold",
      italic: "font-italic italic",
      boldItalic: "font-bold italic",
    },
    decoration: {
      none: "",
      underline: "underline",
      strikethrough: "line-through",
      both: "underline line-through",
    },
    variant: {
      normal: "",
      code: "rounded bg-foreground/10 px-1 font-mono text-foreground text-sm",
      highlight: "bg-yellow-300 text-foreground dark:bg-yellow-500/50",
      subscript: "text-xs",
      superscript: "text-xs",
    },
  },
  defaultVariants: {
    weight: "normal",
    decoration: "none",
    variant: "normal",
  },
  compoundVariants: [
    // Ensure italic class is present when font-inter-medium-italic or font-inter-bold-italic is used
    {
      weight: ["italic", "boldItalic"],
      class: "italic",
    },
  ],
});

export const defaultRenderMark: RenderMark = (mark) => {
  // Inline code
  if (mark.code) {
    return (
      <Text
        className={cn(markVariants({ variant: "code" }))}
        selectable
        style={{ fontFamily: "monospace" }}
      >
        {mark.text}
      </Text>
    );
  }

  // Highlight
  if (mark.highlight) {
    return (
      <Text
        className={cn(
          markVariants({
            variant: "highlight",
            ...getWeightAndDecoration(mark),
          })
        )}
        selectable
      >
        {mark.text}
      </Text>
    );
  }

  // Subscript
  if (mark.subscript) {
    return (
      <Text
        className={cn(
          markVariants({
            variant: "subscript",
            ...getWeightAndDecoration(mark),
          })
        )}
        selectable
      >
        {mark.text}
      </Text>
    );
  }

  // Superscript
  if (mark.superscript) {
    return (
      <Text
        className={cn(
          markVariants({
            variant: "superscript",
            ...getWeightAndDecoration(mark),
          })
        )}
        selectable
      >
        {mark.text}
      </Text>
    );
  }

  const { weight, decoration } = getWeightAndDecoration(mark);

  if (weight === "normal" && decoration === "none") {
    return <Text selectable>{mark.text}</Text>;
  }

  return (
    <Text className={cn(markVariants({ weight, decoration }))} selectable>
      {mark.text}
    </Text>
  );
};

// ── Helper: derive weight + decoration from mark ─────────────────────────
function getWeightAndDecoration(mark: Parameters<RenderMark>[0]) {
  let weight: "normal" | "bold" | "italic" | "boldItalic" = "normal";

  if (mark.bold && mark.italic) {
    weight = "boldItalic";
  } else if (mark.bold) {
    weight = "bold";
  } else if (mark.italic) {
    weight = "italic";
  }

  let decoration: "none" | "underline" | "strikethrough" | "both" = "none";

  if (mark.underline && mark.strikethrough) {
    decoration = "both";
  } else if (mark.underline) {
    decoration = "underline";
  } else if (mark.strikethrough) {
    decoration = "strikethrough";
  }

  return { weight, decoration };
}
