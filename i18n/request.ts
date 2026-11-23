import { getRequestConfig } from "next-intl/server";
import { hasLocale, IntlErrorCode } from "next-intl";
import { routing } from "./routing";

type MessageTree = Record<string, unknown>;

function deepMergeFallback(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMergeFallback(
        result[key] as MessageTree,
        value as MessageTree
      );
    } else if (value !== undefined && value !== "") {
      result[key] = value;
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const frMessages = (await import("../messages/fr.json")).default as MessageTree;
  const localeMessages =
    locale === "fr"
      ? frMessages
      : ((await import(`../messages/${locale}.json`)).default as MessageTree);

  const isDev = process.env.NODE_ENV === "development";

  // In production, merge with French as a guaranteed fallback for any missing key.
  // In development, keep only the locale's own messages so missing keys trigger a visible marker & warning.
  const messages = isDev
    ? localeMessages
    : deepMergeFallback(frMessages, localeMessages);

  return {
    locale,
    messages,
    timeZone: "Africa/Algiers",
    onError(error) {
      if (isDev && error.code === IntlErrorCode.MISSING_MESSAGE) {
        console.warn(`[i18n missing key] (${locale}) ${error.message}`);
      } else if (error.code !== IntlErrorCode.MISSING_MESSAGE) {
        console.error(error);
      }
    },
    getMessageFallback({ namespace, key }) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      if (isDev) {
        return `[MISSING: ${fullKey}]`;
      }
      return fullKey;
    },
  };
});
