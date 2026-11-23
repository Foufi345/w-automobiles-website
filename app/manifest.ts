import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.tagline} à Cheraga, Alger`,
    short_name: siteConfig.name,
    description: `${siteConfig.activity} à Cheraga, Alger.`,
    start_url: "/",
    display: "standalone",
    background_color: "#0B121A",
    theme_color: "#0B121A",
    lang: "fr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
