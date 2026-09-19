/**
 * Recursively walks Lexical content and removes ReadAlso blocks whose
 * referenced news article is no longer published or has been deleted.
 *
 * This runs after `payload.find` with depth population, so the relationship
 * data is already resolved. We only check the in-memory value, no extra DB
 * queries.
 */

type LexicalNode = {
  type?: string;
  children?: LexicalNode[];
  fields?: Record<string, unknown>;
  [key: string]: unknown;
};

function isStaleReadAlso(node: LexicalNode): boolean {
  if (node.type !== "block") {
    return false;
  }

  const fields = node.fields;
  if (fields?.blockType !== "readAlso") {
    return false;
  }

  const news = fields.news;

  // Deleted or unpopulated: value is null or a raw ID number
  if (!news || typeof news !== "object") {
    return true;
  }

  // Unpublished: full object but not in published state
  if ((news as Record<string, unknown>)._status !== "published") {
    return true;
  }

  return false;
}

function sanitizeNodes(nodes: LexicalNode[]): LexicalNode[] {
  if (!Array.isArray(nodes)) {
    return nodes;
  }

  return nodes
    .filter((node) => !isStaleReadAlso(node))
    .map((node) => {
      if (Array.isArray(node.children)) {
        return { ...node, children: sanitizeNodes(node.children) };
      }
      return node;
    });
}

/**
 * Removes stale ReadAlso blocks from Lexical rich text content.
 * Returns the content unchanged if it's not a valid Lexical tree.
 */
export function sanitizeContent<
  T extends Record<string, unknown> | null | undefined,
>(content: T): T {
  if (!content || typeof content !== "object") {
    return content;
  }

  const root = content.root;
  if (!root || typeof root !== "object") {
    return content;
  }

  const children = (root as Record<string, unknown>).children;
  if (!Array.isArray(children)) {
    return content;
  }

  return {
    ...content,
    root: {
      ...root,
      children: sanitizeNodes(children),
    },
  } as T;
}
