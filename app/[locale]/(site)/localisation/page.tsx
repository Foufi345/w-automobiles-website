import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getLocalizedSiteConfig, getWhatsAppUrl } from "@/lib/config";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { OpeningHoursStatus } from "@/components/OpeningHoursStatus";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const config = getLocalizedSiteConfig(locale);
  const ogTitle = `${tSeo("locationTitle")} | ${tSeo("ogTitle")}`;
  const ogDescription = tSeo("locationOgDescription", {
    address: config.address.full,
  });

  return {
    title: tSeo("locationTitle"),
    description: tSeo("locationDescription", {
      name: config.name,
      address: config.address.full,
    }),
    alternates: buildLocalizedAlternates("/localisation", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/localisation",
      siteName: config.name,
      title: ogTitle,
      description: ogDescription,
    }),
    twitter: buildLocalizedTwitter({
      title: ogTitle,
      description: ogDescription,
    }),
  };
}

const WAZE_URL =
  "https://waze.com/ul?q=218%20Route%20de%20la%20gare%20routiere%20Cheraga%20Alger";

export default async function LocalisationPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [t, tCommon, tWa, messages] = await Promise.all([
    getTranslations({ locale, namespace: "location" }),
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "whatsapp" }),
    getMessages(),
  ]);
  const locationMessages = pickMessages(messages, ["location"]);
  const config = getLocalizedSiteConfig(locale);
  const whatsappUrl = getWhatsAppUrl(tWa("locationMessage"));

  return (
    <div className="container-site py-12 sm:py-16 lg:py-20 space-y-12">
      {/* Page Header & Full Address */}
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-silver">
          {t("eyebrow", { name: config.name })}
        </p>
        <h1 className="mt-1.5 font-serif text-4xl sm:text-5xl font-semibold text-ivory">
          {t("title")}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-ivory font-medium">
          {config.address.full}
        </p>
        <p className="mt-1 text-sm text-silver">{t("parkingNote")}</p>
      </div>

      {/* Main Grid: Map + Directions, Opening Hours Table */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7 space-y-5">
          <div className="overflow-hidden rounded-xl border border-navy-700 bg-navy-900 shadow-sm">
            <div className="relative h-[320px] sm:h-[380px] w-full bg-navy-950">
              <iframe
                title={tCommon("mapTitle", {
                  name: config.name,
                  address: config.address.full,
                })}
                src={config.address.googleMapsEmbedUrl}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0"
                allowFullScreen
              />
            </div>

            {/* Action bar below map */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-navy-700/80 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-silver">
                  {t("exactAddress")}
                </p>
                <p className="mt-0.5 text-sm font-medium text-ivory">
                  {config.address.full}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <a
                  href={config.address.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory shadow-sm transition-colors hover:bg-brand-red/90"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                    />
                  </svg>
                  <span>{t("directions")}</span>
                </a>

                <a
                  href={WAZE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-950 px-5 py-2.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-silver"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
                    />
                  </svg>
                  <span>{t("openWaze")}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Live Opening Hours Table */}
        <div className="lg:col-span-5">
          <NextIntlClientProvider messages={locationMessages}>
            <OpeningHoursStatus />
          </NextIntlClientProvider>
        </div>
      </div>

      {/* Repeat the WhatsApp CTA */}
      <section
        aria-labelledby="location-whatsapp-heading"
        className="rounded-xl border border-navy-700 bg-navy-900 p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="max-w-xl">
          <h2
            id="location-whatsapp-heading"
            className="font-serif text-2xl sm:text-3xl font-semibold text-ivory"
          >
            {t("ctaTitle")}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-silver">
            {t("ctaDescription")}
          </p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
        >
          <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
          <span>{t("ctaButton")}</span>
        </a>
      </section>
    </div>
  );
}
