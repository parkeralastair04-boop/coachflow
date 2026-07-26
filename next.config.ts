import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers for all routes.
 * CSP allows Stripe, Supabase, Turnstile, CapGo-style media, and Next.js assets.
 * See docs/abuse-protection.md for exceptions.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://challenges.cloudflare.com https://api.openai.com https://api.resend.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://billing.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://youtube.com https://player.vimeo.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Source-map upload runs only when Sentry auth + org/project are set.
 * Runtime error capture still works with DSN alone (see docs/sentry.md).
 */
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN?.trim() &&
    process.env.SENTRY_ORG?.trim() &&
    process.env.SENTRY_PROJECT?.trim(),
);

export default sentryUploadEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
    })
  : nextConfig;
