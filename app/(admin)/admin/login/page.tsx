import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAdminLocale } from "@/lib/admin-locale";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminLanguageSwitcher } from "@/components/admin/AdminLanguageSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const locale = getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin" });

  return {
    title: t("loginMetaTitle"),
    robots: {
      index: false,
      follow: false,
    },
  };
}

interface AdminLoginPageProps {
  searchParams?: {
    error?: string;
  };
}

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const admin = await getAdminUser();
  if (admin) {
    redirect("/admin");
  }

  const locale = getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin.login" });

  const initialError =
    searchParams?.error === "denied" ? "login.errors.accessDenied" : null;

  return (
    <div className="flex min-h-svh-safe items-center justify-center px-4 py-12 safe-pt safe-pb">
      <div className="w-full max-w-md rounded-2xl border border-navy-700 bg-navy-900 p-6 sm:p-8 shadow-xl">
        <div className="mb-6 flex justify-end">
          <AdminLanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {t("eyebrow")}
          </p>
          <h1
            dir="ltr"
            className="mt-2 font-serif text-2xl sm:text-3xl font-semibold uppercase tracking-wordmark text-ivory"
          >
            W Automobiles
          </h1>
          <div
            aria-hidden="true"
            className="mx-auto mt-3 h-[2px] w-10 rounded-full bg-brand-red"
          />
          <p className="mt-3 text-sm text-silver">{t("subtitle")}</p>
        </div>

        <AdminLoginForm initialError={initialError} />
      </div>
    </div>
  );
}
