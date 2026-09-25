import {
  maxPendingScrollAttempts,
  outlineScrollAlignmentTolerance,
  outlineSmoothScrollDurationMs,
  outlineScrollTopOffset,
  pendingHeadingScrollMinStep,
  pendingScrollMinStep,
  pendingScrollStepRatio
} from "./constants";
import { connectedElement, exactOutlineElement } from "./domOutline";
import { nativePromptButtonForOutlineItem } from "./nativeToc";
import { cssEscape } from "./utils";
import type { OutlineItem, PendingScroll } from "./types";

type MountedOutlineAnchor = {
  element: HTMLElement;
  index: number;
};

type ResolvedOutlineTarget =
  | {
      handledByNativeToc: true;
    }
  | {
      element: HTMLElement;
      exact: boolean;
      handledByNativeToc?: false;
    };

const outlineTargetRemountTimeoutMs = 1_500;
const outlineTargetRemountPollMs = 60;
const smoothScrollAnimations = new WeakMap<HTMLElement, number>();

function mountedAnchors(items: OutlineItem[]): MountedOutlineAnchor[] {
  return items.flatMap((item, index) => {
    const element = connectedElement(item.element);
    return element ? [{ element, index }] : [];
  });
}

function distanceToViewportAnchor(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const anchorY = window.innerHeight * 0.35;

  if (rect.top <= anchorY && rect.bottom >= anchorY) {
    return 0;
  }

  return Math.min(Math.abs(rect.top - anchorY), Math.abs(rect.bottom - anchorY));
}

function currentMountedAnchor(items: OutlineItem[], fallbackIndex: number): MountedOutlineAnchor | null {
  const anchors = mountedAnchors(items);
  if (anchors.length > 0) {
    return anchors.sort((a, b) => distanceToViewportAnchor(a.element) - distanceToViewportAnchor(b.element))[0];
  }

  const root = document.querySelector<HTMLElement>("#thread") ?? document.querySelector<HTMLElement>("main");
  return root ? { element: root, index: fallbackIndex } : null;
}

function parentSectionAnchor(items: OutlineItem[], index: number): MountedOutlineAnchor | null {
  const item = items[index];
  if (!item || item.level <= 1) {
    return null;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (items[cursor].level < item.level) {
      const element = exactOutlineElement(items[cursor]) ?? connectedElement(items[cursor].element);
      return element ? { element, index: cursor } : null;
    }
  }

  return null;
}

function isScrollableElement(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  return /auto|scroll|overlay/.test(overflowY) && element.scrollHeight > element.clientHeight;
}

export function scrollContainerFor(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (isScrollableElement(parent)) {
      return parent;
    }
  }

  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

function scrollTargetTop(element: HTMLElement, container: HTMLElement): number {
  const elementTop = element.getBoundingClientRect().top;
  const containerTop = container === document.scrollingElement ? 0 : container.getBoundingClientRect().top;
  const top = container.scrollTop + elementTop - containerTop - outlineScrollTopOffset;

  return clampScrollTop(container, top);
}

export function clampScrollTop(container: HTMLElement, top: number): number {
  const maxTop = Math.max(container.scrollHeight - container.clientHeight, 0);

  if (maxTop === 0) return 0;
  const reversed = window.getComputedStyle(container).flexDirection === "column-reverse";
  return reversed ? Math.min(Math.max(top, -maxTop), 0) : Math.min(Math.max(top, 0), maxTop);
}

function isElementScrollAligned(element: HTMLElement, container: HTMLElement): boolean {
  return Math.abs(container.scrollTop - scrollTargetTop(element, container)) <= outlineScrollAlignmentTolerance;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function stopSmoothScroll(container: HTMLElement): void {
  const frame = smoothScrollAnimations.get(container);
  if (frame !== undefined) {
    window.cancelAnimationFrame(frame);
    smoothScrollAnimations.delete(container);
  }
}

function scrollContainerTo(container: HTMLElement, top: number, behavior: ScrollBehavior): void {
  stopSmoothScroll(container);

  if (behavior !== "smooth") {
    container.scrollTo({ top, behavior });
    return;
  }

  const startTop = container.scrollTop;
  const distance = top - startTop;
  if (Math.abs(distance) <= outlineScrollAlignmentTolerance) {
    container.scrollTop = top;
    return;
  }

  const startTime = window.performance.now();
  const animate = (now: number) => {
    const progress = Math.min((now - startTime) / outlineSmoothScrollDurationMs, 1);
    container.scrollTop = startTop + distance * easeOutCubic(progress);

    if (progress < 1) {
      smoothScrollAnimations.set(container, window.requestAnimationFrame(animate));
      return;
    }

    smoothScrollAnimations.delete(container);
  };

  smoothScrollAnimations.set(container, window.requestAnimationFrame(animate));
}

function scrollElementIntoView(element: HTMLElement, behavior: ScrollBehavior): boolean {
  const container = scrollContainerFor(element);
  const isAligned = isElementScrollAligned(element, container);

  if (!isAligned) {
    scrollContainerTo(container, scrollTargetTop(element, container), behavior);
  }

  return isAligned;
}

export function targetTurnShell(items: OutlineItem[], index: number): HTMLElement | null {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const item = items[cursor];
    if (item.kind !== "user") continue;
    return item.messageId
      ? document.querySelector<HTMLElement>(`[data-turn-key="${cssEscape(item.messageId)}"]`)
      : null;
  }
  return null;
}

function targetContainerElement(item: OutlineItem): HTMLElement | null {
  if (item.headingIndex === null) {
    return null;
  }

  const containerElement = connectedElement(item.containerElement);
  if (containerElement) {
    return containerElement;
  }

  const element = connectedElement(item.element);
  if (!element) {
    return null;
  }

  if (element.matches("[data-turn-id], [data-message-id]")) {
    return element;
  }

  return element.closest<HTMLElement>("[data-turn-id], [data-message-id]");
}

function waitForRemountFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, outlineTargetRemountPollMs);
  });
}

async function waitForExactOutlineTarget(item: OutlineItem): Promise<HTMLElement | null> {
  const deadline = window.performance.now() + outlineTargetRemountTimeoutMs;
  while (window.performance.now() < deadline) {
    await waitForRemountFrame();

    const remounted = exactOutlineElement(item);
    if (remounted) {
      return remounted;
    }
  }

  return null;
}

export async function resolveOutlineItemTarget(
  items: OutlineItem[],
  index: number
): Promise<ResolvedOutlineTarget | null> {
  const item = items[index];
  if (!item) {
    return null;
  }

  const nativePromptButton = nativePromptButtonForOutlineItem(items, index);
  if (nativePromptButton && !nativePromptButton.disabled) {
    nativePromptButton.click();

    if (item.kind === "user") {
      return { handledByNativeToc: true };
    }

    const remounted = await waitForExactOutlineTarget(item);
    if (remounted) {
      return { element: remounted, exact: true };
    }
  }

  const exactElement = exactOutlineElement(item);
  if (exactElement) {
    return { element: exactElement, exact: true };
  }

  const targetContainer = targetTurnShell(items, index) ?? targetContainerElement(item);
  if (!targetContainer) {
    return null;
  }

  scrollElementIntoView(targetContainer, "auto");

  const remounted = await waitForExactOutlineTarget(item);
  if (remounted) {
    return { element: remounted, exact: true };
  }

  const fallbackContainer = connectedElement(targetContainer);
  return fallbackContainer ? { element: fallbackContainer, exact: false } : null;
}

export function scrollResolvedOutlineTarget(element: HTMLElement, behavior: ScrollBehavior): boolean {
  return scrollElementIntoView(element, behavior);
}

function pendingScrollStep(container: HTMLElement, anchorIndex: number, targetIndex: number, targetLevel: number): number {
  const indexDistance = Math.abs(targetIndex - anchorIndex);
  const baseStep = Math.max(
    container.clientHeight * pendingScrollStepRatio,
    targetLevel > 1 ? pendingHeadingScrollMinStep : pendingScrollMinStep
  );
  const indexMultiplier = Math.min(8, 1 + Math.sqrt(indexDistance));

  return baseStep * indexMultiplier;
}

function scrollTowardAnchor(
  anchor: MountedOutlineAnchor,
  targetIndex: number,
  targetLevel: number,
  behavior: ScrollBehavior
): void {
  const container = scrollContainerFor(anchor.element);
  const direction = anchor.index < targetIndex ? 1 : -1;
  const step = pendingScrollStep(container, anchor.index, targetIndex, targetLevel);

  if (anchor.index === targetIndex) {
    scrollElementIntoView(anchor.element, behavior);
    return;
  }

  scrollContainerTo(container, clampScrollTop(container, container.scrollTop + direction * step), behavior);
}

export function scrollToOutlineItem(items: OutlineItem[], index: number, behavior: ScrollBehavior): boolean {
  const item = items[index];
  const exactElement = item ? exactOutlineElement(item) : null;
  if (exactElement) {
    return scrollElementIntoView(exactElement, behavior);
  }

  const shell = targetTurnShell(items, index);
  if (shell) {
    scrollElementIntoView(shell, "auto");
    return false;
  }

  const targetContainer = item ? targetContainerElement(item) : null;
  if (targetContainer) {
    scrollElementIntoView(targetContainer, behavior);
    return false;
  }

  const anchor = currentMountedAnchor(items, index) ?? parentSectionAnchor(items, index);
  if (!anchor) {
    return false;
  }

  scrollTowardAnchor(anchor, index, item?.level ?? 1, behavior);
  return false;
}

export function pendingScrollAttempts(
  previous: PendingScroll,
  current: { position?: number; height?: number; messages: string; loading: boolean }
): number {
  const moved = current.position !== undefined && previous.lastScrollTop !== undefined &&
    Math.abs(current.position - previous.lastScrollTop) > outlineScrollAlignmentTolerance;
  const resized = current.height !== undefined && previous.lastScrollHeight !== undefined &&
    current.height !== previous.lastScrollHeight;
  const mounted = previous.lastMountedMessages !== undefined && current.messages !== previous.lastMountedMessages;
  if (moved || resized || mounted) return 0;
  return current.loading ? previous.attempts : previous.attempts + 1;
}

export function nextPendingScroll(items: OutlineItem[], pendingScroll: PendingScroll): PendingScroll | null {
  const index = items.findIndex((item) => item.id === pendingScroll.id);
  if (index < 0) {
    return null;
  }

  const now = Date.now();
  const startedAt = pendingScroll.startedAt ?? now;
  if (now - startedAt >= 60_000) return null;
  const anchor = currentMountedAnchor(items, index);
  const container = anchor ? scrollContainerFor(anchor.element) : null;
  const position = container?.scrollTop;
  const height = container?.scrollHeight;
  const messages = container ? Array.from(container.querySelectorAll<HTMLElement>(
    "[data-chatgpt-search-message-ids], [data-message-id]"
  )).map((element) => element.getAttribute("data-chatgpt-search-message-ids") ??
    element.getAttribute("data-message-id")).join("|") : "";
  const loading = Boolean(container?.matches('[aria-busy="true"]') ||
    container?.querySelector('[aria-busy="true"]'));
  const attempts = pendingScrollAttempts(pendingScroll, { position, height, messages, loading });
  const behavior: ScrollBehavior = exactOutlineElement(items[index]) ? "smooth" : "auto";
  const reachedExactTarget = scrollToOutlineItem(items, index, behavior);
  if (reachedExactTarget || attempts >= maxPendingScrollAttempts) {
    return null;
  }

  return {
    ...pendingScroll,
    attempts,
    startedAt,
    lastScrollTop: position,
    lastScrollHeight: height,
    lastMountedMessages: messages,
    index
  };
}
