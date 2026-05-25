import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachFlow",
    short_name: "CoachFlow",
    description: "The AI-powered operating system for football coaches.",
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
