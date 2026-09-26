import assert from "node:assert/strict";
import test from "node:test";
import { treeFromApiConversation } from "../src/content/features/conversationOutline/apiOutline.ts";
import { exactOutlineElement, bindOutlineItems, messageIdFromElement } from "../src/content/features/conversationOutline/domOutline.ts";

test("aggregate navigation requires unique full text, body and unit without changing identity", () => {
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, Node: globalThis.Node };
  let owner = null;
  let count = 1;
  let units;
  const body = { closest: () => owner, contains: h => headings.includes(h) };
  const makeHeading = text => ({
    textContent: text, matches: () => false, closest: () => null,
    getBoundingClientRect: () => ({ width: 100, height: 24 }),
    compareDocumentPosition: () => 0
  });
  let headings = [makeHeading("本轮岗位筛选")];
  const unit = {
    getAttribute: name => name === "data-chatgpt-search-message-ids" ? "tool tool final" :
      name === "data-chatgpt-search-unit-key" ? "turn:assistant" : null,
    querySelectorAll: selector => selector.includes("h1") ? headings : Array(count).fill(body)
  };
  units = [unit];
  globalThis.document = {
    querySelector: selector => selector === '[data-chatgpt-search-message-ids~="final"]' ? unit : null,
    querySelectorAll: selector => selector === '[data-chatgpt-search-message-ids~="final"]' ? units : []
  };
  globalThis.getComputedStyle = () => ({ visibility: "visible", display: "block" });
  globalThis.Node = { DOCUMENT_POSITION_PRECEDING: 2 };
  const item = { id: "heading", kind: "heading", source: "api", messageId: "final", headingIndex: 0, label: "本轮岗位筛选", element: null };
  try {
    assert.equal(exactOutlineElement(item), headings[0]);
    const bound = bindOutlineItems([item])[0];
    assert.equal(bound.element, headings[0]);
    assert.equal(bound.messageId, "final");
    assert.equal(messageIdFromElement(unit), null);
    assert.equal(exactOutlineElement({ ...item, messageId: "unrelated" }), null);
    assert.equal(exactOutlineElement({ ...item, source: "dom" }), null);
    assert.equal(exactOutlineElement({ ...item, headingIndex: 1 }), headings[0]);
    headings.push(makeHeading("值得进一步考虑的岗位"), makeHeading("嵌套子标题"), makeHeading("结合昨天申请进度，今天怎么安排？"));
    for (const [domIndex, apiIndex] of [[1, 4], [3, 9]]) {
      assert.equal(exactOutlineElement({ ...item, label: headings[domIndex].textContent, headingIndex: apiIndex }), headings[domIndex]);
    }
    headings.splice(1);
    assert.equal(exactOutlineElement({ ...item, label: "本轮..." }), null);
    headings.push(makeHeading("本轮岗位筛选"));
    assert.equal(exactOutlineElement(item), null);
    headings.pop();
    for (const attribute of ["data-message-id", "data-chatgpt-selection-message-id"]) {
      headings[0].closest = selector => selector.includes(attribute) ? { getAttribute: () => "other" } : null;
      assert.equal(exactOutlineElement(item), null, "nested ownership must block fallback");
    }
    headings[0].closest = () => null;
    const fullText = "Long heading ".repeat(12).trim();
    const tree = treeFromApiConversation("conversation", {
      current_node: "final",
      mapping: {
        final: { id: "final", parent: null, children: [], message: {
          id: "final", author: { role: "assistant" },
          content: { content_type: "text", parts: ["## " + fullText] }
        }}
      }
    });
    const longItem = tree.nodes.get("final").outlineItems[0];
    assert.notEqual(longItem.label, fullText);
    assert.equal(longItem.fullHeadingText, fullText);
    headings = [makeHeading(fullText)];
    assert.equal(exactOutlineElement(longItem), headings[0]);
    assert.equal(bindOutlineItems([longItem])[0].fullHeadingText, fullText);
    headings.push(makeHeading(fullText + " different suffix"));
    assert.equal(exactOutlineElement(longItem), headings[0], "same truncated prefix is not a full match");
    headings.push(makeHeading(fullText));
    assert.equal(exactOutlineElement(longItem), null, "duplicate full text remains ambiguous");
    headings = [makeHeading(item.label)];
    count = 2;
    assert.equal(exactOutlineElement(item), null);
    count = 1;
    owner = { getAttribute: () => "other" };
    assert.equal(exactOutlineElement(item), null);
    owner = null;
    units = [unit, unit];
    assert.equal(exactOutlineElement(item), null);
  } finally {
    Object.assign(globalThis, saved);
  }
});
