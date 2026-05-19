import type { MetadataRoute } from "next";
import { BRAND_LOGO_SRC } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachFlow",
    short_name: "CoachFlow",
    description: "The AI-powered operating system for football coaches.",
    theme_color: "#10B981",
    background_color: "#0F172A",
    display: "standalone",
    start_url: "/",
    scope: "/",
    icons: [
      {
        src: BRAND_LOGO_SRC,
        sizes: "1024x683",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_LOGO_SRC,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_LOGO_SRC,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_LOGO_SRC,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
