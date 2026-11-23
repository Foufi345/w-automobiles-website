import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getLocalizedSiteConfig, getWhatsAppUrl } from "@/lib/config";
import { getAllCars } from "@/lib/cars";
import { pickMessages } from "@/lib/i18n-messages";
import {
  buildLocalizedAlternates,
  buildLocalizedOpenGraph,
  buildLocalizedTwitter,
} from "@/lib/seo";
import { ContactForm } from "@/components/ContactForm";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const config = getLocalizedSiteConfig(locale);
  const ogTitle = `${tSeo("contactTitle")} | ${tSeo("ogTitle")}`;
  const ogDescription = tSeo("contactOgDescription");

  return {
    title: tSeo("contactTitle"),
    description: tSeo("contactDescription", { name: config.name }),
    alternates: buildLocalizedAlternates("/contact", locale),
    openGraph: buildLocalizedOpenGraph({
      locale,
      pathname: "/contact",
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

export default async function ContactPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [t, tCommon, tWa, cars, messages] = await Promise.all([
    getTranslations({ locale, namespace: "contact" }),
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "whatsapp" }),
    getAllCars(locale),
    getMessages(),
  ]);
  const config = getLocalizedSiteConfig(locale);
  const contactMessages = pickMessages(messages, ["contact", "whatsapp"]);
  const vehicleOptions = cars.map((c) => ({
    slug: c.slug,
    label: `${c.brand} ${c.model} (${c.year})`,
  }));

  const whatsappDirectUrl = getWhatsAppUrl(tWa("contactDirectMessage"));

  const contactCards = [
    {
      key: "whatsapp",
      title: tCommon("whatsapp"),
      value: config.contact.whatsapp,
      subtitle: t("cards.whatsappSubtitle"),
      href: whatsappDirectUrl,
      external: true,
      accent: "border-whatsapp-green/50 hover:border-whatsapp-green",
      icon: (
        <WhatsAppIcon className="h-6 w-6 fill-current text-whatsapp-green" />
      ),
    },
    {
      key: "phone",
      title: t("cards.phoneTitle"),
      value: config.contact.phone,
      subtitle: config.hours.schedule,
      href: `tel:${config.contact.phone.replace(/[^0-9+]/g, "")}`,
      external: false,
      accent: "border-navy-700 hover:border-brand-red",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
          />
        </svg>
      ),
    },
    ...(config.contact.email.trim()
      ? [
          {
            key: "email",
            title: t("cards.emailTitle"),
            value: config.contact.email.trim(),
            subtitle: t("cards.emailSubtitle"),
            href: `mailto:${config.contact.email.trim()}`,
            external: false,
            accent: "border-navy-700 hover:border-brand-red",
            icon: (
              <svg
                aria-hidden="true"
                className="h-6 w-6 text-brand-red"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            ),
          },
        ]
      : []),
    {
      key: "instagram",
      title: "Instagram",
      value: config.socials.instagramHandle,
      subtitle: t("cards.instagramSubtitle"),
      href: config.socials.instagramUrl,
      external: true,
      accent: "border-navy-700 hover:border-brand-red",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-brand-red"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="container-site py-12 sm:py-16 lg:py-20">
      {/* Header */}
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-silver">
          {t("eyebrow", { name: config.name })}
        </p>
        <h1 className="mt-1.5 font-serif text-4xl sm:text-5xl font-semibold text-ivory">
          {t("title")}
        </h1>
        <p className="mt-3 text-base text-silver leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      {/* Large Tappable Contact Cards */}
      <div
        className={`mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          contactCards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {contactCards.map((card) => (
          <a
            key={card.key}
            href={card.href}
            target={card.external ? "_blank" : undefined}
            rel={card.external ? "noopener noreferrer" : undefined}
            className={`group flex flex-col justify-between rounded-xl border bg-navy-900 p-6 transition-all duration-200 hover:-translate-y-0.5 ${card.accent}`}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-navy-700 bg-navy-950">
                {card.icon}
              </div>
              <span
                aria-hidden="true"
                className="text-silver transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 group-hover:text-ivory"
              >
                &rarr;
              </span>
            </div>

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-silver">
                {card.title}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-ivory break-all text-start">
                <bdi dir="ltr">{card.value}</bdi>
              </p>
              <p className="mt-1 text-xs text-silver">{card.subtitle}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Form + Address Side Card */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <NextIntlClientProvider messages={contactMessages}>
            <ContactForm vehicles={vehicleOptions} />
          </NextIntlClientProvider>
        </div>

        <aside className="lg:col-span-5 rounded-xl border border-navy-700 bg-navy-900 p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("aside.addressEyebrow")}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ivory">
              {t("aside.addressTitle")}
            </h2>
            <p className="mt-2 text-sm text-silver leading-relaxed">
              {config.address.full}
            </p>
          </div>

          <div className="border-t border-navy-700/70 pt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-silver">
              {t("aside.hoursLabel")}
            </p>
            <p className="mt-1.5 text-sm font-medium text-ivory">
              {config.hours.schedule}
            </p>
            <p className="text-xs text-silver mt-0.5">{config.hours.closed}</p>
          </div>

          <div className="border-t border-navy-700/70 pt-5 flex flex-col gap-3">
            <Link
              href="/localisation"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-950 px-5 py-3 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
            >
              <span>{t("aside.mapLink")}</span>
              <span aria-hidden="true" className="rtl:rotate-180">
                &rarr;
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
