import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getAllCars, getCarBySlug, getSimilarCars } from "@/lib/cars";
import { getLocalizedSiteConfig } from "@/lib/config";
import { getCarPlaceholderImage } from "@/lib/cloudinary-url";
import {
  formatCarPrice,
  formatMileageLocalized,
  formatPowerLocalized,
} from "@/lib/format";
import { FUEL_LABEL_KEY, TRANSMISSION_LABEL_KEY } from "@/lib/labels";
import { translateColor } from "@/lib/colors";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
  getLocalizedUrl,
  SCHEMA_BODY_TYPE,
  SCHEMA_FUEL_TYPE,
  SCHEMA_TRANSMISSION,
} from "@/lib/seo";
import { SITE_BASE_URL } from "@/lib/whatsapp";
import { VehicleDetailView } from "@/components/vehicle/VehicleDetailView";

export const dynamicParams = true;

interface CarDetailPageProps {
  params: {
    locale: string;
    slug: string;
  };
}

export async function generateStaticParams() {
  const cars = await getAllCars();
  return routing.locales.flatMap((locale) =>
    cars.map((car) => ({
      locale,
      slug: car.slug,
    }))
  );
}

export async function generateMetadata({
  params,
}: CarDetailPageProps): Promise<Metadata> {
  if (!hasLocale(routing.locales, params.locale)) return {};
  const { locale } = params;
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tEnums = await getTranslations({ locale, namespace: "enums" });
  const tCar = await getTranslations({ locale, namespace: "car" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const car = await getCarBySlug(params.slug, locale);
  if (!car) {
    return {
      title: tSeo("carNotFoundTitle"),
    };
  }

  const config = getLocalizedSiteConfig(locale);
  const priceText = formatCarPrice(car, locale, tCommon("priceOnRequest"));
  const mileageText = formatMileageLocalized(car.mileage, locale, {
    zeroNewLabel: tCommon("newZeroKm"),
  });
  const fuelLabel = tEnums(FUEL_LABEL_KEY[car.fuel]);
  const transmissionLabel = tEnums(TRANSMISSION_LABEL_KEY[car.transmission]);
  const powerText = car.power
    ? ` · ${formatPowerLocalized(car.power, locale)}`
    : "";

  const fullTitle = tSeo("carTitle", {
    brand: car.brand,
    model: car.model,
    year: String(car.year),
  });
  const description = tSeo("carDescription", {
    brand: car.brand,
    model: car.model,
    year: String(car.year),
    price: priceText,
    mileage: mileageText,
    fuel: fuelLabel,
    transmission: transmissionLabel,
    power: powerText,
    description: car.description,
  });

  const firstImage = car.images[0] ?? getCarPlaceholderImage(car.slug);
  const pathname = `/vehicules/${car.slug}`;

  return {
    title: {
      absolute: fullTitle,
    },
    description,
    alternates: buildLocalizedAlternates(pathname, locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname,
      siteName: config.name,
      title: fullTitle,
      description,
      type: "article",
      images: [
        {
          url: firstImage,
          width: 1200,
          height: 800,
          alt: tCar("cardImageAlt", {
            brand: car.brand,
            model: car.model,
            year: String(car.year),
          }),
        },
      ],
    }),
    twitter: buildLocalizedTwitter({
      title: fullTitle,
      description,
      images: [firstImage],
    }),
  };
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  if (!hasLocale(routing.locales, params.locale)) {
    notFound();
  }
  const { locale } = params;
  setRequestLocale(locale);

  const car = await getCarBySlug(params.slug, locale);
  if (!car || !car.published) {
    notFound();
  }

  const [tNav, similarCars, messages] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getSimilarCars(car, 3, locale),
    getMessages(),
  ]);
  const config = getLocalizedSiteConfig(locale);
  const baseUrl = SITE_BASE_URL.replace(/\/$/, "");
  const pageUrl = getLocalizedUrl(`/vehicules/${car.slug}`, locale);
  const homeUrl = getLocalizedUrl("/", locale);
  const vehiclesUrl = getLocalizedUrl("/vehicules", locale);

  const schemaCondition =
    car.condition === "Neuf"
      ? "https://schema.org/NewCondition"
      : "https://schema.org/UsedCondition";

  const schemaAvailability =
    car.status === "Vendu"
      ? "https://schema.org/SoldOut"
      : car.status === "Réservé"
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock";

  const resolvedImages = (
    car.images.length > 0 ? car.images : [getCarPlaceholderImage(car.slug)]
  ).map((img) => (img.startsWith("http") ? img : `${baseUrl}${img}`));

  const vehicleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": `${pageUrl}#vehicle`,
    inLanguage: locale,
    name: `${car.brand} ${car.model} ${car.year}`,
    brand: {
      "@type": "Brand",
      name: car.brand,
    },
    model: car.model,
    vehicleModelDate: String(car.year),
    bodyType: SCHEMA_BODY_TYPE[car.bodyType],
    fuelType: SCHEMA_FUEL_TYPE[car.fuel],
    vehicleTransmission: SCHEMA_TRANSMISSION[car.transmission],
    color: translateColor(car.color, locale) || undefined,
    numberOfDoors: car.doors,
    seatingCapacity: car.seats,
    vehicleEngine: {
      "@type": "EngineSpecification",
      name: [
        car.engine,
        car.power ? `(${formatPowerLocalized(car.power, locale)})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: car.mileage,
      unitCode: "KMT",
    },
    itemCondition: schemaCondition,
    description: car.description,
    image: resolvedImages,
    url: pageUrl,
    offers: {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: "DZD",
      ...(car.priceOnRequest || !car.price ? {} : { price: car.price }),
      itemCondition: schemaCondition,
      availability: schemaAvailability,
      seller: {
        "@type": "AutoDealer",
        "@id": `${baseUrl}/#organization`,
        name: config.name,
        address: config.address.full,
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: locale,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: tNav("home"),
        item: homeUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tNav("vehicles"),
        item: vehiclesUrl,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${car.brand} ${car.model} ${car.year}`,
        item: pageUrl,
      },
    ],
  };

  const detailMessages = pickMessages(messages, [
    "car",
    "enums",
    "common",
    "nav",
    "whatsapp",
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <NextIntlClientProvider messages={detailMessages}>
        <VehicleDetailView car={car} similarCars={similarCars} />
      </NextIntlClientProvider>
    </>
  );
}
