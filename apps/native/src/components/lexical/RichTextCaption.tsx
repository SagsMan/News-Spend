import React, { Suspense } from "react";
import { View } from "react-native";
import { Text } from "../ui";
import { defaultElementRenderers } from "./default-element-renderers";
import type {
  AbstractElementNode,
  PayloadLexicalReactRendererContent,
} from "./types";

function getTextAlign(
  format: AbstractElementNode<string>["format"]
): "left" | "right" | "center" | "justify" | undefined {
  if (format === "right") {
    return "right";
  }
  if (format === "center") {
    return "center";
  }
  if (format === "justify") {
    return "justify";
  }
  return;
}

function getIndentStyle(indent: number) {
  return indent > 0 ? { marginLeft: indent * 20 } : {};
}

const LexicalRenderer = React.lazy(() =>
  import("./payload-lexical-react-renderer").then((m) => ({
    default: m.PayloadLexicalReactRenderer,
  }))
);

export function RichTextCaption({
  content,
}: {
  content: PayloadLexicalReactRendererContent;
}) {
  return (
    <Suspense fallback={null}>
      <View className="mt-1">
        <LexicalRenderer
          content={content}
          elementRenderers={{
            ...defaultElementRenderers,
            paragraph: (element) => (
              <Text
                className="text-foreground/60 text-sm leading-relaxed"
                selectable
                style={[
                  getIndentStyle(element.indent),
                  getTextAlign(element.format)
                    ? { textAlign: getTextAlign(element.format) }
                    : undefined,
                ]}
              >
                {element.children}
              </Text>
            ),
          }}
        />
      </View>
    </Suspense>
  );
}
