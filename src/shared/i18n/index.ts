import { en } from "./locales/en";

export type MessageKey = keyof typeof en;

type ChromeGlobal = typeof globalThis & {
  chrome?: {
    i18n?: {
      getMessage: (messageName: string, substitutions?: string | string[]) => string;
    };
  };
};

let isChromeI18nAvailable = true;

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context invalidated");
}

/**
 * Resolves the localized message for the given key using chrome.i18n.
 * Falls back to the static English dictionary if chrome.i18n is unavailable.
 *
 * @param key The translation message key, typechecked for safety.
 * @param substitutions A single string or array of strings to substitute for placeholders like $1, $2.
 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  const scope = globalThis as ChromeGlobal;

  try {
    if (isChromeI18nAvailable && scope.chrome?.i18n?.getMessage) {
      const message = scope.chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      isChromeI18nAvailable = false;
    } else {
      console.warn("chrome.i18n.getMessage failed:", error);
    }
  }

  // Fallback to static English dictionary
  const fallback = en[key];
  if (!fallback) {
    return key;
  }

  let msg: string = fallback.message;
  if (substitutions) {
    const subArray = Array.isArray(substitutions) ? substitutions : [substitutions];
    subArray.forEach((sub, i) => {
      msg = msg.replaceAll(`$${i + 1}`, sub);
    });
  }

  return msg;
}
export default t;
