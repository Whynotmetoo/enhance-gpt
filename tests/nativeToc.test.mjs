import assert from "node:assert/strict";
import test from "node:test";
import {
  nativePromptButtonForOutlineItem,
  nativePromptButtons,
  nativePromptNumberForOutlineItem
} from "../src/content/features/conversationOutline/nativeToc.ts";
import { resolveOutlineItemTarget } from "../src/content/features/conversationOutline/scroll.ts";

let itemId = 0;

function item(kind) {
  itemId += 1;

  return {
    element: null,
    headingIndex: kind === "heading" ? 0 : null,
    id: `${kind}-${itemId}`,
    kind,
    label: kind,
    level: kind === "user" ? 1 : 2,
    messageId: null,
    source: "api"
  };
}

test("maps a user item to its one-based native prompt number", () => {
  const items = [item("user"), item("heading"), item("user")];

  assert.equal(nativePromptNumberForOutlineItem(items, 0), 1);
  assert.equal(nativePromptNumberForOutlineItem(items, 2), 2);
});

test("maps answer headings to their preceding user prompt", () => {
  const items = [item("user"), item("heading"), item("heading"), item("user"), item("heading")];

  assert.equal(nativePromptNumberForOutlineItem(items, 1), 1);
  assert.equal(nativePromptNumberForOutlineItem(items, 2), 1);
  assert.equal(nativePromptNumberForOutlineItem(items, 4), 2);
});

test("rejects items without a preceding user prompt and invalid indexes", () => {
  const items = [item("heading"), item("user")];

  assert.equal(nativePromptNumberForOutlineItem(items, 0), null);
  assert.equal(nativePromptNumberForOutlineItem(items, -1), null);
  assert.equal(nativePromptNumberForOutlineItem(items, 2), null);
});

function nativeButton(number, rail, { disabled = false } = {}) {
  return {
    clicked: false,
    disabled,
    click() {
      this.clicked = true;
    },
    closest(selector) {
      if (selector === ".no-scrollbar") {
        return rail;
      }

      return null;
    },
    getAttribute(name) {
      return name === "aria-label" ? `Prompt ${number}` : null;
    }
  };
}

function withNativeButtons(buttons, callback) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll() {
      return buttons;
    }
  };

  try {
    callback();
  } finally {
    globalThis.document = originalDocument;
  }
}

test("uses a complete native prompt rail even when it is visually hidden", () => {
  const rail = { hidden: true };
  const buttons = Array.from({ length: 5 }, (_, index) => nativeButton(index + 1, rail));

  withNativeButtons(buttons, () => {
    const target = nativePromptButtonForOutlineItem(
      [item("user"), item("heading"), item("user"), item("user"), item("user"), item("user")],
      1
    );

    assert.equal(target, buttons[0]);
    target.click();
    assert.equal(buttons[0].clicked, true);
  });
});

test("rejects incomplete prompt controls and keeps separate rails separate", () => {
  const incompleteRail = {};
  const completeRail = {};
  const incompleteButtons = Array.from({ length: 4 }, (_, index) => nativeButton(index + 1, incompleteRail));
  const completeButtons = Array.from({ length: 5 }, (_, index) => nativeButton(index + 1, completeRail));

  withNativeButtons(incompleteButtons, () => {
    assert.deepEqual(nativePromptButtons(), []);
  });

  withNativeButtons([...incompleteButtons, ...completeButtons], () => {
    assert.deepEqual(nativePromptButtons(), completeButtons);
  });
});

test("uses an available native prompt and falls back when the target button is not present", () => {
  const rail = {};
  const buttons = Array.from({ length: 5 }, (_, index) => nativeButton(index + 1, rail));
  const outlineItems = Array.from({ length: 6 }, () => item("user"));

  withNativeButtons(buttons, () => {
    assert.equal(nativePromptButtonForOutlineItem(outlineItems, 4), buttons[4]);
    assert.equal(nativePromptButtonForOutlineItem(outlineItems, 5), null);
  });
});

test("native prompt navigation handles user items before the fallback scroll", async () => {
  const originalDocument = globalThis.document;
  const rail = {};
  const buttons = Array.from({ length: 5 }, (_, index) => nativeButton(index + 1, rail));
  globalThis.document = {
    querySelectorAll() {
      return buttons;
    }
  };

  try {
    const result = await resolveOutlineItemTarget(
      [item("user"), item("user"), item("user"), item("user"), item("user")],
      3
    );

    assert.deepEqual(result, { handledByNativeToc: true });
    assert.equal(buttons[3].clicked, true);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("disabled native prompt controls fall back to the original resolver", async () => {
  const originalDocument = globalThis.document;
  const rail = {};
  const buttons = Array.from({ length: 5 }, (_, index) => nativeButton(index + 1, rail, { disabled: true }));
  globalThis.document = {
    querySelectorAll() {
      return buttons;
    }
  };

  try {
    const result = await resolveOutlineItemTarget(
      [item("user"), item("user"), item("user"), item("user"), item("user")],
      0
    );

    assert.equal(result, null);
    assert.equal(buttons[0].clicked, false);
  } finally {
    globalThis.document = originalDocument;
  }
});
