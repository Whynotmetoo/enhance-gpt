import assert from "node:assert/strict";
import test from "node:test";
import { collectTurnElements, conversationMutationRoot, observeConversationMutations } from "../src/content/features/conversationOutline/domOutline.ts";

function fixture(run) {
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, MutationObserver: globalThis.MutationObserver };
  const root = (visible, units = []) => ({
    visible,
    getBoundingClientRect() { return { width: this.visible ? 100 : 0, height: this.visible ? 100 : 0 }; },
    querySelectorAll: () => units
  });
  const body = root(true);
  const state = { threads: [], mains: [], observers: [] };
  globalThis.document = { body, querySelectorAll: selector => selector === "#thread" ? state.threads : state.mains };
  globalThis.getComputedStyle = () => ({ display: "flex", visibility: "visible" });
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.disconnections = 0; state.observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnections++; }
  };
  try { run({ root, body, state }); }
  finally { Object.assign(globalThis, saved); }
}

test("collection and observation ignore hidden retained mains and threads", () => fixture(({ root, state }) => {
  const latest = {};
  const hidden = root(false, [{}]);
  const visible = root(true, [latest]);
  state.threads = [hidden];
  state.mains = [hidden, visible];
  assert.equal(conversationMutationRoot(), visible);
  assert.deepEqual(collectTurnElements(), [latest]);
  const thread = root(true, [latest]);
  state.threads.push(thread);
  assert.equal(conversationMutationRoot(), thread);
}));

test("missing visible roots collect no stale turns and observe body until mounting", () => fixture(({ root, body, state }) => {
  state.mains = [root(false, [{}])];
  assert.deepEqual(collectTurnElements(), []);
  assert.equal(conversationMutationRoot(), body);
  let updates = 0;
  const stop = observeConversationMutations(() => {}, () => updates++);
  const [conversation, roots] = state.observers;
  const mounted = root(true);
  state.mains.push(mounted);
  roots.callback([{ type: "childList" }]);
  assert.equal(conversation.target, mounted);
  assert.equal(updates, 2);
  stop();
}));

test("visibility switches and repeated root replacements rebind immediately without duplicate updates", () => fixture(({ root, state }) => {
  const first = root(true);
  const second = root(false);
  state.mains = [first, second];
  let updates = 0;
  let scheduled = 0;
  const stop = observeConversationMutations(() => scheduled++, () => updates++);
  const [conversation, roots] = state.observers;
  assert.equal(conversation.target, first);
  assert.ok(roots.options.attributes);
  for (const attribute of ["class", "style", "hidden", "aria-hidden"]) assert.ok(roots.options.attributeFilter.includes(attribute));
  first.visible = false;
  second.visible = true;
  roots.callback([{ type: "attributes" }]);
  assert.equal(conversation.target, second);
  assert.equal(updates, 2);
  roots.callback([{ type: "childList" }]);
  assert.equal(updates, 2);
  for (let i = 0; i < 2; i++) {
    const replacement = root(true);
    state.mains = [first, replacement];
    roots.callback([{ type: "childList" }]);
    assert.equal(conversation.target, replacement);
  }
  conversation.callback();
  assert.equal(scheduled, 1);
  assert.equal(updates, 4);
  stop();
  assert.equal(conversation.disconnections, 4);
  assert.equal(roots.disconnections, 1);
}));
