import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/whatsapp";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_BASE_URL.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api/admin"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
