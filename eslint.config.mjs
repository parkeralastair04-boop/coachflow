import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const restrictedServerOnlyImports = {
  paths: [
    {
      name: "@/lib/supabase/admin",
      message:
        "Use server API routes or server-only libs. Do not import the service-role client in client code.",
    },
    {
      name: "@/lib/env/server",
      message: "Server environment helpers are not available in client code.",
    },
    {
      name: "@/lib/security-audit",
      message: "Audit logging is server-only.",
    },
    {
      name: "@/lib/stripe-webhook",
      message: "Stripe webhook handlers are server-only.",
    },
    {
      name: "@/lib/booking-confirmation",
      message: "Booking confirmation is server-only.",
    },
    {
      name: "@/lib/coach-billing",
      message: "Coach billing writes are server-only.",
    },
    {
      name: "@/lib/academy-membership",
      message: "Academy membership writes are server-only.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", restrictedServerOnlyImports],
    },
  },
  {
    files: ["lib/supabase.ts", "lib/public-booking.ts"],
    rules: {
      "no-restricted-imports": ["error", restrictedServerOnlyImports],
    },
  },
]);

export default eslintConfig;
