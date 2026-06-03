import { EXTENSION_NAMESPACE } from "../../shared/constants";

export type EnhanceSettings = {
  hideNativeTableOfContents: boolean;
};

type StorageArea = {
  get: (
    key: string,
    callback?: (items: Record<string, unknown>) => void
  ) => Promise<Record<string, unknown>> | void;
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

export const defaultEnhanceSettings: EnhanceSettings = {
  hideNativeTableOfContents: false
};

const settingsStorageKey = `${EXTENSION_NAMESPACE}:settings`;

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

function normalizeEnhanceSettings(value: unknown): EnhanceSettings {
  if (!value || typeof value !== "object") {
    return defaultEnhanceSettings;
  }

  const settings = value as Partial<EnhanceSettings>;
  return {
    hideNativeTableOfContents: settings.hideNativeTableOfContents === true
  };
}

function fallbackSettings(): EnhanceSettings {
  const raw = globalThis.localStorage?.getItem(settingsStorageKey);
  if (!raw) {
    return defaultEnhanceSettings;
  }

  try {
    return normalizeEnhanceSettings(JSON.parse(raw) as unknown);
  } catch {
    return defaultEnhanceSettings;
  }
}

export async function loadEnhanceSettings(): Promise<EnhanceSettings> {
  const extensionItems = await storageGet(settingsStorageKey);
  const extensionSettings = extensionItems?.[settingsStorageKey];

  if (extensionSettings) {
    return normalizeEnhanceSettings(extensionSettings);
  }

  return fallbackSettings();
}

export async function saveEnhanceSettings(settings: EnhanceSettings): Promise<void> {
  const normalized = normalizeEnhanceSettings(settings);
  const savedToExtensionStorage = await storageSet({ [settingsStorageKey]: normalized });

  if (!savedToExtensionStorage) {
    globalThis.localStorage?.setItem(settingsStorageKey, JSON.stringify(normalized));
  }
}
