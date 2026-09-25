import assert from "node:assert/strict";
import test from "node:test";
import { clampScrollTop } from "../src/content/features/conversationOutline/scroll.ts";

test("clamps normal and reverse-flex scroll coordinates without losing negative offsets", () => {
  const saved = globalThis.window;
  let direction = "column";
  globalThis.window = { getComputedStyle: () => ({ flexDirection: direction }) };
  const container = { scrollHeight: 2000, clientHeight: 500 };
  try {
    assert.equal(clampScrollTop(container, 700), 700);
    assert.equal(clampScrollTop(container, -700), 0);
    assert.equal(clampScrollTop(container, 2500), 1500);
    direction = "column-reverse";
    assert.equal(clampScrollTop(container, -700), -700);
    assert.equal(clampScrollTop(container, -2500), -1500);
    assert.equal(clampScrollTop(container, 100), 0);
    assert.equal(clampScrollTop({ scrollHeight: 500, clientHeight: 500 }, -100), 0);
  } finally {
    globalThis.window = saved;
  }
});

test("resolves new message-id token lists and excludes role labels from headings", async () => {
  const { exactOutlineElement } = await import("../src/content/features/conversationOutline/domOutline.ts");
  const savedDocument = globalThis.document;
  const savedStyle = globalThis.getComputedStyle;
  const heading = {
    matches: () => false, closest: () => null,
    getBoundingClientRect: () => ({ width: 100, height: 24 })
  };
  const roleLabel = { matches: () => true };
  const message = {
    hasAttribute: name => name === "data-chatgpt-search-message-ids",
    closest: () => null,
    querySelectorAll: () => [roleLabel, heading]
  };
  globalThis.document = {
    querySelector(selector) {
      return selector === '[data-chatgpt-search-message-ids~="message-1"]' ? message : null;
    }
  };
  globalThis.getComputedStyle = () => ({ visibility: "visible", display: "block" });
  try {
    assert.equal(exactOutlineElement({ messageId: "message-1", headingIndex: null }), message);
    assert.equal(exactOutlineElement({ messageId: "message-1", headingIndex: 0 }), heading);
  } finally {
    globalThis.document = savedDocument;
    globalThis.getComputedStyle = savedStyle;
  }
});

test("targets the preceding user turn shell for an unmounted answer heading", async () => {
  const { targetTurnShell } = await import("../src/content/features/conversationOutline/scroll.ts");
  const saved = globalThis.document;
  const shell = {};
  globalThis.document = { querySelector: selector => selector === '[data-turn-key="user-2"]' ? shell : null };
  try {
    const items = [{ kind: "user", messageId: "user-1" }, { kind: "user", messageId: "user-2" }, { kind: "heading", messageId: "answer-2" }];
    assert.equal(targetTurnShell(items, 2), shell);
    assert.equal(targetTurnShell(items, 1), shell);
    assert.equal(targetTurnShell(items, 0), null);
  } finally { globalThis.document = saved; }
});

test("counts eight stalled checks but resets for mounted messages or changed scroll range", async () => {
  const { pendingScrollAttempts } = await import("../src/content/features/conversationOutline/scroll.ts");
  const { maxPendingScrollAttempts } = await import("../src/content/features/conversationOutline/constants.ts");
  const previous = { attempts: 7, lastScrollTop: -500, lastScrollHeight: 2000, lastMountedMessages: "a|b" };
  const current = { position: -500, height: 2000, messages: "a|b", loading: false };
  assert.equal(maxPendingScrollAttempts, 8);
  assert.equal(pendingScrollAttempts(previous, current), 8);
  assert.equal(pendingScrollAttempts(previous, { ...current, messages: "b|c" }), 0);
  assert.equal(pendingScrollAttempts(previous, { ...current, height: 2500 }), 0);
  assert.equal(pendingScrollAttempts(previous, { ...current, position: -600 }), 0);
  assert.equal(pendingScrollAttempts(previous, { ...current, loading: true }), 7);
});
