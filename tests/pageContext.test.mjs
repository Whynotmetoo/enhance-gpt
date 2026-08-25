import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const pageContextSource = readFileSync(new URL("../public/page-context.js", import.meta.url), "utf8");

function createPageContextHarness(conversation) {
  const listeners = new Map();
  const postedMessages = [];
  const location = {
    href: "https://chatgpt.com/c/conversation-1",
    origin: "https://chatgpt.com"
  };
  const window = {
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    clearTimeout,
    fetch: async () => Response.json(conversation),
    history: {
      pushState() {},
      replaceState() {}
    },
    location,
    postMessage(data, origin) {
      postedMessages.push({ data, origin });
    },
    queueMicrotask,
    setTimeout
  };

  vm.runInNewContext(pageContextSource, {
    console,
    Date,
    document: { currentScript: null },
    Headers,
    Map,
    Request,
    Response,
    Set,
    URL,
    window
  });

  return {
    async captureConversation(path) {
      await window.fetch(path);
      await new Promise((resolve) => setImmediate(resolve));

      const requestId = `request-${path}`;
      const event = {
        data: {
          conversationId: "conversation-1",
          minCapturedAt: 0,
          requestId,
          source: "enhance-gpt:fetch-conversation"
        },
        origin: location.origin,
        source: window
      };
      listeners.get("message")?.forEach((listener) => listener(event));
      await new Promise((resolve) => setImmediate(resolve));

      return postedMessages.find((message) => message.data.requestId === requestId)?.data;
    },
    conversation
  };
}

for (const { body, path } of [
  {
    body: {
      current_node: "assistant-1",
      mapping: {
        "assistant-1": { id: "assistant-1" }
      }
    },
    path: "/backend-api/conversation/conversation-1"
  },
  {
    body: {
      current_node: "assistant-1",
      messages: [{ id: "assistant-1" }],
      page_info: { has_previous_page: true, start_cursor: "previous-page" }
    },
    path: "/backend-api/conversations/conversation-1"
  }
]) {
  test(`captures conversation detail responses from ${path}`, async () => {
    const harness = createPageContextHarness(body);
    const response = await harness.captureConversation(path);

    assert.equal(response?.ok, true);
    assert.equal(response?.body.current_node, harness.conversation.current_node);
    assert.deepEqual(response?.body, harness.conversation);
  });
}
