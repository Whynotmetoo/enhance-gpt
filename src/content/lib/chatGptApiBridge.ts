import { EXTENSION_NAMESPACE } from "../../shared/constants";

const pageContextScript = "page-context.js";
const requestSource = `${EXTENSION_NAMESPACE}:fetch-conversation`;
const responseSource = `${EXTENSION_NAMESPACE}:fetch-conversation-response`;
const conversationActionRequestSource = `${EXTENSION_NAMESPACE}:conversation-action`;
const conversationActionResponseSource = `${EXTENSION_NAMESPACE}:conversation-action-response`;
const clearAllConversationsRequestSource = `${EXTENSION_NAMESPACE}:clear-all-conversations`;
const clearAllConversationsResponseSource = `${EXTENSION_NAMESPACE}:clear-all-conversations-response`;
const directConversationRequestSource = `${EXTENSION_NAMESPACE}:direct-conversation`;
const directConversationResponseSource = `${EXTENSION_NAMESPACE}:direct-conversation-response`;
const assetRequestSource = `${EXTENSION_NAMESPACE}:fetch-asset`;
const assetResponseSource = `${EXTENSION_NAMESPACE}:fetch-asset-response`;
const conversationActivitySource = `${EXTENSION_NAMESPACE}:conversation-activity`;
const conversationListActivitySource = `${EXTENSION_NAMESPACE}:conversation-list-activity`;

export type ConversationActivity = {
  conversationId: string | null;
  href: string | null;
  kind: "conversation-action" | "conversation-state" | null;
  changedAt: number;
  phase: "request" | "response" | "error";
};

export type ConversationListActivity = {
  context: {
    isArchived: string | null;
    isStarred: string | null;
    offset: string | null;
  };
  conversationIds: string[];
  requestedAt: number;
};

type RuntimeApi = {
  getURL?: (path: string) => string;
};

type ExtensionApi = {
  runtime?: RuntimeApi;
};

type PageConversationResponse = {
  source?: unknown;
  requestId?: unknown;
  ok?: unknown;
  status?: unknown;
  body?: unknown;
  error?: unknown;
};

export type ConversationAction = "delete" | "archive";

export type ConversationActionResult = {
  action: ConversationAction;
  conversationId: string;
  error?: string;
  ok: boolean;
  status?: number;
};

export type ClearAllConversationsResult = {
  error?: string;
  ok: boolean;
  status?: number;
};

type PageConversationActionResponse = {
  source?: unknown;
  requestId?: unknown;
  action?: unknown;
  conversationId?: unknown;
  error?: unknown;
  ok?: unknown;
  status?: unknown;
};

type PageClearAllConversationsResponse = {
  source?: unknown;
  requestId?: unknown;
  error?: unknown;
  ok?: unknown;
  status?: unknown;
};

type PageDirectConversationResponse = PageConversationResponse;

type PageAssetResponse = {
  source?: unknown;
  requestId?: unknown;
  bytes?: unknown;
  contentType?: unknown;
  error?: unknown;
  fileName?: unknown;
  ok?: unknown;
  status?: unknown;
};

let installed = false;
let activityListenerInstalled = false;
let pageContextBridgeReadyPromise: Promise<void> | null = null;
let requestCounter = 0;
const activityListeners = new Set<(activity: ConversationActivity) => void>();
const conversationListActivityListeners = new Set<(activity: ConversationListActivity) => void>();
const recentConversationActivities: ConversationActivity[] = [];

function extensionApi(): ExtensionApi | undefined {
  const scope = globalThis as typeof globalThis & {
    browser?: ExtensionApi;
    chrome?: ExtensionApi;
  };

  return scope.browser ?? scope.chrome;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rememberConversationActivity(activity: ConversationActivity): void {
  recentConversationActivities.push(activity);
  while (recentConversationActivities.length > 20) {
    recentConversationActivities.shift();
  }

  activityListeners.forEach((listener) => listener(activity));
}

function rememberConversationListActivity(activity: ConversationListActivity): void {
  conversationListActivityListeners.forEach((listener) => listener(activity));
}

function installConversationActivityListener(): void {
  if (activityListenerInstalled) {
    return;
  }

  activityListenerInstalled = true;
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
      return;
    }

    const data = event.data;
    if (data.source === conversationListActivitySource) {
      const conversationIds = Array.isArray(data.conversationIds)
        ? data.conversationIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      rememberConversationListActivity({
        context: isRecord(data.context)
          ? {
              isArchived: typeof data.context.isArchived === "string" ? data.context.isArchived : null,
              isStarred: typeof data.context.isStarred === "string" ? data.context.isStarred : null,
              offset: typeof data.context.offset === "string" ? data.context.offset : null
            }
          : {
              isArchived: null,
              isStarred: null,
              offset: null
            },
        conversationIds,
        requestedAt: typeof data.requestedAt === "number" ? data.requestedAt : Date.now()
      });
      return;
    }

    if (data.source !== conversationActivitySource) {
      return;
    }

    const phase = data.phase;
    if (phase !== "request" && phase !== "response" && phase !== "error") {
      return;
    }

    rememberConversationActivity({
      conversationId: typeof data.conversationId === "string" && data.conversationId.length > 0 ? data.conversationId : null,
      href: typeof data.href === "string" && data.href.length > 0 ? data.href : null,
      kind:
        data.kind === "conversation-action" || data.kind === "conversation-state"
          ? data.kind
          : null,
      changedAt: typeof data.changedAt === "number" ? data.changedAt : Date.now(),
      phase
    });
  });
}

function injectPageContextBridge(): Promise<void> {
  if (pageContextBridgeReadyPromise) {
    return pageContextBridgeReadyPromise;
  }

  const scriptUrl = extensionApi()?.runtime?.getURL?.(pageContextScript);
  if (!scriptUrl) {
    pageContextBridgeReadyPromise = Promise.resolve();
    return pageContextBridgeReadyPromise;
  }

  pageContextBridgeReadyPromise = new Promise((resolve) => {
    const appendScript = (): void => {
      const root = document.documentElement ?? document.head;
      if (!root) {
        document.addEventListener("DOMContentLoaded", appendScript, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = false;
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        resolve();
      };
      root.append(script);
    };

    appendScript();
  });

  return pageContextBridgeReadyPromise;
}

export function installChatGptApiBridge(): void {
  installConversationActivityListener();

  if (installed) {
    return;
  }

  installed = true;
  void injectPageContextBridge();
}

async function ensurePageContextBridgeReady(): Promise<void> {
  installChatGptApiBridge();
  await (pageContextBridgeReadyPromise ?? Promise.resolve());
}

export function subscribeConversationActivity(listener: (activity: ConversationActivity) => void): () => void {
  installChatGptApiBridge();
  activityListeners.add(listener);

  return () => {
    activityListeners.delete(listener);
  };
}

export function subscribeConversationListActivity(listener: (activity: ConversationListActivity) => void): () => void {
  installChatGptApiBridge();
  conversationListActivityListeners.add(listener);

  return () => {
    conversationListActivityListeners.delete(listener);
  };
}

export function recentConversationActivity(): ConversationActivity[] {
  return [...recentConversationActivities];
}

export function fetchConversationInPageContext(
  conversationId: string,
  signal: AbortSignal,
  minCapturedAt: number
): Promise<unknown> {
  installChatGptApiBridge();

  if (signal.aborted) {
    return Promise.reject(new Error("Conversation request aborted"));
  }

  const requestId = `conversation-${Date.now()}-${requestCounter}`;
  requestCounter += 1;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      window.removeEventListener("message", handleMessage);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Conversation request aborted"));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
        return;
      }

      const data = event.data as PageConversationResponse;
      if (data.source !== responseSource || data.requestId !== requestId) {
        return;
      }

      cleanup();

      if (data.ok === true) {
        resolve(data.body);
        return;
      }

      const detail = typeof data.error === "string" ? data.error : `Conversation request failed: ${data.status}`;
      reject(new Error(detail));
    };
    let timer = 0;

    void ensurePageContextBridgeReady()
      .then(() => {
        if (signal.aborted) {
          abort();
          return;
        }

        timer = window.setTimeout(() => fail("Conversation request timed out"), 8_000);
        signal.addEventListener("abort", abort, { once: true });
        window.addEventListener("message", handleMessage);
        window.postMessage(
          {
            source: requestSource,
            requestId,
            conversationId,
            minCapturedAt
          },
          window.location.origin
        );
      })
      .catch((error) => fail(error instanceof Error ? error.message : "Conversation request failed"));
  });
}

export function fetchConversationByIdInPageContext(conversationId: string, signal: AbortSignal): Promise<unknown> {
  installChatGptApiBridge();

  if (signal.aborted) {
    return Promise.reject(new Error("Conversation request aborted"));
  }

  const requestId = `direct-conversation-${Date.now()}-${requestCounter}`;
  requestCounter += 1;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      window.removeEventListener("message", handleMessage);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Conversation request aborted"));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
        return;
      }

      const data = event.data as PageDirectConversationResponse;
      if (data.source !== directConversationResponseSource || data.requestId !== requestId) {
        return;
      }

      cleanup();

      if (data.ok === true) {
        resolve(data.body);
        return;
      }

      const detail = typeof data.error === "string" ? data.error : `Conversation request failed: ${data.status}`;
      reject(new Error(detail));
    };
    let timer = 0;

    void ensurePageContextBridgeReady()
      .then(() => {
        if (signal.aborted) {
          abort();
          return;
        }

        timer = window.setTimeout(() => fail("Conversation request timed out"), 20_000);
        signal.addEventListener("abort", abort, { once: true });
        window.addEventListener("message", handleMessage);
        window.postMessage(
          {
            source: directConversationRequestSource,
            requestId,
            conversationId
          },
          window.location.origin
        );
      })
      .catch((error) => fail(error instanceof Error ? error.message : "Conversation request failed"));
  });
}

export type PageAssetFetchResult = {
  bytes: ArrayBuffer;
  contentType: string | null;
  fileName: string | null;
  status?: number;
};

export function fetchAssetInPageContext(url: string, signal: AbortSignal): Promise<PageAssetFetchResult> {
  installChatGptApiBridge();

  if (signal.aborted) {
    return Promise.reject(new Error("Asset request aborted"));
  }

  const requestId = `asset-${Date.now()}-${requestCounter}`;
  requestCounter += 1;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      window.removeEventListener("message", handleMessage);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Asset request aborted"));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
        return;
      }

      const data = event.data as PageAssetResponse;
      if (data.source !== assetResponseSource || data.requestId !== requestId) {
        return;
      }

      cleanup();

      if (data.ok === true && data.bytes instanceof ArrayBuffer) {
        resolve({
          bytes: data.bytes,
          contentType: typeof data.contentType === "string" && data.contentType.length > 0 ? data.contentType : null,
          fileName: typeof data.fileName === "string" && data.fileName.length > 0 ? data.fileName : null,
          status: typeof data.status === "number" ? data.status : undefined
        });
        return;
      }

      const detail = typeof data.error === "string" ? data.error : `Asset request failed: ${data.status}`;
      reject(new Error(detail));
    };
    let timer = 0;

    void ensurePageContextBridgeReady()
      .then(() => {
        if (signal.aborted) {
          abort();
          return;
        }

        timer = window.setTimeout(() => fail("Asset request timed out"), 30_000);
        signal.addEventListener("abort", abort, { once: true });
        window.addEventListener("message", handleMessage);
        window.postMessage(
          {
            source: assetRequestSource,
            requestId,
            url
          },
          window.location.origin
        );
      })
      .catch((error) => fail(error instanceof Error ? error.message : "Asset request failed"));
  });
}

export function performConversationActionInPageContext(
  conversationId: string,
  action: ConversationAction,
  signal: AbortSignal
): Promise<ConversationActionResult> {
  installChatGptApiBridge();

  if (signal.aborted) {
    return Promise.reject(new Error("Conversation action aborted"));
  }

  const requestId = `conversation-action-${Date.now()}-${requestCounter}`;
  requestCounter += 1;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      window.removeEventListener("message", handleMessage);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Conversation action aborted"));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
        return;
      }

      const data = event.data as PageConversationActionResponse;
      if (data.source !== conversationActionResponseSource || data.requestId !== requestId) {
        return;
      }

      cleanup();

      resolve({
        action,
        conversationId,
        error: typeof data.error === "string" ? data.error : undefined,
        ok: data.ok === true,
        status: typeof data.status === "number" ? data.status : undefined
      });
    };
    let timer = 0;

    void ensurePageContextBridgeReady()
      .then(() => {
        if (signal.aborted) {
          abort();
          return;
        }

        timer = window.setTimeout(() => fail("Conversation action timed out"), 12_000);
        signal.addEventListener("abort", abort, { once: true });
        window.addEventListener("message", handleMessage);
        window.postMessage(
          {
            source: conversationActionRequestSource,
            requestId,
            action,
            conversationId
          },
          window.location.origin
        );
      })
      .catch((error) => fail(error instanceof Error ? error.message : "Conversation action failed"));
  });
}

export function clearAllConversationsInPageContext(signal: AbortSignal): Promise<ClearAllConversationsResult> {
  installChatGptApiBridge();

  if (signal.aborted) {
    return Promise.reject(new Error("Clear all conversations aborted"));
  }

  const requestId = `clear-all-conversations-${Date.now()}-${requestCounter}`;
  requestCounter += 1;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      window.removeEventListener("message", handleMessage);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Clear all conversations aborted"));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) {
        return;
      }

      const data = event.data as PageClearAllConversationsResponse;
      if (data.source !== clearAllConversationsResponseSource || data.requestId !== requestId) {
        return;
      }

      cleanup();

      resolve({
        error: typeof data.error === "string" ? data.error : undefined,
        ok: data.ok === true,
        status: typeof data.status === "number" ? data.status : undefined
      });
    };
    let timer = 0;

    void ensurePageContextBridgeReady()
      .then(() => {
        if (signal.aborted) {
          abort();
          return;
        }

        timer = window.setTimeout(() => fail("Clear all conversations timed out"), 12_000);
        signal.addEventListener("abort", abort, { once: true });
        window.addEventListener("message", handleMessage);
        window.postMessage(
          {
            source: clearAllConversationsRequestSource,
            requestId
          },
          window.location.origin
        );
      })
      .catch((error) => fail(error instanceof Error ? error.message : "Clear all conversations failed"));
  });
}
