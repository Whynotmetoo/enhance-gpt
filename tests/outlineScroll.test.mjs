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

test("resolves explicit rendered message ids and excludes role labels from headings", async () => {
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
    querySelectorAll: selector => {
      assert.ok(selector.includes('[data-markdown-text-style="assistant-message"] :is('));
      assert.ok(selector.includes(".markdown :is("));
      return [roleLabel, heading];
    }
  };
  globalThis.document = {
    querySelector(selector) {
      return selector === '[data-chatgpt-selection-message-id="message-1"]' ? message : null;
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

test("aggregate search ids never select an intermediate tool message", async () => {
  const { messageIdFromElement } = await import("../src/content/features/conversationOutline/domOutline.ts");
  const unit = (tokens, renderedIds = []) => ({
    getAttribute: name => name === "data-chatgpt-search-message-ids" ? tokens : null,
    querySelectorAll: () => renderedIds.map(id => ({
      closest: () => ({ getAttribute: () => id })
    }))
  });
  assert.equal(messageIdFromElement(unit("tool final", ["final"])), "final");
  assert.equal(messageIdFromElement(unit("tool final")), null);
  assert.equal(messageIdFromElement(unit("final final")), "final");
  assert.equal(messageIdFromElement(unit("tool a b", ["a", "b"])), null);
});

test("busy transcripts still scroll toward unmounted targets and respect the deadline", async () => {
  const { nextPendingScroll } = await import("../src/content/features/conversationOutline/scroll.ts");
  const savedDocument = globalThis.document;
  const savedWindow = globalThis.window;
  const calls = [];
  const container = {
    scrollTop: 0, scrollHeight: 10000, clientHeight: 500,
    matches: () => false, querySelector: () => ({}), querySelectorAll: () => [],
    scrollTo: options => calls.push(options)
  };
  const anchor = {
    isConnected: true, parentElement: container,
    getBoundingClientRect: () => ({ top: 0, bottom: 100 })
  };
  globalThis.document = { querySelector: () => null, scrollingElement: container };
  globalThis.window = {
    innerHeight: 500,
    getComputedStyle: () => ({ overflowY: "auto", flexDirection: "column" })
  };
  try {
    const items = [
      { id: "a", kind: "user", messageId: "a", element: anchor, level: 1 },
      { id: "b", kind: "user", messageId: "b", element: null, level: 1 }
    ];
    const pending = { id: "b", index: 1, attempts: 3, startedAt: Date.now() };
    assert.equal(nextPendingScroll(items, pending).attempts, 3);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].top > 0);
    assert.equal(nextPendingScroll(items, { ...pending, startedAt: Date.now() - 60001 }), null);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.document = savedDocument;
    globalThis.window = savedWindow;
  }
});
