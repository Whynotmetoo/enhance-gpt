import type { OutlineItem, OutlineMode, OutlineTree, OutlineTreeNode } from "./types";

export type CachedOutlineTree = {
  mode: OutlineMode;
  tree: OutlineTree;
};

const maxCachedOutlineTrees = 100;
const outlineTreeCache = new Map<string, CachedOutlineTree>();

function cloneOutlineItemWithoutElement(item: OutlineItem): OutlineItem {
  return {
    ...item,
    containerElement: null,
    element: null
  };
}

function cloneNodeWithoutElement(node: OutlineTreeNode): OutlineTreeNode {
  return {
    ...node,
    children: [...node.children],
    element: null,
    outlineItems: node.outlineItems.map(cloneOutlineItemWithoutElement)
  };
}

function cloneTreeWithoutElements(tree: OutlineTree): OutlineTree {
  return {
    ...tree,
    nodes: new Map(Array.from(tree.nodes.entries()).map(([id, node]) => [id, cloneNodeWithoutElement(node)])),
    rootIds: [...tree.rootIds]
  };
}

function cloneCachedOutlineTree(cached: CachedOutlineTree): CachedOutlineTree {
  return {
    mode: cached.mode,
    tree: cloneTreeWithoutElements(cached.tree)
  };
}

export function rememberOutlineTree(conversationId: string, mode: OutlineMode, tree: OutlineTree): void {
  if (tree.conversationId !== conversationId) {
    return;
  }

  outlineTreeCache.delete(conversationId);
  outlineTreeCache.set(conversationId, cloneCachedOutlineTree({ mode, tree }));

  while (outlineTreeCache.size > maxCachedOutlineTrees) {
    const oldestConversationId = outlineTreeCache.keys().next().value;
    if (!oldestConversationId) {
      return;
    }

    outlineTreeCache.delete(oldestConversationId);
  }
}

export function cachedOutlineTree(conversationId: string): CachedOutlineTree | null {
  const cached = outlineTreeCache.get(conversationId);
  return cached ? cloneCachedOutlineTree(cached) : null;
}
