import type { DomOutlineTurn, OutlineTree, OutlineTreeNode } from "./types";

export type ActiveBranchMode = "api" | "dom";

function outlineTurnWeight(turn: DomOutlineTurn): number {
  return turn.outlineWeight ?? turn.outlineItems.length;
}

function uniqueDescendantLeafId(nodes: ReadonlyMap<string, OutlineTreeNode>, nodeId: string): string | null {
  const seen = new Set<string>();
  let currentId = nodeId;

  while (!seen.has(currentId)) {
    seen.add(currentId);
    const node = nodes.get(currentId);
    if (!node) {
      return currentId;
    }

    const existingChildren = node.children.filter((childId) => nodes.has(childId));
    if (existingChildren.length === 0) {
      return currentId;
    }

    if (existingChildren.length > 1) {
      return null;
    }

    currentId = existingChildren[0];
  }

  return nodeId;
}

function activeDomTurnId(pathTurns: DomOutlineTurn[]): string {
  const lastTurn = pathTurns[pathTurns.length - 1];
  const branchParentId = lastTurn.parentId;
  if (!branchParentId || lastTurn.role !== "assistant") {
    return lastTurn.id;
  }

  let firstBranchIndex = pathTurns.length - 1;
  while (
    firstBranchIndex > 0 &&
    pathTurns[firstBranchIndex - 1].role === lastTurn.role &&
    pathTurns[firstBranchIndex - 1].parentId === branchParentId
  ) {
    firstBranchIndex -= 1;
  }

  return pathTurns.slice(firstBranchIndex).reduce((best, turn) =>
    outlineTurnWeight(turn) >= outlineTurnWeight(best) ? turn : best
  ).id;
}

function activeApiDomTurnId(tree: OutlineTree, pathTurns: DomOutlineTurn[]): string {
  const mountedAssistant = [...pathTurns]
    .reverse()
    .find((turn) => turn.role === "assistant" && turn.hasMountedMessage && tree.nodes.has(turn.id));
  if (mountedAssistant) {
    return mountedAssistant.id;
  }

  const userAnchor = [...pathTurns]
    .reverse()
    .find((turn) => turn.role === "user" && tree.nodes.has(turn.id));
  if (userAnchor) {
    return uniqueDescendantLeafId(tree.nodes, userAnchor.id) ?? (tree.activeNodeId ?? userAnchor.id);
  }

  return activeDomTurnId(pathTurns);
}

function remappedParentId(
  parentId: string | null | undefined,
  idAliases: ReadonlyMap<string, string>
): string | null | undefined {
  return parentId ? (idAliases.get(parentId) ?? parentId) : parentId;
}

function isVirtualizedAssistantShell(turn: DomOutlineTurn): boolean {
  return turn.role === "assistant" && !turn.hasMountedMessage && turn.outlineItems.length === 0 && Boolean(turn.domTurnId);
}

function isRequestPlaceholderNode(node: OutlineTreeNode): boolean {
  return node.id.startsWith("request-placeholder-") || Boolean(node.messageId?.startsWith("request-placeholder-"));
}

function isCanonicalAssistantCandidate(node: OutlineTreeNode, turn: DomOutlineTurn): boolean {
  return (
    node.role === "assistant" &&
    node.domTurnId === turn.domTurnId &&
    node.id !== turn.id &&
    !isRequestPlaceholderNode(node) &&
    (node.children.length > 0 || node.outlineItems.length > 0 || Boolean(node.messageId))
  );
}

function uniqueNodeId(nodes: OutlineTreeNode[]): string | null {
  return nodes.length === 1 ? nodes[0].id : null;
}

function uniqueNodeIdByPriority(
  nodes: OutlineTreeNode[],
  ...priorities: Array<(node: OutlineTreeNode) => boolean>
): string | null {
  for (const matchesPriority of priorities) {
    const matchingNodes = nodes.filter(matchesPriority);
    if (matchingNodes.length > 0) {
      return uniqueNodeId(matchingNodes);
    }
  }

  return null;
}

function canonicalAssistantNodeIdForDomTurn(
  nodes: ReadonlyMap<string, OutlineTreeNode>,
  turn: DomOutlineTurn
): string | null {
  if (turn.role !== "assistant" || !turn.domTurnId) {
    return null;
  }

  const matchingNodes = Array.from(nodes.values()).filter((node) => isCanonicalAssistantCandidate(node, turn));

  return uniqueNodeIdByPriority(
    matchingNodes,
    (node) => node.children.length > 0 && node.outlineItems.length > 0,
    (node) => node.children.length > 0,
    (node) => node.outlineItems.length > 0,
    (node) => Boolean(node.messageId)
  );
}

function existingNodeIdForDomTurn(nodes: ReadonlyMap<string, OutlineTreeNode>, turn: DomOutlineTurn): string | null {
  if (isVirtualizedAssistantShell(turn)) {
    return canonicalAssistantNodeIdForDomTurn(nodes, turn) ?? (nodes.has(turn.id) ? turn.id : null);
  }

  return nodes.has(turn.id) ? turn.id : null;
}

function activeBranchTurns(tree: OutlineTree, turns: DomOutlineTurn[]): DomOutlineTurn[] {
  const idAliases = new Map<string, string>();

  return turns
    .filter((turn) => turn.id.length > 0)
    .map((turn) => {
      const parentId = remappedParentId(turn.parentId, idAliases);
      const replacementId = existingNodeIdForDomTurn(tree.nodes, turn);
      const id = replacementId ?? turn.id;

      if (id !== turn.id) {
        idAliases.set(turn.id, id);
      }

      return id === turn.id && parentId === turn.parentId ? turn : { ...turn, id, parentId };
    });
}

export function resolveActiveBranchNodeId(
  tree: OutlineTree,
  turns: DomOutlineTurn[],
  mode: ActiveBranchMode
): string | null {
  const pathTurns = activeBranchTurns(tree, turns);
  if (pathTurns.length === 0) {
    return tree.activeNodeId;
  }

  return mode === "api" ? activeApiDomTurnId(tree, pathTurns) : activeDomTurnId(pathTurns);
}

export function correctActiveBranchFromDom(
  tree: OutlineTree,
  turns: DomOutlineTurn[],
  mode: ActiveBranchMode
): OutlineTree {
  const activeNodeId = resolveActiveBranchNodeId(tree, turns, mode);
  return activeNodeId === tree.activeNodeId ? tree : { ...tree, activeNodeId };
}
