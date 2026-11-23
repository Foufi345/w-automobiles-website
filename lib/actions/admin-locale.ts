"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { ADMIN_LOCALE_COOKIE } from "@/lib/admin-locale";

export async function setAdminLocaleAction(
  nextLocale: string
): Promise<{ ok: boolean; locale: AppLocale }> {
  const locale: AppLocale = hasLocale(routing.locales, nextLocale)
    ? nextLocale
    : "fr";

  cookies().set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/admin", "layout");
  return { ok: true, locale };
}
