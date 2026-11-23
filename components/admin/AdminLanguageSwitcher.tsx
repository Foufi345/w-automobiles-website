"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setAdminLocaleAction } from "@/lib/actions/admin-locale";
import type { AppLocale } from "@/i18n/routing";

const OPTIONS: Array<{ locale: AppLocale; code: string; nativeLabel: string }> =
  [
    { locale: "fr", code: "FR", nativeLabel: "Français" },
    { locale: "en", code: "EN", nativeLabel: "English" },
    { locale: "ar", code: "ع", nativeLabel: "العربية" },
  ];

/**
 * Compact, touch-friendly language switcher for /admin top bar and login page.
 * Sets the ADMIN_LOCALE cookie via Server Action and refreshes the server tree.
 */
export function AdminLanguageSwitcher() {
  const router = useRouter();
  const activeLocale = useLocale() as AppLocale;
  const t = useTranslations("admin");
  const [isPending, startTransition] = useTransition();

  const handleSelect = (nextLocale: AppLocale) => {
    if (nextLocale === activeLocale || isPending) return;
    startTransition(async () => {
      await setAdminLocaleAction(nextLocale);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t("languageLabel")}
      className="inline-flex items-center rounded-xl border border-navy-700 bg-navy-900 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.locale === activeLocale;
        return (
          <button
            key={opt.locale}
            type="button"
            lang={opt.locale}
            disabled={isPending}
            aria-pressed={active}
            aria-label={opt.nativeLabel}
            onClick={() => handleSelect(opt.locale)}
            className={`inline-flex min-h-[40px] min-w-[38px] sm:min-w-[42px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
              active
                ? "bg-brand-red text-ivory shadow-sm"
                : "text-silver hover:text-ivory"
            }`}
          >
            {opt.code}
          </button>
        );
      })}
    </div>
  );
}
