import { Galeria } from "@nandorojo/galeria";
import { Separator } from "heroui-native/separator";
import { Linking, View } from "react-native";
import { tv } from "tailwind-variants";
import { Image } from "#/components/ui";
import { getImageData } from "#/utils/getImageData";
import { Text } from "../ui";
import { RichTextCaption } from "./RichTextCaption";
import type {
  AbstractElementNode,
  ElementRenderers,
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

function getIndentStyle(indent: number): { marginLeft?: number } {
  return indent > 0 ? { marginLeft: indent * 20 } : {};
}

// ── Tailwind Variants for headings ───────────────────────────────────────
const headingVariants = tv({
  base: "font-bold text-foreground",
  variants: {
    level: {
      h1: "mt-4 mb-2 text-3xl",
      h2: "mt-3 mb-2 text-2xl",
      h3: "mt-3 mb-1 font-semibold text-xl",
      h4: "mt-2 mb-1 font-semibold text-lg",
      h5: "mt-2 mb-1 font-semibold text-base",
      h6: "mt-2 mb-1 font-semibold text-sm",
    },
  },
  defaultVariants: {
    level: "h2",
  },
});

export const defaultElementRenderers: ElementRenderers = {
  heading: (element) => {
    const textAlign = getTextAlign(element.format);
    const indentStyle = getIndentStyle(element.indent);

    return (
      <Text
        className={headingVariants({
          level: element.tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
        })}
        selectable
        style={[indentStyle, textAlign ? { textAlign } : undefined]}
      >
        {element.children}
      </Text>
    );
  },

  paragraph: (element) => {
    const textAlign = getTextAlign(element.format);
    const indentStyle = getIndentStyle(element.indent);

    return (
      <Text
        className="py-1 text-base text-foreground leading-relaxed"
        selectable
        style={[indentStyle, textAlign ? { textAlign } : undefined]}
      >
        {element.children}
      </Text>
    );
  },

  list: (element) => {
    const indentStyle = getIndentStyle(element.indent);
    return (
      <View className="my-1" style={indentStyle}>
        {element.children}
      </View>
    );
  },

  listItem: (element) => {
    const indentStyle = getIndentStyle(element.indent);

    if (element.checked != null) {
      return (
        <View className="my-0.5 flex-row items-center" style={indentStyle}>
          <Text className="mr-2 text-base text-foreground">
            {element.checked ? "☑" : "☐"}
          </Text>
          <View className="flex-1">{element.children}</View>
        </View>
      );
    }

    if (element.listType === "number") {
      return (
        <View className="my-0.5 flex-row" style={indentStyle}>
          <Text className="w-6 text-base text-foreground">
            {element.value}.
          </Text>
          <View className="flex-1">{element.children}</View>
        </View>
      );
    }

    return (
      <View className="my-0.5 flex-row" style={indentStyle}>
        <Text className="mr-2 text-base text-foreground">•</Text>
        <View className="flex-1">{element.children}</View>
      </View>
    );
  },

  quote: (element) => {
    const indentStyle = getIndentStyle(element.indent);
    return (
      <View
        className="my-3 rounded-r-md border-foreground/30 border-l-2 bg-foreground/5 py-2 pl-3"
        style={indentStyle}
      >
        <View>{element.children}</View>
      </View>
    );
  },

  link: (element) => {
    const url = element.fields?.url;

    const handlePress = () => {
      if (url) {
        Linking.openURL(url).catch(console.warn);
      }
    };

    return (
      <Text
        accessibilityLabel={url}
        accessibilityRole="link"
        className="text-blue-600 underline"
        onPress={handlePress}
        selectable
      >
        {element.children}
      </Text>
    );
  },

  autolink: (element) => {
    const handlePress = () => {
      if (element.fields.url) {
        Linking.openURL(element.fields.url).catch(console.warn);
      }
    };

    return (
      <Text
        accessibilityRole="link"
        className="text-primary underline"
        onPress={handlePress}
        selectable
      >
        {element.children}
      </Text>
    );
  },

  linebreak: () => <Text>{"\n"}</Text>,

  tab: () => <Text>{"    "}</Text>,

  horizontalrule: () => <Separator className="my-4" />,

  upload: (element) => {
    if (typeof element.value === "number") {
      return null;
    }

    if (element.value.mimeType?.includes("image")) {
      const { url, blurhash } = getImageData(element.value);

      if (!url) {
        return null;
      }

      const urls = [url];
      const aspectRatio =
        element.value.width && element.value.height
          ? element.value.width / element.value.height
          : 16 / 9;

      return (
        <View className="my-3">
          <Galeria urls={urls}>
            <Galeria.Image>
              <Image
                contentFit="contain"
                placeholder={{ blurhash }}
                placeholderContentFit="cover"
                source={{ uri: urls[0] }}
                style={{ width: "100%", aspectRatio }}
              />
            </Galeria.Image>
          </Galeria>
          {element.value.caption && (
            <RichTextCaption
              content={
                element.value.caption as PayloadLexicalReactRendererContent
              }
            />
          )}
        </View>
      );
    }

    return null;
  },
};
