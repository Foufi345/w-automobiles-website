import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getLocalizedSiteConfig, getWhatsAppUrl } from "@/lib/config";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { ShowroomGallery, ShowroomPhoto } from "@/components/ShowroomGallery";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tShowroom = await getTranslations({ locale, namespace: "showroom" });
  const config = getLocalizedSiteConfig(locale);
  const ogTitle = `${tSeo("showroomTitle")} | ${tSeo("ogTitle")}`;
  const ogDescription = tSeo("showroomOgDescription");

  return {
    title: tSeo("showroomTitle"),
    description: tSeo("showroomDescription", { name: config.name }),
    alternates: buildLocalizedAlternates("/showroom", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/showroom",
      siteName: config.name,
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: "/images/showroom/1.jpg",
          width: 1200,
          height: 800,
          alt: tShowroom("photos.hall.title"),
        },
      ],
    }),
    twitter: buildLocalizedTwitter({
      title: ogTitle,
      description: ogDescription,
      images: ["/images/showroom/1.jpg"],
    }),
  };
}

export default async function ShowroomPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [t, tWa, messages] = await Promise.all([
    getTranslations({ locale, namespace: "showroom" }),
    getTranslations({ locale, namespace: "whatsapp" }),
    getMessages(),
  ]);
  const showroomMessages = pickMessages(messages, ["showroom", "common"]);
  const config = getLocalizedSiteConfig(locale);
  const whatsappUrl = getWhatsAppUrl(tWa("showroomVisitMessage"));

  const showroomPhotos: readonly ShowroomPhoto[] = [
    {
      src: "/images/showroom/1.jpg",
      title: t("photos.hall.title"),
      caption: t("photos.hall.caption"),
    },
    {
      src: "/images/showroom/2.jpg",
      title: t("photos.reception.title"),
      caption: t("photos.reception.caption"),
    },
    {
      src: "/images/showroom/3.jpg",
      title: t("photos.tradeIn.title"),
      caption: t("photos.tradeIn.caption"),
    },
    {
      src: "/images/showroom/4.jpg",
      title: t("photos.delivery.title"),
      caption: t("photos.delivery.caption"),
    },
  ];

  const services = [
    {
      key: "sale",
      title: t("services.sale.title"),
      description: t("services.sale.description"),
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
          />
        </svg>
      ),
    },
    {
      key: "cashBuy",
      title: t("services.cashBuy.title"),
      description: t("services.cashBuy.description"),
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
          />
        </svg>
      ),
    },
    {
      key: "tradeIn",
      title: t("services.tradeIn.title"),
      description: t("services.tradeIn.description"),
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </svg>
      ),
    },
    {
      key: "guidance",
      title: t("services.guidance.title"),
      description: t("services.guidance.description"),
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* 1. HERO & BRAND STORY */}
      <section className="border-b border-navy-700/70 bg-navy-950 py-14 sm:py-20 lg:py-24">
        <div className="container-site">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("eyebrow", { name: config.name })}
            </p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold text-ivory">
              {t("title")}
            </h1>
            <div className="mt-6 h-[2px] w-14 bg-brand-red" aria-hidden="true" />
            <p className="mt-6 text-base sm:text-lg leading-relaxed text-silver">
              {t("storyPart1")}{" "}
              <strong dir="ltr" className="font-medium text-ivory">
                {config.name}
              </strong>{" "}
              {t("storyPart2")}
            </p>
          </div>
        </div>
      </section>

      {/* 2. PHOTO GALLERY GRID WITH LIGHTBOX */}
      <section
        aria-labelledby="showroom-gallery-heading"
        className="container-site py-14 sm:py-20"
      >
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("galleryEyebrow")}
            </p>
            <h2
              id="showroom-gallery-heading"
              className="mt-1 font-serif text-3xl sm:text-4xl font-semibold text-ivory"
            >
              {t("galleryTitle")}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-silver">{t("galleryHint")}</p>
        </div>

        <NextIntlClientProvider messages={showroomMessages}>
          <ShowroomGallery photos={showroomPhotos} />
        </NextIntlClientProvider>
      </section>

      {/* 3. OUR SERVICES */}
      <section
        aria-labelledby="services-heading"
        className="border-y border-navy-700/70 bg-navy-900/40 py-16 sm:py-24"
      >
        <div className="container-site">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("servicesEyebrow")}
            </p>
            <h2
              id="services-heading"
              className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-ivory"
            >
              {t("servicesTitle")}
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div
                key={service.key}
                className="flex flex-col rounded-xl border border-navy-700 bg-navy-900 p-6 transition-colors hover:border-silver/30"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-navy-700 bg-navy-950">
                  {service.icon}
                </div>
                <h3 className="mt-5 font-serif text-xl font-semibold text-ivory">
                  {service.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-silver">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. BRANDS WE WORK WITH */}
      <section
        aria-labelledby="showroom-brands-heading"
        className="container-site py-16 sm:py-20"
      >
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {t("brandsEyebrow")}
          </p>
          <h2
            id="showroom-brands-heading"
            className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-ivory"
          >
            {t("brandsTitle")}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-silver">
            {t("brandsSubtitle")}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {config.brands.map((brand) => (
            <Link
              key={brand}
              href={`/vehicules?brand=${encodeURIComponent(brand)}`}
              className="group flex min-h-[76px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 px-4 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red"
            >
              <span
                dir="ltr"
                className="font-serif text-lg sm:text-xl font-semibold uppercase tracking-widest text-silver transition-colors group-hover:text-ivory"
              >
                {brand}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. CTA TO CATALOGUE AND WHATSAPP */}
      <section
        aria-labelledby="showroom-cta-heading"
        className="container-site pb-16 sm:pb-24"
      >
        <div className="rounded-xl border border-navy-700 bg-navy-900 p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("ctaEyebrow")}
            </p>
            <h2
              id="showroom-cta-heading"
              className="mt-1.5 font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-ivory"
            >
              {t("ctaTitle")}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-silver leading-relaxed">
              {t("ctaDescription")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 shrink-0">
            <Link
              href="/vehicules"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-red px-7 py-3.5 text-sm font-semibold text-ivory shadow-sm transition-colors hover:bg-brand-red/90"
            >
              <span>{t("ctaCatalogue")}</span>
              <span aria-hidden="true" className="rtl:rotate-180">
                &rarr;
              </span>
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
              <span>{t("ctaWhatsApp")}</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
