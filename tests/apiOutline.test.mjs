import assert from "node:assert/strict";
import test from "node:test";
import { treeFromApiConversation } from "../src/content/features/conversationOutline/apiOutline.ts";

test("builds an outline tree from the complete conversation mapping response", () => {
  const tree = treeFromApiConversation("conversation-1", {
    current_node: "assistant-1",
    mapping: {
      root: {
        id: "root",
        message: null,
        parent: null,
        children: ["user-1"]
      },
      "user-1": {
        id: "user-1",
        parent: "root",
        children: ["assistant-1"],
        message: {
          id: "user-1",
          author: { role: "user" },
          content: { content_type: "text", parts: ["Question"] }
        }
      },
      "assistant-1": {
        id: "assistant-1",
        parent: "user-1",
        children: [],
        message: {
          id: "assistant-1",
          author: { role: "assistant" },
          content: { content_type: "text", parts: ["## Answer"] }
        }
      }
    }
  });

  assert.equal(tree?.activeNodeId, "assistant-1");
  assert.equal(tree?.nodes.size, 3);
  assert.deepEqual(
    tree ? Array.from(tree.nodes.values()).flatMap((node) => node.outlineItems.map((item) => item.label)) : [],
    ["Question", "Answer"]
  );
});

test("rejects the paginated conversation response as an incomplete API tree", () => {
  const tree = treeFromApiConversation("conversation-1", {
    current_node: "assistant-1",
    messages: [{ id: "assistant-1" }],
    page_info: { has_previous_page: true, start_cursor: "previous-page" }
  });

  assert.equal(tree, null);
});
