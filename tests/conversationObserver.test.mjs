import assert from "node:assert/strict";
import test from "node:test";
import { observeConversationMutations } from "../src/content/features/conversationOutline/domOutline.ts";

test("conversation mutation observation follows a replaced thread root", () => {
  const originalDocument = globalThis.document;
  const originalMutationObserver = globalThis.MutationObserver;
  const body = { id: "body" };
  const firstRoot = { id: "first-root" };
  const secondRoot = { id: "second-root" };
  let currentRoot = firstRoot;

  class FakeMutationObserver {
    static instances = [];

    constructor(callback) {
      this.callback = callback;
      this.disconnectCount = 0;
      this.observations = [];
      FakeMutationObserver.instances.push(this);
    }

    disconnect() {
      this.disconnectCount += 1;
    }

    observe(target, options) {
      this.observations.push({ options, target });
    }

    trigger() {
      this.callback([], this);
    }
  }

  globalThis.document = {
    body,
    querySelector(selector) {
      return selector === "#thread" ? currentRoot : null;
    }
  };
  globalThis.MutationObserver = FakeMutationObserver;

  try {
    let scheduledUpdates = 0;
    let immediateUpdates = 0;
    const stop = observeConversationMutations(
      () => {
        scheduledUpdates += 1;
      },
      () => {
        immediateUpdates += 1;
      }
    );
    const [conversationObserver, rootObserver] = FakeMutationObserver.instances;

    assert.equal(immediateUpdates, 1);
    assert.equal(conversationObserver.observations[0].target, firstRoot);
    assert.deepEqual(rootObserver.observations, [
      {
        options: { childList: true, subtree: true },
        target: body
      }
    ]);

    currentRoot = secondRoot;
    rootObserver.trigger();

    assert.equal(conversationObserver.disconnectCount, 1);
    assert.equal(conversationObserver.observations.at(-1).target, secondRoot);
    assert.equal(immediateUpdates, 2);

    rootObserver.trigger();
    assert.equal(conversationObserver.disconnectCount, 1);
    assert.equal(immediateUpdates, 2);

    conversationObserver.trigger();
    assert.equal(scheduledUpdates, 1);

    stop();
    assert.equal(conversationObserver.disconnectCount, 2);
    assert.equal(rootObserver.disconnectCount, 1);
  } finally {
    globalThis.document = originalDocument;
    globalThis.MutationObserver = originalMutationObserver;
  }
});
