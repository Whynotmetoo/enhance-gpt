import assert from "node:assert/strict";
import test from "node:test";
import { activePathItems, mergeDomOutlineTurns } from "../src/content/features/conversationOutline/tree.ts";

function outlineItem(id, label) {
  return {
    element: null,
    headingIndex: null,
    id,
    kind: "user",
    label,
    level: 1,
    messageId: id,
    source: "dom"
  };
}

function node(id, { children = [], parentId = null, role = "assistant" } = {}) {
  return {
    children,
    element: null,
    id,
    messageId: id,
    outlineItems: [outlineItem(id, id)],
    parentId,
    role
  };
}

function turn(id, { parentId = null, role = "assistant" } = {}) {
  return {
    element: null,
    id,
    messageId: id,
    outlineItems: [outlineItem(id, id)],
    parentId,
    role
  };
}

test("DOM merge preserves ancestry when virtualization removes the beginning of the conversation", () => {
  const nodes = [
    node("user-1", { children: ["answer-1"], role: "user" }),
    node("answer-1", { children: ["user-2"], parentId: "user-1" }),
    node("user-2", { children: ["answer-2"], parentId: "answer-1", role: "user" }),
    node("answer-2", { parentId: "user-2" })
  ];
  const original = {
    activeNodeId: "answer-2",
    conversationId: "conversation-1",
    nodes: new Map(nodes.map((entry) => [entry.id, entry])),
    rootIds: ["user-1"]
  };

  const merged = mergeDomOutlineTurns(original, [
    turn("answer-1", { parentId: null }),
    turn("user-2", { parentId: "answer-1", role: "user" }),
    turn("answer-2", { parentId: "user-2" })
  ]);

  assert.equal(merged.nodes.get("answer-1").parentId, "user-1");
  assert.deepEqual(merged.rootIds, ["user-1"]);
  assert.deepEqual(activePathItems(merged).map((item) => item.label), ["user-1", "answer-1", "user-2", "answer-2"]);
});
