import assert from "node:assert/strict";
import test from "node:test";
import {
  cachedOutlineTree,
  rememberOutlineTree
} from "../src/content/features/conversationOutline/outlineCache.ts";

function outlineTree(conversationId, activeNodeId, element = null) {
  const item = {
    containerElement: element,
    element,
    headingIndex: null,
    id: `outline-${activeNodeId}`,
    kind: "user",
    label: activeNodeId,
    level: 1,
    messageId: activeNodeId,
    source: "api"
  };
  const node = {
    children: [],
    element,
    id: activeNodeId,
    messageId: activeNodeId,
    outlineItems: [item],
    parentId: null,
    role: "user"
  };

  return {
    activeNodeId,
    conversationId,
    nodes: new Map([[activeNodeId, node]]),
    rootIds: [activeNodeId]
  };
}

test("caches API outline trees without retaining DOM elements", () => {
  const conversationId = "cached-api-conversation";
  const element = { isConnected: true };
  const original = outlineTree(conversationId, "user-1", element);

  rememberOutlineTree(conversationId, "api", original);
  const cached = cachedOutlineTree(conversationId);

  assert.equal(cached?.mode, "api");
  assert.equal(cached?.tree.activeNodeId, "user-1");
  assert.notEqual(cached?.tree, original);
  assert.notEqual(cached?.tree.nodes, original.nodes);
  assert.notEqual(cached?.tree.rootIds, original.rootIds);
  assert.equal(cached?.tree.nodes.get("user-1")?.element, null);
  assert.equal(cached?.tree.nodes.get("user-1")?.outlineItems[0]?.element, null);
  assert.equal(cached?.tree.nodes.get("user-1")?.outlineItems[0]?.containerElement, null);
  assert.equal(original.nodes.get("user-1")?.element, element);
});

test("returns an independent clone on every cache read", () => {
  const conversationId = "independent-cache-reads";
  rememberOutlineTree(conversationId, "dom", outlineTree(conversationId, "user-1"));

  const first = cachedOutlineTree(conversationId);
  assert.ok(first);
  first.tree.activeNodeId = "changed-locally";
  first.tree.rootIds.push("changed-locally");
  first.tree.nodes.get("user-1")?.outlineItems.splice(0);

  const second = cachedOutlineTree(conversationId);
  assert.equal(second?.mode, "dom");
  assert.equal(second?.tree.activeNodeId, "user-1");
  assert.deepEqual(second?.tree.rootIds, ["user-1"]);
  assert.equal(second?.tree.nodes.get("user-1")?.outlineItems.length, 1);
});

test("updates the cached active branch for an existing conversation", () => {
  const conversationId = "active-branch-cache";
  rememberOutlineTree(conversationId, "api", outlineTree(conversationId, "answer-1"));
  rememberOutlineTree(conversationId, "api", outlineTree(conversationId, "answer-2"));

  const cached = cachedOutlineTree(conversationId);
  assert.equal(cached?.mode, "api");
  assert.equal(cached?.tree.activeNodeId, "answer-2");
  assert.equal(cached?.tree.nodes.has("answer-1"), false);
  assert.equal(cached?.tree.nodes.has("answer-2"), true);
});
