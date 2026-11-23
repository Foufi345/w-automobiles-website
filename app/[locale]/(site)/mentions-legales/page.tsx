import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getLocalizedSiteConfig } from "@/lib/config";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const config = getLocalizedSiteConfig(locale);
  const ogTitle = `${tSeo("legalTitle")} | ${tSeo("ogTitle")}`;
  const description = tSeo("legalDescription", { name: config.name });

  return {
    title: tSeo("legalTitle"),
    description,
    alternates: buildLocalizedAlternates("/mentions-legales", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/mentions-legales",
      siteName: config.name,
      title: ogTitle,
      description,
    }),
    twitter: buildLocalizedTwitter({
      title: ogTitle,
      description,
    }),
  };
}

export default async function MentionsLegalesPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "footer.legalPage" });
  const config = getLocalizedSiteConfig(locale);

  return (
    <div className="container-site py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-ivory">
            {t("title")}
          </h1>
        </div>

        <div className="rounded-xl border border-navy-700 bg-navy-900 p-6 sm:p-8 space-y-6 text-sm sm:text-base text-silver leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-serif text-xl font-semibold text-ivory">
              {t("publisherHeading")}
            </h2>
            <p>
              {t("publisherIntro")}{" "}
              <strong dir="ltr" className="text-ivory font-medium">
                {config.name}
              </strong>
              , {config.tagline}.
            </p>
            <ul className="list-disc ps-5 space-y-1">
              <li>
                <strong className="text-ivory font-medium">
                  {t("activityLabel")}
                </strong>{" "}
                {config.activity}
              </li>
              <li>
                <strong className="text-ivory font-medium">
                  {t("addressLabel")}
                </strong>{" "}
                {config.address.full}
              </li>
              <li>
                <strong className="text-ivory font-medium">
                  {t("phoneLabel")}
                </strong>{" "}
                <span dir="ltr">{config.contact.phone}</span>
              </li>
              {config.contact.email.trim() && (
                <li>
                  <strong className="text-ivory font-medium">
                    {t("emailLabel")}
                  </strong>{" "}
                  <span dir="ltr">{config.contact.email.trim()}</span>
                </li>
              )}
            </ul>
          </section>

          <section className="space-y-2 border-t border-navy-700/70 pt-6">
            <h2 className="font-serif text-xl font-semibold text-ivory">
              {t("vehiclesHeading")}
            </h2>
            <p>{t("vehiclesBody")}</p>
          </section>

          <section className="space-y-2 border-t border-navy-700/70 pt-6">
            <h2 className="font-serif text-xl font-semibold text-ivory">
              {t("privacyHeading")}
            </h2>
            <p>{t("privacyBody")}</p>
          </section>

          <section className="space-y-2 border-t border-navy-700/70 pt-6">
            <h2 className="font-serif text-xl font-semibold text-ivory">
              3D Model Attribution (CC BY-NC-SA 4.0)
            </h2>
            <p dir="ltr" className="text-xs sm:text-sm text-silver/90">
              &ldquo;2020 Audi RS7 Sportback&rdquo; (
              <a
                href="https://sketchfab.com/3d-models/2020-audi-rs7-sportback-61dd9575a8c645558aa912042af0cfc1"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-ivory"
              >
                Sketchfab
              </a>
              ) by{" "}
              <a
                href="https://sketchfab.com/ddiaz-design"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-ivory"
              >
                Ddiaz Design
              </a>{" "}
              is licensed under{" "}
              <a
                href="http://creativecommons.org/licenses/by-nc-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-ivory"
              >
                CC BY-NC-SA 4.0
              </a>
              . Modified for real-time WebGL rendering (normalized to meters,
              rigged wheel/steering/lighting hierarchy, blank license plate,
              Draco/WebP compression, and custom PBR materials).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
