(() => {
  const bridgeKey = "__enhanceGPTApiHeaderBridgeInstalled";
  const bridgeStatusRequestSource = "enhance-gpt:bridge-status";
  const bridgeStatusResponseSource = "enhance-gpt:bridge-status-response";
  const directConversationRequestSource = "enhance-gpt:direct-conversation";
  const directConversationResponseSource = "enhance-gpt:direct-conversation-response";
  const assetRequestSource = "enhance-gpt:fetch-asset";
  const assetResponseSource = "enhance-gpt:fetch-asset-response";
  const bridgeCapabilities = [
    "conversation-cache",
    "conversation-action",
    "clear-all-conversations",
    "direct-conversation",
    "asset-fetch",
    "conversation-activity",
    "conversation-list-activity"
  ];
  const bridgeHash = (() => {
    try {
      const scriptUrl = document.currentScript?.src;
      return scriptUrl ? new URL(scriptUrl).searchParams.get("bridgeHash") || "unknown" : "unknown";
    } catch {
      return "unknown";
    }
  })();

  if (window[bridgeKey]) {
    return;
  }

  window[bridgeKey] = true;
  window.__enhanceGPTPageContextBridge = {
    capabilities: bridgeCapabilities.slice(),
    hash: bridgeHash,
    installedAt: Date.now()
  };

  const requestSource = "enhance-gpt:fetch-conversation";
  const responseSource = "enhance-gpt:fetch-conversation-response";
  const conversationActionRequestSource = "enhance-gpt:conversation-action";
  const conversationActionResponseSource = "enhance-gpt:conversation-action-response";
  const clearAllConversationsRequestSource = "enhance-gpt:clear-all-conversations";
  const clearAllConversationsResponseSource = "enhance-gpt:clear-all-conversations-response";
  const locationChangeSource = "enhance-gpt:location-changed";
  const conversationActivitySource = "enhance-gpt:conversation-activity";
  const conversationListActivitySource = "enhance-gpt:conversation-list-activity";
  const conversationCache = new Map();
  const backendApiHeaders = new Map();
  const pendingConversations = new Map();
  let lastHref = window.location.href;
  const forwardedBackendHeaderNames = [
    "authorization",
    "oai-client-build-number",
    "oai-client-version",
    "oai-device-id",
    "oai-language",
    "oai-session-id",
    "x-oai-is"
  ];

  function postResponse(payload) {
    window.postMessage({ source: responseSource, ...payload }, window.location.origin);
  }

  function postConversationActionResponse(payload) {
    window.postMessage({ source: conversationActionResponseSource, ...payload }, window.location.origin);
  }

  function postClearAllConversationsResponse(payload) {
    window.postMessage({ source: clearAllConversationsResponseSource, ...payload }, window.location.origin);
  }

  function postBridgeStatusResponse(payload) {
    window.postMessage({ source: bridgeStatusResponseSource, ...payload }, window.location.origin);
  }

  function postDirectConversationResponse(payload) {
    window.postMessage({ source: directConversationResponseSource, ...payload }, window.location.origin);
  }

  function postAssetResponse(payload, transfer) {
    window.postMessage({ source: assetResponseSource, ...payload }, window.location.origin, transfer);
  }

  function postLocationChanged(changedAt = Date.now()) {
    if (lastHref === window.location.href) {
      return;
    }

    lastHref = window.location.href;
    window.postMessage(
      {
        source: locationChangeSource,
        href: lastHref,
        changedAt
      },
      window.location.origin
    );
  }

  function scheduleLocationChanged(changedAt = Date.now()) {
    if (typeof window.queueMicrotask === "function") {
      window.queueMicrotask(() => postLocationChanged(changedAt));
      return;
    }

    window.setTimeout(() => postLocationChanged(changedAt), 0);
  }

  function conversationIdFromUrl(url) {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const match = parsedUrl.pathname.match(/^\/c\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  function postConversationActivity(phase, detail = {}) {
    window.postMessage(
      {
        source: conversationActivitySource,
        phase,
        href: window.location.href,
        conversationId: conversationIdFromUrl(window.location.href),
        changedAt: Date.now(),
        ...detail
      },
      window.location.origin
    );
  }

  function postConversationListActivity(conversationIds, requestedAt, context) {
    window.postMessage(
      {
        source: conversationListActivitySource,
        conversationIds,
        context,
        requestedAt
      },
      window.location.origin
    );
  }

  function installLocationObserver() {
    ["pushState", "replaceState"].forEach((methodName) => {
      const originalMethod = window.history[methodName];
      if (typeof originalMethod !== "function") {
        return;
      }

      window.history[methodName] = function enhanceGPTHistoryMethod() {
        const result = originalMethod.apply(this, arguments);
        scheduleLocationChanged(Date.now());
        return result;
      };
    });

    window.addEventListener("popstate", () => scheduleLocationChanged());
    window.addEventListener("hashchange", () => scheduleLocationChanged());
  }

  function conversationIdFromInput(input, init) {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (String(method).toUpperCase() !== "GET") {
      return null;
    }

    const url = input instanceof Request ? input.url : String(input);

    try {
      const parsedUrl = new URL(url, window.location.origin);
      const match = parsedUrl.pathname.match(/^\/backend-api\/conversation\/([^/]+)$/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  function urlFromInput(input) {
    return input instanceof Request ? input.url : String(input);
  }

  function isBackendApiInput(input) {
    try {
      const parsedUrl = new URL(urlFromInput(input), window.location.origin);
      return parsedUrl.origin === window.location.origin && parsedUrl.pathname.startsWith("/backend-api/");
    } catch {
      return false;
    }
  }

  function mergedRequestHeaders(input, init) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    return headers;
  }

  function rememberBackendApiRequestHeaders(input, init) {
    if (!isBackendApiInput(input)) {
      return;
    }

    const headers = mergedRequestHeaders(input, init);
    forwardedBackendHeaderNames.forEach((name) => {
      const value = headers.get(name);
      if (value) {
        backendApiHeaders.set(name, value);
      }
    });
  }

  function rememberBackendApiResponseHeaders(response) {
    const nextXOaiIs = response.headers.get("x-oai-is-update");
    if (nextXOaiIs) {
      backendApiHeaders.set("x-oai-is", nextXOaiIs);
    }
  }

  async function refreshAuthorizationHeader() {
    try {
      const response = await window.fetch("/api/auth/session", {
        credentials: "include"
      });
      if (!response.ok) {
        return;
      }

      const body = await response.clone().json();
      if (body && typeof body.accessToken === "string" && body.accessToken.length > 0) {
        backendApiHeaders.set("authorization", `Bearer ${body.accessToken}`);
      }
    } catch {
      // The backend request will return the actionable error if auth cannot be refreshed.
    }
  }

  async function ensureAuthorizationHeader() {
    if (backendApiHeaders.has("authorization")) {
      return;
    }

    await refreshAuthorizationHeader();
  }

  function isConversationStateInput(input) {
    const url = urlFromInput(input);

    try {
      const parsedUrl = new URL(url, window.location.origin);
      return /^\/backend-api\/f\/conversation\/?$/.test(parsedUrl.pathname);
    } catch {
      return false;
    }
  }

  function isConversationListInput(input, init) {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (String(method).toUpperCase() !== "GET") {
      return false;
    }

    try {
      const parsedUrl = new URL(urlFromInput(input), window.location.origin);
      return parsedUrl.origin === window.location.origin && parsedUrl.pathname === "/backend-api/conversations";
    } catch {
      return false;
    }
  }

  function conversationListContext(input) {
    try {
      const parsedUrl = new URL(urlFromInput(input), window.location.origin);
      return {
        isArchived: parsedUrl.searchParams.get("is_archived"),
        isStarred: parsedUrl.searchParams.get("is_starred"),
        offset: parsedUrl.searchParams.get("offset")
      };
    } catch {
      return {
        isArchived: null,
        isStarred: null,
        offset: null
      };
    }
  }

  function isConversationListItem(value) {
    return (
      value &&
      typeof value === "object" &&
      typeof value.id === "string" &&
      (
        "title" in value ||
        "create_time" in value ||
        "update_time" in value ||
        "conversation_template_id" in value
      )
    );
  }

  function conversationIdsFromListBody(body) {
    const ids = new Set();

    const visit = (value, depth = 0) => {
      if (!value || typeof value !== "object" || depth > 5) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (isConversationListItem(item)) {
            ids.add(item.id);
          }
          visit(item, depth + 1);
        });
        return;
      }

      ["items", "conversations", "data", "results"].forEach((key) => {
        if (key in value) {
          visit(value[key], depth + 1);
        }
      });
    };

    visit(body);
    return Array.from(ids);
  }

  function rememberConversation(conversationId, body) {
    conversationCache.set(conversationId, {
      body,
      capturedAt: Date.now()
    });

    while (conversationCache.size > 10) {
      const oldestKey = conversationCache.keys().next().value;
      conversationCache.delete(oldestKey);
    }

    const pending = pendingConversations.get(conversationId);
    if (!pending) {
      return;
    }

    pendingConversations.delete(conversationId);
    pending.forEach((entry) => {
      window.clearTimeout(entry.timer);
      entry.resolve(body);
    });
  }

  function rejectPendingConversation(conversationId, error) {
    const pending = pendingConversations.get(conversationId);
    if (!pending) {
      return;
    }

    pendingConversations.delete(conversationId);
    pending.forEach((entry) => {
      window.clearTimeout(entry.timer);
      entry.reject(error);
    });
  }

  function waitForConversation(conversationId, minCapturedAt) {
    const cached = conversationCache.get(conversationId);
    if (cached && cached.capturedAt >= minCapturedAt) {
      return Promise.resolve(cached.body);
    }

    return new Promise((resolve, reject) => {
      const pending = pendingConversations.get(conversationId) ?? new Set();
      const entry = {
        minCapturedAt,
        resolve,
        reject,
        timer: 0
      };
      const timer = window.setTimeout(() => {
        pending.delete(entry);
        if (pending.size === 0) {
          pendingConversations.delete(conversationId);
        }

        reject(new Error("ChatGPT conversation response was not captured"));
      }, 5_000);

      entry.timer = timer;
      pending.add(entry);
      pendingConversations.set(conversationId, pending);
    });
  }

  function observeConversationResponse(conversationId, responsePromise) {
    void responsePromise
      .then((response) => {
        if (!response.ok) {
          return;
        }

        return response
          .clone()
          .json()
          .then((body) => rememberConversation(conversationId, body));
      })
      .catch((error) => rejectPendingConversation(conversationId, error));
  }

  function observeConversationStateResponse(responsePromise) {
    void responsePromise
      .then((response) => {
        postConversationActivity("response", {
          kind: "conversation-state",
          ok: response.ok,
          status: response.status
        });
      })
      .catch(() => postConversationActivity("error", { kind: "conversation-state" }));
  }

  function observeConversationListResponse(responsePromise, requestedAt, context) {
    void responsePromise
      .then((response) => {
        if (!response.ok) {
          return;
        }

        return response
          .clone()
          .json()
          .then((body) => postConversationListActivity(conversationIdsFromListBody(body), requestedAt, context))
          .catch(() => undefined);
      })
      .catch(() => undefined);
  }

  function wrapFetch(fetchImplementation) {
    return function enhanceGPTFetch(input, init) {
      const conversationId = conversationIdFromInput(input, init);
      const isConversationStateRequest = isConversationStateInput(input);
      const isConversationListRequest = isConversationListInput(input, init);
      const isBackendApiRequest = isBackendApiInput(input);
      const listContext = isConversationListRequest ? conversationListContext(input) : null;
      const requestedAt = Date.now();
      rememberBackendApiRequestHeaders(input, init);
      if (isConversationStateRequest) {
        postConversationActivity("request", { kind: "conversation-state" });
      }

      const responsePromise = fetchImplementation.apply(this, arguments);
      if (isBackendApiRequest) {
        void responsePromise.then((response) => rememberBackendApiResponseHeaders(response)).catch(() => undefined);
      }

      if (conversationId) {
        observeConversationResponse(conversationId, responsePromise);
      }
      if (isConversationStateRequest) {
        observeConversationStateResponse(responsePromise);
      }
      if (isConversationListRequest) {
        observeConversationListResponse(responsePromise, requestedAt, listContext);
      }

      return responsePromise;
    };
  }

  let wrappedFetch = wrapFetch(window.fetch);

  try {
    Object.defineProperty(window, "fetch", {
      configurable: true,
      get() {
        return wrappedFetch;
      },
      set(nextFetch) {
        if (typeof nextFetch === "function") {
          wrappedFetch = wrapFetch(nextFetch);
        }
      }
    });
  } catch {
    window.fetch = wrappedFetch;
  }

  installLocationObserver();

  async function sendCachedConversation(requestId, conversationId, minCapturedAt) {
    try {
      const body = await waitForConversation(conversationId, minCapturedAt);

      postResponse({
        requestId,
        ok: true,
        body
      });
    } catch (error) {
      postResponse({
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Conversation response was not captured"
      });
    }
  }

  function forwardedHeadersFor(path, route) {
    const headers = {
      "x-openai-target-path": path,
      "x-openai-target-route": route
    };
    forwardedBackendHeaderNames.forEach((name) => {
      const value = backendApiHeaders.get(name);
      if (value) {
        headers[name] = value;
      }
    });
    return headers;
  }

  async function fetchDirectConversation(requestId, conversationId) {
    const path = `/backend-api/conversation/${encodeURIComponent(conversationId)}`;

    try {
      await ensureAuthorizationHeader();
      let headers = forwardedHeadersFor(path, "/backend-api/conversation/{conversation_id}");
      let response = await window.fetch(path, {
        credentials: "include",
        headers
      });

      if (!response.ok && (response.status === 401 || response.status === 403 || response.status === 404)) {
        await refreshAuthorizationHeader();
        headers = forwardedHeadersFor(path, "/backend-api/conversation/{conversation_id}");
        response = await window.fetch(path, {
          credentials: "include",
          headers
        });
      }

      let body = null;
      let error;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        try {
          const text = await response.clone().text();
          error = text || `Conversation request failed: ${response.status}`;
        } catch {
          error = `Conversation request failed: ${response.status}`;
        }
      }

      if (response.ok) {
        rememberConversation(conversationId, body);
      }

      postDirectConversationResponse({
        requestId,
        ok: response.ok,
        status: response.status,
        body,
        error
      });
    } catch (error) {
      postDirectConversationResponse({
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Conversation request failed"
      });
    }
  }

  function fileNameFromContentDisposition(contentDisposition) {
    if (!contentDisposition) {
      return null;
    }

    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) {
      try {
        return decodeURIComponent(utfMatch[1].trim().replace(/^"|"$/g, ""));
      } catch {
        return utfMatch[1].trim().replace(/^"|"$/g, "");
      }
    }

    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1].trim() : null;
  }

  function fileNameFromDownloadBody(body) {
    if (!body || typeof body !== "object") {
      return null;
    }

    return typeof body.file_name === "string" && body.file_name.length > 0
      ? body.file_name
      : typeof body.filename === "string" && body.filename.length > 0
        ? body.filename
        : typeof body.name === "string" && body.name.length > 0
          ? body.name
          : null;
  }

  async function assetResponseBytes(response, originalFileName) {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        const body = await response.clone().json();
        if (body && typeof body.download_url === "string" && body.download_url.length > 0) {
          const parsedDownloadUrl = new URL(body.download_url, window.location.origin);
          const path = `${parsedDownloadUrl.pathname}${parsedDownloadUrl.search}`;
          const headers = parsedDownloadUrl.origin === window.location.origin
            ? forwardedHeadersFor(path, parsedDownloadUrl.pathname)
            : {};
          const downloadResponse = await window.fetch(parsedDownloadUrl.href, {
            credentials: "include",
            headers
          });

          if (!downloadResponse.ok) {
            let error = null;
            try {
              error = await downloadResponse.clone().text();
            } catch {
              error = null;
            }

            return {
              error: error || `Asset request failed: ${downloadResponse.status}`,
              ok: false,
              status: downloadResponse.status
            };
          }

          return {
            bytes: await downloadResponse.arrayBuffer(),
            contentType: downloadResponse.headers.get("content-type"),
            fileName:
              fileNameFromContentDisposition(downloadResponse.headers.get("content-disposition")) ??
              fileNameFromDownloadBody(body) ??
              originalFileName,
            ok: true,
            status: downloadResponse.status
          };
        }
      } catch {
        // Fall through and return the original response bytes.
      }
    }

    return {
      bytes: await response.arrayBuffer(),
      contentType,
      fileName: fileNameFromContentDisposition(response.headers.get("content-disposition")) ?? originalFileName,
      ok: true,
      status: response.status
    };
  }

  async function fetchAsset(requestId, url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url, window.location.origin);
    } catch {
      postAssetResponse({ requestId, ok: false, error: "Invalid asset URL" });
      return;
    }

    const path = `${parsedUrl.pathname}${parsedUrl.search}`;
    await ensureAuthorizationHeader();
    let headers = parsedUrl.origin === window.location.origin
      ? forwardedHeadersFor(path, parsedUrl.pathname)
      : {};

    try {
      let response = await window.fetch(parsedUrl.href, {
        credentials: "include",
        headers
      });

      if (
        parsedUrl.origin === window.location.origin &&
        !response.ok &&
        (response.status === 401 || response.status === 403 || response.status === 404)
      ) {
        await refreshAuthorizationHeader();
        headers = forwardedHeadersFor(path, parsedUrl.pathname);
        response = await window.fetch(parsedUrl.href, {
          credentials: "include",
          headers
        });
      }

      if (!response.ok) {
        let error;
        try {
          error = await response.clone().text();
        } catch {
          error = null;
        }

        postAssetResponse({
          requestId,
          ok: false,
          status: response.status,
          error: error || `Asset request failed: ${response.status}`
        });
        return;
      }

      const result = await assetResponseBytes(response, fileNameFromContentDisposition(response.headers.get("content-disposition")));
      if (!result.ok) {
        postAssetResponse({
          requestId,
          ok: false,
          status: result.status,
          error: result.error
        });
        return;
      }

      const bytes = result.bytes;
      postAssetResponse(
        {
          requestId,
          ok: true,
          status: result.status,
          contentType: result.contentType,
          fileName: result.fileName,
          bytes
        },
        [bytes]
      );
    } catch (error) {
      postAssetResponse({
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Asset request failed"
      });
    }
  }

  async function performConversationAction(requestId, conversationId, action) {
    const body =
      action === "delete"
        ? { is_visible: false }
        : action === "archive"
          ? { is_archived: true }
          : null;

    if (!body) {
      postConversationActionResponse({
        requestId,
        action,
        conversationId,
        ok: false,
        error: "Unsupported conversation action"
      });
      return;
    }

    const path = `/backend-api/conversation/${encodeURIComponent(conversationId)}`;
    const headers = {
      "Content-Type": "application/json",
      ...forwardedHeadersFor(path, "/backend-api/conversation/{conversation_id}")
    };

    try {
      const response = await window.fetch(path, {
        body: JSON.stringify(body),
        credentials: "include",
        headers,
        method: "PATCH"
      });

      let error;
      if (!response.ok) {
        try {
          const text = await response.clone().text();
          error = text || `Conversation action failed: ${response.status}`;
        } catch {
          error = `Conversation action failed: ${response.status}`;
        }
      }

      postConversationActivity(response.ok ? "response" : "error", {
        action,
        conversationId,
        kind: "conversation-action",
        ok: response.ok,
        status: response.status
      });

      postConversationActionResponse({
        requestId,
        action,
        conversationId,
        ok: response.ok,
        status: response.status,
        error
      });
    } catch (error) {
      postConversationActivity("error", {
        action,
        conversationId,
        kind: "conversation-action"
      });
      postConversationActionResponse({
        requestId,
        action,
        conversationId,
        ok: false,
        error: error instanceof Error ? error.message : "Conversation action failed"
      });
    }
  }

  async function clearAllConversations(requestId) {
    const path = "/backend-api/conversations";
    const headers = {
      "Content-Type": "application/json",
      ...forwardedHeadersFor(path, "/backend-api/conversations")
    };

    try {
      const response = await window.fetch(path, {
        body: JSON.stringify({ is_visible: false }),
        credentials: "include",
        headers,
        method: "PATCH"
      });

      let body;
      let error;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }

      const succeeded = response.ok && body?.success === true;
      if (!succeeded) {
        try {
          const text = await response.clone().text();
          error = body?.message || text || `Clear all conversations failed: ${response.status}`;
        } catch {
          error = body?.message || `Clear all conversations failed: ${response.status}`;
        }
      }

      if (succeeded) {
        const refreshHeaders = forwardedHeadersFor("/backend-api/conversations", "/backend-api/conversations");

        void window
          .fetch("/backend-api/conversations?offset=0&limit=28&order=updated&is_archived=false&is_starred=false", {
            credentials: "include",
            headers: refreshHeaders
          })
          .catch(() => undefined);
      }

      postConversationActivity(succeeded ? "response" : "error", {
        action: "clear-all",
        kind: "conversation-action",
        ok: succeeded,
        status: response.status
      });

      postClearAllConversationsResponse({
        requestId,
        ok: succeeded,
        status: response.status,
        error
      });
    } catch (error) {
      postConversationActivity("error", {
        action: "clear-all",
        kind: "conversation-action"
      });
      postClearAllConversationsResponse({
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Clear all conversations failed"
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || typeof data.requestId !== "string") {
      return;
    }

    if (data.source === bridgeStatusRequestSource) {
      postBridgeStatusResponse({
        requestId: data.requestId,
        ok: true,
        hash: bridgeHash,
        capabilities: bridgeCapabilities.slice()
      });
      return;
    }

    if (data.source === requestSource) {
      if (typeof data.conversationId !== "string" || data.conversationId.length === 0) {
        postResponse({ requestId: data.requestId, ok: false, error: "Missing conversation id" });
        return;
      }

      void sendCachedConversation(
        data.requestId,
        data.conversationId,
        typeof data.minCapturedAt === "number" ? data.minCapturedAt : 0
      );
      return;
    }

    if (data.source === directConversationRequestSource) {
      if (typeof data.conversationId !== "string" || data.conversationId.length === 0) {
        postDirectConversationResponse({ requestId: data.requestId, ok: false, error: "Missing conversation id" });
        return;
      }

      void fetchDirectConversation(data.requestId, data.conversationId);
      return;
    }

    if (data.source === assetRequestSource) {
      if (typeof data.url !== "string" || data.url.length === 0) {
        postAssetResponse({ requestId: data.requestId, ok: false, error: "Missing asset URL" });
        return;
      }

      void fetchAsset(data.requestId, data.url);
      return;
    }

    if (data.source === conversationActionRequestSource) {
      if (typeof data.conversationId !== "string" || data.conversationId.length === 0) {
        postConversationActionResponse({ requestId: data.requestId, ok: false, error: "Missing conversation id" });
        return;
      }

      void performConversationAction(data.requestId, data.conversationId, data.action);
      return;
    }

    if (data.source === clearAllConversationsRequestSource) {
      void clearAllConversations(data.requestId);
    }
  });
})();
