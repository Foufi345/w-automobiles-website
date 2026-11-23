"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { siteConfig, getWhatsAppUrl } from "@/lib/config";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export function FloatingWhatsApp() {
  const tWa = useTranslations("whatsapp");
  const pathname = usePathname();
  const whatsappHref = getWhatsAppUrl(tWa("genericMessage"));

  // On /vehicules/[slug], mobile already displays a dedicated sticky bottom WhatsApp bar
  const isCarDetailPage =
    pathname.startsWith("/vehicules/") && pathname !== "/vehicules";

  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={tWa("floatingAria", { name: siteConfig.name })}
      title={tWa("floatingTitle")}
      className={`${
        isCarDetailPage ? "hidden lg:inline-flex" : "inline-flex"
      } fixed z-30 bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:end-6 h-14 w-14 items-center justify-center rounded-full bg-whatsapp-green text-white shadow-lg ring-1 ring-navy-950/20 transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ivory`}
    >
      <WhatsAppIcon className="h-6 w-6 sm:h-7 sm:w-7 fill-current" />
    </a>
  );
}
