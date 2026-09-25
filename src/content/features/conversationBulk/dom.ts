import { conversationIdFromHref, isVisible } from "../../lib/dom";
import type { ConversationItem, HeaderControls } from "./types";

export const checkboxClass = "ecg-conversation-checkbox";
export const selectedRowClass = "ecg-conversation-row-selected";
export const suppressedRowClass = "ecg-conversation-row-suppressed";
export const bulkManagerIconPath = "icons/icon-transparent.svg";
export const bulkOperationIconPath = "icons/bulk-operation.png";

const headerActionsHostAttribute = "data-ecg-bulk-actions-host";
const headerClass = "ecg-recents-header-row";
const headerSelectHostAttribute = "data-ecg-bulk-select-host";
const recentsButtonClass = "ecg-recents-trigger";
const rowClass = "ecg-conversation-row";
const sidebarSelector = "#app-shell-sidebar";
const recentsSelector = '[data-sidebar-project-container-id="chats"] [data-app-action-sidebar-section]';
const conversationKeyAttribute = "data-sidebar-chatgpt-conversation-key";
const conversationRowSelector = `[${conversationKeyAttribute}]`;
const conversationButtonSelector = '[role="button"][aria-label]';

type ExtensionGlobal = typeof globalThis & {
  browser?: { runtime?: { getURL?: (path: string) => string } };
  chrome?: { runtime?: { getURL?: (path: string) => string } };
};

export function extensionResourceUrl(path: string): string {
  const scope = globalThis as ExtensionGlobal;
  try {
    return (scope.chrome ?? scope.browser)?.runtime?.getURL?.(path) ?? path;
  } catch {
    return path;
  }
}

function findSidebar(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(sidebarSelector)).find(isVisible) ?? null;
}

function findRecentsContainer(sidebar: HTMLElement): HTMLElement | null {
  // The stable container id distinguishes Recents from pinned and project chats,
  // without depending on the translated section heading.
  return sidebar.querySelector<HTMLElement>(recentsSelector);
}

export function sameHeaderControls(current: HeaderControls | null, next: HeaderControls | null): boolean {
  return (
    current?.actionsHost === next?.actionsHost &&
    current?.recentsButton === next?.recentsButton &&
    current?.selectHost === next?.selectHost
  );
}

export function ensureHeaderControls(): HeaderControls | null {
  const sidebar = findSidebar();
  if (!sidebar) {
    return null;
  }

  const recents = findRecentsContainer(sidebar);
  const recentsButton = recents?.querySelector<HTMLButtonElement>("button[data-app-action-sidebar-section-toggle]") ?? null;
  const header = recentsButton?.parentElement;
  if (!recentsButton || !header) {
    return null;
  }

  header.classList.add(headerClass);
  recentsButton.classList.add(recentsButtonClass);

  let selectHost = header.querySelector<HTMLElement>(`[${headerSelectHostAttribute}]`);
  if (!selectHost) {
    selectHost = document.createElement("span");
    selectHost.setAttribute(headerSelectHostAttribute, "true");
    recentsButton.before(selectHost);
  }

  let actionsHost = header.querySelector<HTMLElement>(`[${headerActionsHostAttribute}]`);
  if (!actionsHost) {
    actionsHost = document.createElement("span");
    actionsHost.setAttribute(headerActionsHostAttribute, "true");
    recentsButton.after(actionsHost);
  }

  return { actionsHost, recentsButton, selectHost };
}

export function conversationIdForRow(row: HTMLElement): string | null {
  const key = row.getAttribute(conversationKeyAttribute);
  // Fail closed for other item types: a title or list position is never an id.
  return key?.match(/^chatgpt:conversation:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1] ?? null;
}

export function collectConversationItems(): ConversationItem[] {
  const sidebar = findSidebar();
  const recents = sidebar ? findRecentsContainer(sidebar) : null;
  if (!recents || recents.getAttribute("data-app-action-sidebar-section-collapsed") === "true") {
    return [];
  }

  const seen = new Set<string>();
  return Array.from(recents.querySelectorAll<HTMLElement>(conversationRowSelector))
    .map((row) => {
      const id = conversationIdForRow(row);
      const button = row.querySelector<HTMLElement>(conversationButtonSelector);
      if (!id || seen.has(id) || !button || !isVisible(button) || row.closest('[aria-hidden="true"]')) {
        return null;
      }
      seen.add(id);
      return {
        id,
        title: button.getAttribute("aria-label")?.trim() || "Untitled chat",
        href: new URL(`/c/${id}`, window.location.origin).href,
        row
      };
    })
    .filter((item): item is ConversationItem => Boolean(item));
}

function ensureCheckbox(item: ConversationItem): void {
  let button = item.row.querySelector<HTMLButtonElement>(`.${checkboxClass}`);

  if (!button) {
    const mark = document.createElement("span");
    button = document.createElement("button");
    button.type = "button";
    button.className = checkboxClass;
    mark.className = "ecg-conversation-checkbox-mark";
    button.append(mark);
    item.row.append(button);
  }

  button.dataset.ecgConversationId = item.id;
  const label = `Select conversation: ${item.title}`;
  if (button.getAttribute("aria-label") !== label) {
    button.setAttribute("aria-label", label);
  }

  item.row.classList.add(rowClass);
}

export function syncConversationCheckboxes(items: ConversationItem[]): void {
  const itemRows = new Set(items.map((item) => item.row));

  document.querySelectorAll<HTMLButtonElement>(`.${checkboxClass}[data-ecg-conversation-id]`).forEach((button) => {
    const row = button.parentElement;
    if (row && itemRows.has(row)) {
      return;
    }

    button.remove();
    row?.classList.remove(rowClass, selectedRowClass);
  });

  items.forEach(ensureCheckbox);
}

export function clearConversationControls(): void {
  document.querySelectorAll(`.${checkboxClass}[data-ecg-conversation-id]`).forEach((element) => element.remove());
  document.querySelectorAll(`.${rowClass}`).forEach((element) => {
    element.classList.remove(rowClass, selectedRowClass);
  });
}

export function clearHeaderControls(): void {
  document
    .querySelectorAll<HTMLElement>(`[${headerSelectHostAttribute}], [${headerActionsHostAttribute}]`)
    .forEach((element) => {
      element.remove();
    });
  document
    .querySelectorAll<HTMLElement>(`.${headerClass}`)
    .forEach((element) => element.classList.remove(headerClass));
  document.querySelectorAll<HTMLElement>(`.${recentsButtonClass}`).forEach((element) => {
    element.classList.remove(recentsButtonClass);
  });
}

export function currentConversationId(): string | null {
  return conversationIdFromHref(window.location.href);
}

export function conversationPageCenterX(): number {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const sidebar = findSidebar();
  const contentLeft = sidebar ? Math.max(0, sidebar.getBoundingClientRect().right) : 0;

  if (contentLeft < viewportWidth - 120) {
    return contentLeft + (viewportWidth - contentLeft) / 2;
  }

  return viewportWidth / 2;
}

function findNewConversationElement(): HTMLElement | null {
  const sidebar = findSidebar();
  const recents = sidebar ? findRecentsContainer(sidebar) : null;
  const button = recents?.querySelector<HTMLElement>('button[aria-label="New chat"]');
  if (button && isVisible(button)) {
    return button;
  }

  return null;
}

export function navigateToNewConversation(): void {
  const target = findNewConversationElement();
  if (target) {
    target.click();
    return;
  }

  window.location.assign("/");
}

export function suppressConversationItem(item: ConversationItem): void {
  item.row.classList.add(suppressedRowClass);
  item.row.classList.remove(selectedRowClass);
  item.row.querySelector<HTMLButtonElement>(`.${checkboxClass}`)?.remove();
}

export function syncSuppressedConversationRows(suppressedIds: ReadonlySet<string>): void {
  const sidebar = findSidebar();
  const recentsContainer = sidebar ? findRecentsContainer(sidebar) : null;
  if (!recentsContainer) {
    return;
  }

  recentsContainer.querySelectorAll<HTMLElement>(conversationRowSelector).forEach((row) => {
    const id = conversationIdForRow(row);
    row.classList.toggle(suppressedRowClass, Boolean(id && suppressedIds.has(id)));
  });
}

export function restoreSuppressedConversationRows(restoredIds: ReadonlySet<string>): void {
  if (restoredIds.size === 0) {
    return;
  }

  document.querySelectorAll<HTMLElement>(`.${suppressedRowClass}`).forEach((row) => {
    const id = conversationIdForRow(row);
    if (id && restoredIds.has(id)) {
      row.classList.remove(suppressedRowClass);
    }
  });
}
