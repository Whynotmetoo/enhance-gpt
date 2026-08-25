import assert from "node:assert/strict";
import test from "node:test";
import { t } from "../src/shared/i18n/index.ts";

test("uses chrome.i18n when the extension context is available", () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getMessage(key, substitutions) {
        return `${key}:${Array.isArray(substitutions) ? substitutions.join(",") : substitutions ?? ""}`;
      }
    }
  };

  try {
    assert.equal(t("outline_collapse_aria", ["Details"]), "outline_collapse_aria:Details");
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("stops calling chrome.i18n after the extension context is invalidated", () => {
  const originalChrome = globalThis.chrome;
  const originalWarn = console.warn;
  let calls = 0;
  let warnings = 0;

  globalThis.chrome = {
    i18n: {
      getMessage() {
        calls += 1;
        throw new Error("Extension context invalidated.");
      }
    }
  };
  console.warn = () => {
    warnings += 1;
  };

  try {
    assert.equal(t("outline_collapse_aria", ["Details"]), "Collapse Details");
    assert.equal(t("outline_expand_aria", ["Details"]), "Expand Details");
    assert.equal(calls, 1);
    assert.equal(warnings, 0);
  } finally {
    globalThis.chrome = originalChrome;
    console.warn = originalWarn;
  }
});
