import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAdminLocale } from "@/lib/admin-locale";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { logoutAdminAction } from "@/lib/auth/actions";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const locale = getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin" });

  return {
    title: {
      default: t("metaTitle"),
      template: t("metaTemplate"),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [admin, locale] = await Promise.all([
    getAdminUser(),
    Promise.resolve(getAdminLocale()),
  ]);
  const t = await getTranslations({ locale, namespace: "admin" });
  const publicHomeHref = locale === "fr" ? "/" : `/${locale}`;

  return (
    <div className="min-h-svh-safe flex flex-col bg-navy-950 text-ivory">
      {admin && (
        <header className="sticky top-0 z-30 safe-pt border-b border-navy-700/80 bg-navy-950/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-[60px] sm:min-h-[64px] w-full max-w-6xl items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6">
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] min-w-0 items-center gap-2 font-serif text-base sm:text-lg font-semibold tracking-wide text-ivory"
            >
              <span dir="ltr" className="truncate">
                W Automobiles
              </span>
              <span
                className="hidden sm:inline text-brand-red"
                aria-hidden="true"
              >
                &middot;
              </span>
              <span className="hidden sm:inline font-sans text-xs sm:text-sm font-medium text-silver">
                {t("title")}
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <AdminLanguageSwitcher />

              <a
                href={publicHomeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-2 text-xs sm:text-sm font-medium text-ivory transition-colors hover:border-silver/50"
              >
                {t("viewSite")}
              </a>

              <form action={logoutAdminAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-brand-red/70 bg-brand-red/10 px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-ivory transition-colors hover:bg-brand-red"
                >
                  {t("logout")}
                </button>
              </form>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1">{children}</main>
    </div>
  );
}
