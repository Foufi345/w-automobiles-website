import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { routing } from "@/i18n/routing";

/**
 * On-demand cache invalidation called after any admin vehicle mutation.
 * Ensures public pages, detail pages (all locales), and sitemap.xml reflect changes within seconds.
 */
export function revalidateCars(slug?: string): void {
  revalidateTag("cars");
  if (slug) {
    revalidateTag(`car:${slug}`);
  }

  for (const locale of routing.locales) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    revalidatePath(prefix || "/");
    revalidatePath(`${prefix}/vehicules`);
    revalidatePath(`${prefix}/contact`);
    if (slug) {
      revalidatePath(`${prefix}/vehicules/${slug}`);
    }
  }

  revalidatePath("/sitemap.xml");
}
