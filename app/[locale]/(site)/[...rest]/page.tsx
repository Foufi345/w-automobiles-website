import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Catch-all route inside [locale]/(site) so any unmatched path
 * (e.g. /en/unknown, /ar/unknown, /unknown, or unknown-locale /de/vehicules)
 * triggers the localized not-found page with the site header, footer, lang and dir.
 */
export default function CatchAllPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }
  notFound();
}
