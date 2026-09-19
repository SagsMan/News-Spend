import type { Media } from "@news-spend-media/payload/types";

export type AbstractNode<Type extends string> = {
  format?: "" | "start" | "center" | "right" | "justify" | number;
  type: Type;
  version: number;
};

export type AbstractElementNode<Type extends string> = {
  direction: "ltr" | "rtl" | null;
  indent: number;
} & AbstractNode<Type>;

export type AbstractTextNode<Type extends string> = {
  detail: number;
  format: "" | number;
  mode: "normal";
  style: string;
  text: string;
} & AbstractNode<Type>;

export type BlockNode<
  BlockData extends Record<string, unknown>,
  BlockType extends string,
> = {
  fields: {
    id: string;
    blockName: string;
    blockType: BlockType;
  } & BlockData;
} & AbstractElementNode<"block">;

type UnknownBlockNode = {
  fields: {
    id: string;
    blockName: string;
    blockType: string;
    [key: string]: unknown;
  };
} & AbstractNode<"block">;

/**
 * Inline block (Payload 3.x SerializedInlineBlockNode, `type: "inlineBlock"`).
 * Inserted mid-paragraph/heading: appears as a child of paragraph/heading
 * nodes, not at root. Emitted only when a block is registered as inline-capable
 * via BlocksFeature. Unlike top-level blocks, fields carry no `blockName`.
 */
export type InlineBlockNode = {
  fields: {
    id: string;
    blockType: string;
    [key: string]: unknown;
  };
} & AbstractNode<"inlineBlock">;

export type Root = {
  children: Node[];
} & AbstractElementNode<"root">;

export type Mark = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  highlight?: boolean;
};

export type TextNode = AbstractTextNode<"text">;
export type Linebreak = AbstractNode<"linebreak">;
export type Horizontalrule = AbstractNode<"horizontalrule">;
export type Tab = AbstractTextNode<"tab">;

export type LinkNode = {
  children: TextNode[];
  fields:
    | {
        linkType: "custom";
        newTab: boolean;
        url: string;
      }
    | {
        doc: {
          relationTo: string;
          value: unknown;
        };
        linkType: "internal";
        newTab: boolean;
        url: string;
      };
} & AbstractElementNode<"link">;

export type AutoLinkNode = {
  children: TextNode[];
  fields: {
    linkType: "custom";
    newTab?: boolean;
    url: string;
  };
} & AbstractElementNode<"autolink">;

export type HeadingNode = {
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  children: TextNode[];
} & AbstractElementNode<"heading">;

export type ParagraphNode = {
  children: (TextNode | Linebreak | Tab | LinkNode | AutoLinkNode)[];
} & AbstractElementNode<"paragraph">;

export type ListItemNode = {
  children: (TextNode | ListNode)[];
  /** 1-based counter used for ordered lists */
  value: number;
  /** Present on checklist items */
  checked?: boolean;
  /** Inherited from parent list, passed down by serializer */
  listType?: "number" | "bullet" | "check";
} & AbstractElementNode<"listitem">;

export type ListNode = {
  tag: "ul" | "ol";
  listType: "number" | "bullet" | "check";
  start: number;
  children: ListItemNode[];
} & AbstractElementNode<"list">;

export type QuoteNode = {
  children: TextNode[];
} & AbstractElementNode<"quote">;

export type UploadNode<MediaType = Media> = {
  fields: null;
  relationTo: "media";
  /** May be an unpopulated number if depth is insufficient */
  value: MediaType | number;
} & AbstractElementNode<"upload">;

/**
 * Relationship node (Payload 3.x SerializedRelationshipNode,
 * `type: "relationship"`). Inline reference to another collection's document.
 * Emitted only when RelationshipFeature is configured. `value` is the populated
 * doc, or a raw id (number/string) when depth is insufficient.
 */
export type RelationshipNode = {
  relationTo: string;
  value: Record<string, unknown> | number | string;
} & AbstractNode<"relationship">;

export type Node =
  | HeadingNode
  | ParagraphNode
  | UploadNode
  | RelationshipNode
  | TextNode
  | ListNode
  | ListItemNode
  | QuoteNode
  | Linebreak
  | Tab
  | LinkNode
  | UnknownBlockNode
  | InlineBlockNode
  | Horizontalrule
  | AutoLinkNode;

export type ElementRenderers = {
  heading: (
    props: { children: React.ReactNode } & Omit<HeadingNode, "children">
  ) => React.ReactNode;
  list: (
    props: { children: React.ReactNode } & Omit<ListNode, "children">
  ) => React.ReactNode;
  listItem: (
    props: { children: React.ReactNode } & Omit<ListItemNode, "children">
  ) => React.ReactNode;
  paragraph: (
    props: { children: React.ReactNode } & Omit<ParagraphNode, "children">
  ) => React.ReactNode;
  quote: (
    props: { children: React.ReactNode } & Omit<QuoteNode, "children">
  ) => React.ReactNode;
  link: (
    props: { children: React.ReactNode } & Omit<LinkNode, "children">
  ) => React.ReactNode;
  autolink: (
    props: { children: React.ReactNode } & Omit<AutoLinkNode, "children">
  ) => React.ReactNode;
  linebreak: () => React.ReactNode;
  tab: () => React.ReactNode;
  horizontalrule: () => React.ReactNode;
  upload: (props: UploadNode) => React.ReactNode;
};

export type RenderMark = (mark: Mark) => React.ReactNode;

export type BlockRenderers<Blocks extends { [key: string]: any }> = {
  [BlockName in Extract<keyof Blocks, string>]?: (
    props: BlockNode<Blocks[BlockName], BlockName>
  ) => React.ReactNode;
};

export type PayloadLexicalReactRendererContent = {
  root: Root;
};

export type PayloadLexicalReactRendererProps<
  Blocks extends { [key: string]: any },
> = {
  content: PayloadLexicalReactRendererContent;
  elementRenderers?: ElementRenderers;
  renderMark?: RenderMark;
  blockRenderers?: BlockRenderers<Blocks>;
};

// Legacy: kept for any usage of the old serializer.tsx (can be removed)
export type SerializedLexicalEditorState = {
  root: {
    type: string;
    format: string;
    indent: number;
    version: number;
    children: SerializedLexicalNode[];
  };
};

export type SerializedLexicalNode = {
  children?: SerializedLexicalNode[];
  direction: string;
  format: number;
  indent?: string | number;
  type: string;
  version: number;
  style?: string;
  mode?: string;
  text?: string;
  [other: string]: any;
};
