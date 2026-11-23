"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig, getWhatsAppUrl } from "@/lib/config";

export default function LocaleNotFoundPage() {
  const t = useTranslations("errors");
  const tWa = useTranslations("whatsapp");
  const whatsappUrl = getWhatsAppUrl(tWa("notFoundMessage"));

  return (
    <section className="container-site py-20 sm:py-28">
      <div className="mx-auto max-w-2xl rounded-xl border border-navy-700 bg-navy-900 p-8 sm:p-12 text-center">
        <p className="font-serif text-xs font-semibold uppercase tracking-widest text-silver">
          {t("notFoundEyebrow", { name: siteConfig.name })}
        </p>

        <h1 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-ivory">
          {t("notFoundTitle")}
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm sm:text-base leading-relaxed text-silver">
          {t("notFoundDescription")}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5">
          <Link
            href="/vehicules"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-red px-7 py-3 text-sm font-semibold text-ivory shadow-sm transition-colors hover:bg-brand-red/90"
          >
            <span>{t("notFoundCtaCatalogue")}</span>
            <span aria-hidden="true" className="rtl:rotate-180">
              &rarr;
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
          >
            {t("notFoundCtaHome")}
          </Link>
        </div>

        <div className="mt-8 border-t border-navy-700/70 pt-6">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 text-xs sm:text-sm font-medium text-whatsapp-green underline-offset-4 hover:underline"
          >
            <span>{t("notFoundWhatsApp")}</span>
            <span aria-hidden="true" className="rtl:rotate-180">
              &rarr;
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
