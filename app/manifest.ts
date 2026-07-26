import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand-identity";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.shortDescription,
    theme_color: "#10B981",
    background_color: "#0F172A",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    icons: [
      {
        src: "/app-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon/512",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
      {
        src: "/app-icon/180",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
