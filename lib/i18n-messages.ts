import type { AbstractIntlMessages } from "next-intl";

/**
 * Picks only the requested top-level message namespaces so client bundles never
 * ship server-only namespaces (seo, footer, admin) or unrelated page dictionaries.
 */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[]
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const ns of namespaces) {
    if (ns in messages) {
      picked[ns] = messages[ns];
    }
  }
  return picked;
}
