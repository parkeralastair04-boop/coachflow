import type { MetadataRoute } from "next";
import { absoluteSitePath } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/academy/", "/book/", "/pricing", "/privacy", "/terms"],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/family",
          "/family/",
          "/billing",
          "/billing/",
          "/api",
          "/api/",
          "/auth",
          "/auth/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: absoluteSitePath("/sitemap.xml"),
  };
}
