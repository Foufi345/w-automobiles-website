import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getLocalizedSiteConfig } from "@/lib/config";
import { SITE_BASE_URL } from "@/lib/whatsapp";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { PageTransition } from "@/components/motion/PageTransition";
import { Preloader } from "@/components/motion/Preloader";

const MotionDebugOverlay =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@/components/dev/MotionDebugOverlay").then(
            (m) => m.MotionDebugOverlay
          ),
        { ssr: false }
      )
    : null;

const baseUrl = SITE_BASE_URL.replace(/\/$/, "");

export default async function SiteLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const config = getLocalizedSiteConfig(locale);

  const autoDealerJsonLd = {
    "@context": "https://schema.org",
    "@type": ["AutoDealer", "LocalBusiness"],
    "@id": `${baseUrl}/#organization`,
    inLanguage: locale,
    name: config.name,
    description: tSeo("jsonLdOrgDescription", {
      tagline: config.tagline,
      activity: config.activity,
    }),
    url: baseUrl,
    telephone: config.contact.whatsapp,
    ...(config.contact.email.trim()
      ? { email: config.contact.email.trim() }
      : {}),
    image: `${baseUrl}/images/showroom-hero.jpg`,
    priceRange: "DZD",
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address.street,
      addressLocality: config.address.city,
      postalCode: config.address.postalCode,
      addressCountry: "DZ",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 36.7667,
      longitude: 2.95,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Saturday",
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
        ],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    sameAs: [config.socials.instagramUrl],
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:border focus:border-brand-red focus:bg-navy-900 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ivory focus:shadow-lg"
      >
        {tCommon("skipToContent")}
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(autoDealerJsonLd),
        }}
      />
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <SmoothScroll />
      <PageTransition />
      <Preloader />
      {MotionDebugOverlay && <MotionDebugOverlay />}
    </>
  );
}
