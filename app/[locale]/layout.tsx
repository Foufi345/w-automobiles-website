import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { amiri, cairo, cormorant, inter } from "@/lib/fonts";
import { getLocalizedSiteConfig } from "@/lib/config";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { SITE_BASE_URL } from "@/lib/whatsapp";
import "../globals.css";

const OverflowDetector =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@/components/dev/OverflowDetector").then(
            (m) => m.OverflowDetector
          ),
        { ssr: false }
      )
    : null;

const baseUrl = SITE_BASE_URL.replace(/\/$/, "");

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tHome = await getTranslations({ locale, namespace: "home.hero" });
  const config = getLocalizedSiteConfig(locale);
  const brands = config.brands.join(", ");
  const ogDescription = tSeo("ogDescription", {
    activity: config.activity,
    brands,
  });

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: tSeo("siteTitleDefault"),
      template: tSeo("siteTitleTemplate"),
    },
    description: tSeo("siteDescription", {
      name: config.name,
      activity: config.activity,
      brands,
    }),
    alternates: buildLocalizedAlternates("/", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/",
      siteName: config.name,
      title: tSeo("ogTitle"),
      description: ogDescription,
      images: [
        {
          url: "/images/showroom-hero.jpg",
          width: 1920,
          height: 1080,
          alt: tHome("imageAlt"),
        },
      ],
    }),
    twitter: buildLocalizedTwitter({
      title: tSeo("ogTitle"),
      description: tSeo("twitterDescription", {
        activity: config.activity,
      }),
    }),
    icons: {
      icon: "/icon.svg",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B121A",
  colorScheme: "dark",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: Readonly<LocaleLayoutProps>) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering across all public locales
  setRequestLocale(locale);

  const messages = await getMessages();
  const layoutMessages = pickMessages(messages, [
    "common",
    "nav",
    "whatsapp",
    "errors",
  ]);
  const isRtl = locale === "ar";
  const fontClasses = isRtl
    ? `${cormorant.variable} ${amiri.variable} ${cairo.variable}`
    : `${cormorant.variable} ${inter.variable}`;

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"} className={fontClasses}>
      <body className="min-h-svh-safe flex flex-col bg-navy-950 text-ivory">
        <NextIntlClientProvider messages={layoutMessages}>
          {children}
        </NextIntlClientProvider>
        {OverflowDetector && <OverflowDetector />}
      </body>
    </html>
  );
}
