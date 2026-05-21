import { PROMPTS_STORAGE_KEY, type SavedPrompt } from "../../shared/promptTypes";
import { EXTENSION_NAMESPACE } from "../../shared/constants";

type StorageArea = {
  get: (
    key: string,
    callback?: (items: Record<string, unknown>) => void
  ) => Promise<Record<string, unknown>> | void;
  remove?: (
    key: string,
    callback?: () => void
  ) => Promise<void> | void;
  set: (
    items: Record<string, unknown>,
    callback?: () => void
  ) => Promise<void> | void;
};

type ExtensionApi = {
  storage?: {
    local?: StorageArea;
  };
};

const legacyExtensionNamespace = "enhance-chatgpt";
const fallbackStorageKey = fallbackStorageKeyFor(PROMPTS_STORAGE_KEY);
const legacyFallbackStorageKey = legacyFallbackStorageKeyFor(PROMPTS_STORAGE_KEY);
const chatGptSessionPath = "/api/auth/session";

type ChatGptSession = {
  user?: {
    id?: unknown;
  };
};

function extensionApi(): ExtensionApi | undefined {
  const scope = globalThis as typeof globalThis & {
    browser?: ExtensionApi;
    chrome?: ExtensionApi;
  };

  if (scope.chrome?.storage?.local) {
    return scope.chrome;
  }

  if (scope.browser?.storage?.local) {
    return scope.browser;
  }

  return scope.chrome ?? scope.browser;
}

async function storageGet(key: string): Promise<Record<string, unknown> | undefined> {
  const area = extensionApi()?.storage?.local;

  if (!area) {
    return undefined;
  }

  try {
    const maybePromise = area.get(key);
    if (maybePromise && typeof maybePromise.then === "function") {
      return await maybePromise;
    }
  } catch {
    return await new Promise((resolve) => {
      area.get(key, (items) => resolve(items));
    });
  }

  return await new Promise((resolve) => {
    area.get(key, (items) => resolve(items));
  });
}

async function storageSet(items: Record<string, unknown>): Promise<boolean> {
  const area = extensionApi()?.storage?.local;

  if (!area) {
    return false;
  }

  try {
    const maybePromise = area.set(items);
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    return true;
  } catch {
    await new Promise<void>((resolve) => {
      area.set(items, () => resolve());
    });
    return true;
  }
}

async function storageRemove(key: string): Promise<boolean> {
  const area = extensionApi()?.storage?.local;

  if (!area?.remove) {
    return false;
  }

  try {
    const maybePromise = area.remove(key);
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    return true;
  } catch {
    await new Promise<void>((resolve) => {
      area.remove?.(key, () => resolve());
    });
    return true;
  }
}

function isPromptList(value: unknown): value is SavedPrompt[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const prompt = item as Partial<SavedPrompt>;
    return (
      typeof prompt.id === "string" &&
      typeof prompt.title === "string" &&
      typeof prompt.body === "string" &&
      typeof prompt.createdAt === "string"
    );
  });
}

function promptStorageKeyForUser(userId: string): string {
  return `${PROMPTS_STORAGE_KEY}:user:${encodeURIComponent(userId)}`;
}

function fallbackStorageKeyFor(storageKey: string): string {
  return `${EXTENSION_NAMESPACE}:${storageKey}`;
}

function legacyFallbackStorageKeyFor(storageKey: string): string {
  return `${legacyExtensionNamespace}:${storageKey}`;
}

function loadFallbackStorageItem(storageKey: string): string | null {
  return (
    globalThis.localStorage?.getItem(fallbackStorageKeyFor(storageKey)) ??
    globalThis.localStorage?.getItem(legacyFallbackStorageKeyFor(storageKey)) ??
    null
  );
}

function isChatGptHost(hostname: string): boolean {
  return hostname.endsWith("chatgpt.com") || hostname === "chat.openai.com";
}

async function currentPromptStorageKey(): Promise<string> {
  const location = globalThis.location;
  if (!isChatGptHost(location.hostname)) {
    return PROMPTS_STORAGE_KEY;
  }

  try {
    const response = await fetch(`${location.origin}${chatGptSessionPath}`, {
      credentials: "include"
    });
    if (!response.ok) {
      return PROMPTS_STORAGE_KEY;
    }

    const session = await response.json() as ChatGptSession;
    const userId = session.user?.id;
    return typeof userId === "string" && userId.length > 0
      ? promptStorageKeyForUser(userId)
      : PROMPTS_STORAGE_KEY;
  } catch {
    return PROMPTS_STORAGE_KEY;
  }
}

async function removeLegacyPrompts(): Promise<void> {
  await storageRemove(PROMPTS_STORAGE_KEY);
  globalThis.localStorage?.removeItem(fallbackStorageKey);
  globalThis.localStorage?.removeItem(legacyFallbackStorageKey);
}

export async function loadPrompts(): Promise<SavedPrompt[]> {
  const storageKey = await currentPromptStorageKey();
  const extensionItems = await storageGet(storageKey);
  const extensionPrompts = extensionItems?.[storageKey];

  if (isPromptList(extensionPrompts)) {
    return extensionPrompts;
  }

  if (storageKey !== PROMPTS_STORAGE_KEY) {
    const legacyItems = await storageGet(PROMPTS_STORAGE_KEY);
    const legacyPrompts = legacyItems?.[PROMPTS_STORAGE_KEY];

    if (isPromptList(legacyPrompts)) {
      await savePrompts(legacyPrompts);
      await removeLegacyPrompts();
      return legacyPrompts;
    }
  }

  const raw = loadFallbackStorageItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPromptList(parsed)) {
      return [];
    }

    if (storageKey !== PROMPTS_STORAGE_KEY) {
      await savePrompts(parsed);
      await removeLegacyPrompts();
    }

    return parsed;
  } catch {
    return [];
  }
}

export async function savePrompts(prompts: SavedPrompt[]): Promise<void> {
  const storageKey = await currentPromptStorageKey();
  const savedToExtension = await storageSet({ [storageKey]: prompts });

  if (!savedToExtension) {
    globalThis.localStorage?.setItem(fallbackStorageKeyFor(storageKey), JSON.stringify(prompts));
  }
}

export async function loadStorageFlag(key: string): Promise<boolean> {
  const extensionItems = await storageGet(key);
  const extensionValue = extensionItems?.[key];

  if (typeof extensionValue === "boolean") {
    return extensionValue;
  }

  return loadFallbackStorageItem(key) === "true";
}

export async function saveStorageFlag(key: string, value: boolean): Promise<void> {
  const savedToExtension = await storageSet({ [key]: value });

  if (!savedToExtension) {
    globalThis.localStorage?.setItem(fallbackStorageKeyFor(key), String(value));
  }
}
