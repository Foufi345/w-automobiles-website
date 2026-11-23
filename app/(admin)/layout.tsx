import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getAdminLocale } from "@/lib/admin-locale";
import { amiri, cairo, cormorant, inter } from "@/lib/fonts";
import { pickMessages } from "@/lib/i18n-messages";
import "../globals.css";

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

export default async function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getAdminLocale();
  const isRtl = locale === "ar";
  const fontClasses = isRtl
    ? `${cormorant.variable} ${amiri.variable} ${cairo.variable}`
    : `${cormorant.variable} ${inter.variable}`;

  const allMessages = (await import(`@/messages/${locale}.json`)).default;
  const adminClientMessages = pickMessages(allMessages, [
    "admin",
    "enums",
    "common",
  ]);

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"} className={fontClasses}>
      <body className="min-h-svh-safe flex flex-col bg-navy-950 text-ivory">
        <NextIntlClientProvider locale={locale} messages={adminClientMessages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
