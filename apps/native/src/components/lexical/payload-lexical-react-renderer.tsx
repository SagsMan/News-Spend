import * as Sentry from "@sentry/react-native";
import React from "react";

import { defaultBlockRenders } from "./default-block-renderers";
import { defaultElementRenderers } from "./default-element-renderers";
import { defaultRenderMark } from "./default-render-mark";
import type {
  ListNode,
  Node,
  PayloadLexicalReactRendererProps,
  TextNode,
} from "./types";

// https://github.com/facebook/lexical/blob/c2ceee223f46543d12c574e62155e619f9a18a5d/packages/lexical/src/LexicalConstants.ts
const IS_BOLD = 1;
const IS_ITALIC = 1 << 1;
const IS_STRIKETHROUGH = 1 << 2;
const IS_UNDERLINE = 1 << 3;
const IS_CODE = 1 << 4;
const IS_SUBSCRIPT = 1 << 5;
const IS_SUPERSCRIPT = 1 << 6;
const IS_HIGHLIGHT = 1 << 7;

export function PayloadLexicalReactRenderer<
  Blocks extends { [key: string]: any },
>({
  content,
  elementRenderers = defaultElementRenderers,
  renderMark = defaultRenderMark,
  blockRenderers = defaultBlockRenders,
}: PayloadLexicalReactRendererProps<Blocks>) {
  const missingRenderersRef = React.useRef<string[]>([]);

  // Flush missing renderer errors to Sentry after render
  React.useEffect(() => {
    for (const msg of missingRenderersRef.current) {
      Sentry.captureException(new Error(msg));
    }
    missingRenderersRef.current = [];
  }, []);

  const renderElement = React.useCallback(
    (node: Node, children?: React.ReactNode) => {
      if (!elementRenderers) {
        throw new Error("'elementRenderers' prop not provided.");
      }

      if (node.type === "link" && node.fields) {
        return elementRenderers.link({ ...node, children });
      }

      if (node.type === "autolink" && node.fields) {
        return elementRenderers.autolink({ ...node, children });
      }

      if (node.type === "heading") {
        return elementRenderers.heading({ ...node, children });
      }

      if (node.type === "paragraph") {
        return elementRenderers.paragraph({ ...node, children });
      }

      if (node.type === "list") {
        return elementRenderers.list({ ...node, children });
      }

      if (node.type === "listitem") {
        return elementRenderers.listItem({ ...node, children });
      }

      if (node.type === "quote") {
        return elementRenderers.quote({ ...node, children });
      }

      if (node.type === "linebreak") {
        return elementRenderers.linebreak();
      }

      if (node.type === "tab") {
        return elementRenderers.tab();
      }

      if (node.type === "upload") {
        return elementRenderers.upload(node);
      }

      if (node.type === "horizontalrule") {
        return elementRenderers.horizontalrule();
      }

      // Relationship nodes: skip silently. Override via a custom elementRenderer if needed.
      if (node.type === "relationship") {
        return null;
      }

      // Unknown node: warn in dev, skip silently in prod so new Payload node
      // types don't crash the renderer.
      if (__DEV__) {
        console.warn(
          `[PayloadLexicalReactRenderer] Unhandled node type: '${node.type}'. ` +
            "Add a renderer for it or handle it explicitly."
        );
      }

      return null;
    },
    [elementRenderers]
  );

  const renderText = React.useCallback(
    (node: TextNode): React.ReactNode | null => {
      if (!renderMark) {
        throw new Error("'renderMark' prop not provided.");
      }

      if (!node.format) {
        return renderMark({ text: node.text });
      }

      return renderMark({
        text: node.text,
        bold: (node.format & IS_BOLD) > 0,
        italic: (node.format & IS_ITALIC) > 0,
        underline: (node.format & IS_UNDERLINE) > 0,
        strikethrough: (node.format & IS_STRIKETHROUGH) > 0,
        code: (node.format & IS_CODE) > 0,
        subscript: (node.format & IS_SUBSCRIPT) > 0,
        superscript: (node.format & IS_SUPERSCRIPT) > 0,
        highlight: (node.format & IS_HIGHLIGHT) > 0,
      });
    },
    [renderMark]
  );

  /**
   * Resolves a block or inline-block renderer and returns the rendered output,
   * or null (with a Sentry capture) if no renderer is registered for the blockType.
   */
  const renderBlock = React.useCallback(
    (
      node: { fields: { blockType: string; [key: string]: unknown } },
      isInline = false
    ) => {
      const { blockType } = node.fields;
      const renderer = blockRenderers[blockType] as
        | ((props: unknown) => React.ReactNode)
        | undefined;

      if (typeof renderer !== "function") {
        const label = isInline ? "inline-block" : "block";
        const msg = `[PayloadLexicalReactRenderer] Missing ${label} renderer for blockType '${blockType}'.`;

        if (__DEV__) {
          console.warn(msg);
        }

        // Queue error for Sentry instead of calling during render
        if (!missingRenderersRef.current.includes(msg)) {
          missingRenderersRef.current.push(msg);
        }
        return null;
      }

      return renderer(node);
    },
    [blockRenderers]
  );

  const serialize = React.useCallback(
    (
      children: Node[],
      parentListType?: ListNode["listType"],
      isInsideLink = false
    ): React.ReactNode[] | null =>
      children?.map((node, index) => {
        const nodeKey = (node as any).id ?? index;

        // ── Text ──────────────────────────────────────────────────────────────
        if (node.type === "text") {
          return (
            <React.Fragment key={nodeKey}>{renderText(node)}</React.Fragment>
          );
        }

        // ── Top-level block ───────────────────────────────────────────────────
        if (node.type === "block") {
          return (
            <React.Fragment key={nodeKey}>{renderBlock(node)}</React.Fragment>
          );
        }

        // ── Inline block (Payload 3.x SerializedInlineBlockNode) ──────────────
        if (node.type === "inlineBlock") {
          return (
            <React.Fragment key={nodeKey}>
              {renderBlock(node, true)}
            </React.Fragment>
          );
        }

        // ── Leaf / self-closing nodes ─────────────────────────────────────────
        if (
          node.type === "linebreak" ||
          node.type === "tab" ||
          node.type === "upload" ||
          node.type === "horizontalrule"
        ) {
          return (
            <React.Fragment key={nodeKey}>{renderElement(node)}</React.Fragment>
          );
        }

        // ── Paragraph inside a link: unwrap to inline text ────────────────────
        if (node.type === "paragraph" && isInsideLink) {
          return (
            <React.Fragment key={nodeKey}>
              {serialize(node.children, undefined, true)}
              {"\n"}
            </React.Fragment>
          );
        }

        // ── List: pass listType down to listitem children ────────────────────
        if (node.type === "list") {
          const serializedChildren = serialize(node.children, node.listType);
          return (
            <React.Fragment key={nodeKey}>
              {renderElement(node, serializedChildren)}
            </React.Fragment>
          );
        }

        // ── List item: inject parentListType so renderer knows bullet vs number
        if (node.type === "listitem") {
          const nodeWithListType = parentListType
            ? { ...node, listType: parentListType }
            : node;
          return (
            <React.Fragment key={nodeKey}>
              {renderElement(nodeWithListType, serialize(node.children))}
            </React.Fragment>
          );
        }

        // ── All other element nodes (paragraph, heading, quote, link…) ───────
        const childIsInsideLink = node.type === "link" || isInsideLink;
        return (
          <React.Fragment key={nodeKey}>
            {renderElement(
              node,
              serialize(node?.children, undefined, childIsInsideLink)
            )}
          </React.Fragment>
        );
      }),
    [renderElement, renderText, renderBlock]
  );

  // Serializing walks the whole document tree recursively; memoize so
  // unrelated re-renders of the screen don't rebuild the article JSX.
  const rendered = React.useMemo(
    () => serialize(content?.root?.children),
    [serialize, content]
  );

  return <>{rendered}</>;
}
