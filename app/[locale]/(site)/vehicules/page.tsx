import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getAllCars, getFilterOptions } from "@/lib/cars";
import { getLocalizedSiteConfig } from "@/lib/config";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { VehiclesCatalog } from "@/components/VehiclesCatalog";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const config = getLocalizedSiteConfig(locale);
  const brands = config.brands.join(", ");
  const ogTitle = `${tSeo("vehiclesTitle")} | ${tSeo("ogTitle")}`;
  const ogDescription = tSeo("vehiclesOgDescription", { brands });

  return {
    title: tSeo("vehiclesTitle"),
    description: tSeo("vehiclesDescription", { name: config.name, brands }),
    alternates: buildLocalizedAlternates("/vehicules", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/vehicules",
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

export default async function VehiclesPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [cars, filterOptions, messages] = await Promise.all([
    getAllCars(locale),
    getFilterOptions(),
    getMessages(),
  ]);

  const pageMessages = pickMessages(messages, [
    "catalogue",
    "car",
    "enums",
    "common",
    "whatsapp",
  ]);

  return (
    <NextIntlClientProvider messages={pageMessages}>
      <VehiclesCatalog cars={cars} filterOptions={filterOptions} />
    </NextIntlClientProvider>
  );
}
