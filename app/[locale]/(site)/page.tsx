import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getAllCars, getFeaturedCars, getFilterOptions } from "@/lib/cars";
import { getLocalizedSiteConfig } from "@/lib/config";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { HeroSection } from "@/components/hero/HeroSection";
import { HERO_ASSETS, HERO_SCENE } from "@/lib/hero-scene";
import { FeaturedCarsHorizontal } from "@/components/home/FeaturedCarsHorizontal";
import { BrandsMarquee } from "@/components/home/BrandsMarquee";
import { CountersRow } from "@/components/home/CountersRow";
import { WhyChooseUsSection } from "@/components/home/WhyChooseUsSection";
import { TradeInBanner } from "@/components/home/TradeInBanner";
import { VisitUsSection } from "@/components/home/VisitUsSection";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tHome = await getTranslations({ locale, namespace: "home.hero" });
  const config = getLocalizedSiteConfig(locale);
  const brands = config.brands.join(", ");

  return {
    title: {
      absolute: tSeo("siteTitleDefault"),
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
      description: tSeo("ogDescription", {
        activity: config.activity,
        brands,
      }),
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
  };
}

export default async function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [featuredCars, allCars, filterOptions, messages] = await Promise.all([
    getFeaturedCars(6, locale),
    getAllCars(locale),
    getFilterOptions(),
    getMessages(),
  ]);

  const homeMessages = pickMessages(messages, [
    "home",
    "car",
    "enums",
    "common",
    "whatsapp",
  ]);

  return (
    <NextIntlClientProvider messages={homeMessages}>
      {HERO_ASSETS.available && (
        <link
          rel="preload"
          as="image"
          type="image/webp"
          href={HERO_SCENE.carSrc}
          fetchPriority="high"
        />
      )}
      <div className="flex flex-col">
        {/* 1. HERO SECTION (2.5D Showroom Stage & GSAP Motion) */}
        <HeroSection />

        {/* 2. VÉHICULES EN VEDETTE (Pinned horizontal scroll desktop / swipe mobile) */}
        <FeaturedCarsHorizontal cars={featuredCars} />

        {/* 4. MARQUES (Infinite outlined marquee reacting to scroll velocity) */}
        <BrandsMarquee />

        {/* 5. COUNTERS (Counting up on enter from real data) */}
        <CountersRow
          totalCars={allCars.length}
          totalBrands={filterOptions.brands.length}
        />

        {/* 6. POURQUOI NOUS CHOISIR (Stagger rotation + SVG draw + Ivory transition) */}
        <WhyChooseUsSection />

        {/* 7. REPRISE CTA BAND (Background wipe + text reveal + pulsing WhatsApp) */}
        <TradeInBanner />

        {/* 8. VISIT US TEASER (SplitText reveals & showroom access) */}
        <VisitUsSection />
      </div>
    </NextIntlClientProvider>
  );
}
