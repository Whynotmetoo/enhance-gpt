import type { OutlineItem } from "./types";

const nativePromptLabelPattern = /^Prompt ([1-9]\d*)$/;
const minimumNativePromptCount = 5;

function promptNumber(label: string | null): number | null {
  const match = label?.match(nativePromptLabelPattern);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function nativePromptNumberForOutlineItem(items: OutlineItem[], index: number): number | null {
  if (index < 0 || index >= items.length) {
    return null;
  }

  let number = 0;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    if (items[cursor].kind === "user") {
      number += 1;
    }
  }

  return number > 0 ? number : null;
}

export function nativePromptButtons(): HTMLButtonElement[] {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-label^='Prompt ']"))
    .filter((button) => promptNumber(button.getAttribute("aria-label")) !== null)
    .filter((button) => !button.closest("#enhance-gpt-root"));
  const railGroups = new Map<Element | null, HTMLButtonElement[]>();

  buttons.forEach((button) => {
    const rail = button.closest(".no-scrollbar");
    railGroups.set(rail, [...(railGroups.get(rail) ?? []), button]);
  });

  return Array.from(railGroups.values())
    .map((group) =>
      group.sort(
        (left, right) =>
          (promptNumber(left.getAttribute("aria-label")) ?? 0) -
          (promptNumber(right.getAttribute("aria-label")) ?? 0)
      )
    )
    .filter(
      (group) =>
        group.length >= minimumNativePromptCount &&
        group.every((button, index) => promptNumber(button.getAttribute("aria-label")) === index + 1)
    )
    .sort((left, right) => right.length - left.length)[0] ?? [];
}

export function nativePromptButtonForOutlineItem(items: OutlineItem[], index: number): HTMLButtonElement | null {
  const targetNumber = nativePromptNumberForOutlineItem(items, index);
  if (targetNumber === null) {
    return null;
  }

  return nativePromptButtons()[targetNumber - 1] ?? null;
}
