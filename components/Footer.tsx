import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getLocalizedSiteConfig, NAV_ITEMS } from "@/lib/config";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "footer" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const config = getLocalizedSiteConfig(locale);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-navy-700/80 bg-navy-950 text-ivory">
      <div className="container-site py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 lg:gap-12">
          {/* Column 1: Logo, short description, Instagram icon link */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex flex-col">
              <span
                dir="ltr"
                className="wordmark text-xl font-semibold text-ivory"
              >
                {config.name}
              </span>
              <span className="mt-0.5 text-xs tracking-wide text-silver">
                {tCommon("subtitleShort")}
              </span>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-silver">
              {t("description", {
                tagline: config.tagline,
                city: config.address.city,
                activity: config.activity,
                brands: config.brands.join(", "),
              })}
            </p>

            <div className="pt-1">
              <a
                href={config.socials.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("instagramAria", {
                  handle: config.socials.instagramHandle,
                  name: config.name,
                })}
                className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl border border-navy-700 bg-navy-900 px-4 py-2 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-brand-red"
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
                <span dir="ltr">{config.socials.instagramHandle}</span>
              </a>
            </div>
          </div>

          {/* Column 2: Quick links */}
          <div>
            <h2 className="font-serif text-base font-semibold uppercase tracking-wider text-ivory">
              {t("navigationHeading")}
            </h2>
            <ul className="mt-4 space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-[44px] items-center text-sm text-silver transition-colors hover:text-ivory"
                  >
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/localisation"
                  className="inline-flex min-h-[44px] items-center text-sm text-silver transition-colors hover:text-ivory"
                >
                  {tNav("location")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Address, phone, email, opening hours */}
          <div>
            <h2 className="font-serif text-base font-semibold uppercase tracking-wider text-ivory">
              {t("contactHeading")}
            </h2>
            <address className="mt-4 not-italic space-y-3 text-sm text-silver">
              <div className="flex items-start gap-3">
                <svg
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-red"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <a
                  href={config.address.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="leading-relaxed transition-colors hover:text-ivory"
                >
                  {config.address.full}
                </a>
              </div>

              <div className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-brand-red"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                  />
                </svg>
                <a
                  href={`tel:${config.contact.phone.replace(/[^0-9+]/g, "")}`}
                  dir="ltr"
                  className="inline-flex min-h-[44px] items-center transition-colors hover:text-ivory"
                >
                  {config.contact.phone}
                </a>
              </div>

              {config.contact.email.trim() && (
                <div className="flex items-center gap-3">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-brand-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  <a
                    href={`mailto:${config.contact.email.trim()}`}
                    dir="ltr"
                    className="inline-flex min-h-[44px] items-center transition-colors hover:text-ivory"
                  >
                    {config.contact.email.trim()}
                  </a>
                </div>
              )}

              <div className="flex items-start gap-3 pt-1">
                <svg
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-red"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="space-y-0.5">
                  <p className="text-ivory">{config.hours.schedule}</p>
                  <p className="text-xs text-silver">{config.hours.closed}</p>
                </div>
              </div>
            </address>
          </div>
        </div>

        {/* Bottom bar (extra bottom padding on mobile so floating WhatsApp never overlaps links) */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-navy-700/60 pt-6 pb-20 sm:flex-row sm:pb-0 safe-pb text-xs text-silver">
          <p>{t("copyright", { year: String(currentYear) })}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <LanguageSwitcher variant="footer" />
            <Link
              href="/mentions-legales"
              className="inline-flex min-h-[44px] items-center underline-offset-4 transition-colors hover:text-ivory hover:underline"
            >
              {t("legal")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
