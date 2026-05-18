import type { MetadataRoute } from "next";

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
        src: "/logo.png",
        sizes: "1024x683",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
        purpose: "any",
      },
    ],
  };
}
