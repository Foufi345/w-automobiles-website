import "server-only";
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";

export const ADMIN_LOCALE_COOKIE = "ADMIN_LOCALE";

/**
 * Resolves the active /admin UI locale from the ADMIN_LOCALE cookie (fr default).
 */
export function getAdminLocale(): AppLocale {
  const raw = cookies().get(ADMIN_LOCALE_COOKIE)?.value;
  if (raw && hasLocale(routing.locales, raw)) {
    return raw;
  }
  return "fr";
}
