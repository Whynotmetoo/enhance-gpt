import assert from "node:assert/strict";
import test from "node:test";
import {
  collectConversationItems,
  conversationIdForRow,
  ensureHeaderControls,
  sameHeaderControls,
  conversationPageCenterX,
  restoreSuppressedConversationRows,
  syncSuppressedConversationRows
} from "../src/content/features/conversationBulk/dom.ts";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const keyAttribute = "data-sidebar-chatgpt-conversation-key";
const suppressedClass = "ecg-conversation-row-suppressed";

function row(id, title, { visible = true, hidden = false } = {}) {
  const classes = new Set();
  return {
    key: `chatgpt:conversation:${id}`,
    classes,
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      remove(name) { classes.delete(name); }
    },
    getAttribute(name) { return name === keyAttribute ? this.key : null; },
    closest() { return hidden ? {} : null; },
    querySelector(selector) {
      assert.equal(selector, '[role="button"][aria-label]');
      return {
        getAttribute(name) { return name === "aria-label" ? title : null; },
        getBoundingClientRect() {
          return { width: visible && !classes.has(suppressedClass) ? 240 : 0, height: 32 };
        }
      };
    }
  };
}

function withSidebar(rows, callback) {
  const saved = Object.fromEntries(["document", "window", "getComputedStyle"].map(key => [key, globalThis[key]]));
  const recents = {
    collapsed: false,
    getAttribute() { return String(this.collapsed); },
    querySelectorAll(selector) {
      assert.equal(selector, `[${keyAttribute}]`);
      return rows;
    }
  };
  const sidebar = {
    width: 323,
    querySelector(selector) {
      assert.equal(selector, '[data-sidebar-project-container-id="chats"] [data-app-action-sidebar-section]');
      return recents;
    },
    getBoundingClientRect() { return { width: this.width, height: 800, right: this.width }; }
  };
  globalThis.document = {
    documentElement: { clientWidth: 1200 },
    querySelectorAll(selector) {
      if (selector === "#app-shell-sidebar") return [sidebar];
      if (selector === `.${suppressedClass}`) return rows.filter(item => item.classes.has(suppressedClass));
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };
  globalThis.window = { location: { origin: "https://chatgpt.com" } };
  globalThis.getComputedStyle = () => ({ visibility: "visible", display: "block" });
  try { callback({ recents, sidebar }); } finally { Object.assign(globalThis, saved); }
}

test("accepts only keyed ChatGPT conversations, never titles or other item types", () => {
  const item = row(firstId, "A title");
  assert.equal(conversationIdForRow(item), firstId);
  for (const key of [null, "", firstId, "chatgpt:conversation:", "chatgpt:conversation:title", `project:${firstId}`, `chatgpt:conversation:${firstId}:extra`]) {
    item.key = key;
    assert.equal(conversationIdForRow(item), null);
  }
});

test("collects distinct visible keyed rows without anchors or title matching", () => {
  const first = row(firstId, "Same title");
  const second = row(secondId, "Same title");
  withSidebar([first, row(firstId, "Duplicate"), second, row("invalid", "Invalid")], () => {
    assert.deepEqual(collectConversationItems().map(({ id, title, href }) => ({ id, title, href })), [
      { id: firstId, title: "Same title", href: `https://chatgpt.com/c/${firstId}` },
      { id: secondId, title: "Same title", href: `https://chatgpt.com/c/${secondId}` }
    ]);
  });
});

test("excludes hidden rows and clears collection when Recents or sidebar is collapsed", () => {
  withSidebar([row(firstId, "Visible"), row(secondId, "Hidden", { hidden: true }), row(secondId, "No layout", { visible: false })], ({ recents, sidebar }) => {
    assert.equal(collectConversationItems().length, 1);
    recents.collapsed = true;
    assert.deepEqual(collectConversationItems(), []);
    recents.collapsed = false;
    sidebar.width = 0;
    assert.deepEqual(collectConversationItems(), []);
  });
});

test("suppression and restoration use IDs and release recycled rows", () => {
  const first = row(firstId, "Same title");
  const second = row(secondId, "Same title");
  withSidebar([first, second], () => {
    syncSuppressedConversationRows(new Set([firstId]));
    assert.deepEqual(collectConversationItems().map(item => item.id), [secondId]);
    restoreSuppressedConversationRows(new Set([firstId]));
    assert.equal(collectConversationItems().length, 2);
    syncSuppressedConversationRows(new Set([firstId]));
    first.key = `chatgpt:conversation:${secondId}`;
    syncSuppressedConversationRows(new Set([firstId]));
    assert.equal(first.classes.has(suppressedClass), false);
    syncSuppressedConversationRows(new Set([secondId]));
    syncSuppressedConversationRows(new Set());
    assert.equal(second.classes.has(suppressedClass), false);
  });
});

test("toast position follows the measured sidebar width", () => {
  withSidebar([], ({ sidebar }) => {
    assert.equal(conversationPageCenterX(), 761.5);
    sidebar.width = 400;
    assert.equal(conversationPageCenterX(), 800);
    sidebar.width = 0;
    assert.equal(conversationPageCenterX(), 600);
  });
});


test("mounts beside the native section toggle, reuses hosts, and follows replacement", () => {
  withSidebar([], ({ recents }) => {
    const createElement = () => ({
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }
    });
    globalThis.document.createElement = createElement;
    function createHeader() {
      const children = [];
      const header = {
        classList: { add() {} },
        querySelector(selector) {
          const attribute = selector.slice(1, -1);
          return children.find(child => child.attributes?.[attribute]) ?? null;
        }
      };
      const toggle = {
        parentElement: header,
        classList: { add() {} },
        before(host) { children.unshift(host); },
        after(host) { children.push(host); }
      };
      children.push(toggle);
      return { children, toggle };
    }
    let current = createHeader();
    recents.querySelector = selector => {
      assert.equal(selector, "button[data-app-action-sidebar-section-toggle]");
      return current.toggle;
    };
    const first = ensureHeaderControls();
    assert.deepEqual(current.children, [first.selectHost, current.toggle, first.actionsHost]);
    assert.equal(sameHeaderControls(first, ensureHeaderControls()), true);
    assert.equal(current.children.length, 3);
    // Native collapse retains the toggle, so the toolbar remains available.
    recents.collapsed = true;
    assert.equal(sameHeaderControls(first, ensureHeaderControls()), true);
    current = createHeader();
    const replacement = ensureHeaderControls();
    assert.equal(sameHeaderControls(first, replacement), false);
    assert.equal(replacement.recentsButton, current.toggle);
    assert.equal(current.children.length, 3);
    current.toggle = null;
    assert.equal(ensureHeaderControls(), null);
  });
});
