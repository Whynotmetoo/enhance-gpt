import assert from "node:assert/strict";
import test from "node:test";
import {
  correctActiveBranchFromDom,
  resolveActiveBranchNodeId
} from "../src/content/features/conversationOutline/activeBranch.ts";
import { mergeDomOutlineTurns } from "../src/content/features/conversationOutline/tree.ts";

function node(id, { children = [], domTurnId = null, messageId = id, parentId = null, role = "assistant" } = {}) {
  return {
    children,
    domTurnId,
    element: null,
    id,
    messageId,
    outlineItems: [],
    parentId,
    role
  };
}

function tree(nodes, activeNodeId) {
  return {
    activeNodeId,
    conversationId: "conversation-1",
    nodes: new Map(nodes.map((entry) => [entry.id, entry])),
    rootIds: nodes.filter((entry) => entry.parentId === null).map((entry) => entry.id)
  };
}

function turn(id, { domTurnId = null, hasMountedMessage = false, outlineWeight = 0, parentId = null, role = "assistant" } = {}) {
  return {
    domTurnId,
    element: null,
    hasMountedMessage,
    id,
    outlineItems: [],
    outlineWeight,
    parentId,
    role
  };
}

test("returns the original tree when DOM has no active-branch evidence", () => {
  const original = tree([node("answer-1")], "answer-1");

  assert.equal(correctActiveBranchFromDom(original, [], "api"), original);
});

test("DOM correction only replaces activeNodeId", () => {
  const user = node("user-1", { children: ["answer-1", "answer-2"], messageId: "user-1", role: "user" });
  const answer1 = node("answer-1", { parentId: "user-1" });
  const answer2 = node("answer-2", { parentId: "user-1" });
  const original = tree([user, answer1, answer2], "answer-1");
  const originalEntries = [...original.nodes.entries()];
  const originalRootIds = original.rootIds;

  const corrected = correctActiveBranchFromDom(
    original,
    [
      turn("user-1", { parentId: null, role: "user" }),
      turn("answer-1", { outlineWeight: 1, parentId: "user-1" }),
      turn("answer-2", { outlineWeight: 3, parentId: "user-1" })
    ],
    "dom"
  );

  assert.notEqual(corrected, original);
  assert.equal(corrected.activeNodeId, "answer-2");
  assert.equal(original.activeNodeId, "answer-1");
  assert.equal(corrected.nodes, original.nodes);
  assert.equal(corrected.rootIds, originalRootIds);
  assert.deepEqual([...corrected.nodes.entries()], originalEntries);
});

test("API mode prefers the mounted assistant that belongs to the API tree", () => {
  const original = tree(
    [
      node("user-1", { children: ["answer-1", "answer-2"], role: "user" }),
      node("answer-1", { parentId: "user-1" }),
      node("answer-2", { parentId: "user-1" })
    ],
    "answer-1"
  );

  assert.equal(
    resolveActiveBranchNodeId(
      original,
      [
        turn("user-1", { role: "user" }),
        turn("answer-2", { hasMountedMessage: true, parentId: "user-1" })
      ],
      "api"
    ),
    "answer-2"
  );
});

test("API mode follows a unique descendant chain from the latest mounted user", () => {
  const original = tree(
    [
      node("user-1", { children: ["answer-1"], role: "user" }),
      node("answer-1", { children: ["user-2"], parentId: "user-1" }),
      node("user-2", { children: ["answer-2"], parentId: "answer-1", role: "user" }),
      node("answer-2", { parentId: "user-2" })
    ],
    "answer-1"
  );

  assert.equal(
    resolveActiveBranchNodeId(original, [turn("user-2", { parentId: "answer-1", role: "user" })], "api"),
    "answer-2"
  );
});

test("API mode retains the current active node when descendant evidence is ambiguous", () => {
  const original = tree(
    [
      node("user-1", { children: ["answer-1", "answer-2"], role: "user" }),
      node("answer-1", { parentId: "user-1" }),
      node("answer-2", { parentId: "user-1" })
    ],
    "answer-1"
  );

  assert.equal(resolveActiveBranchNodeId(original, [turn("user-1", { role: "user" })], "api"), "answer-1");
});

test("virtualized assistant shells resolve to the canonical message node", () => {
  const canonical = node("message-1", {
    children: ["user-2"],
    domTurnId: "turn-1",
    messageId: "message-1",
    parentId: "user-1"
  });
  canonical.outlineItems.push({ id: "heading-1" });
  const original = tree(
    [node("user-1", { children: ["message-1"], role: "user" }), canonical, node("user-2", { parentId: "message-1", role: "user" })],
    "user-2"
  );

  assert.equal(
    resolveActiveBranchNodeId(
      original,
      [turn("turn-1", { domTurnId: "turn-1", hasMountedMessage: false, parentId: "user-1" })],
      "dom"
    ),
    "message-1"
  );
});

test("DOM data merge never changes activeNodeId", () => {
  const original = tree([node("user-1", { children: ["answer-1"], role: "user" }), node("answer-1", { parentId: "user-1" })], "answer-1");

  const merged = mergeDomOutlineTurns(original, [turn("answer-2", { parentId: "user-1" })]);

  assert.equal(merged.activeNodeId, "answer-1");
});
