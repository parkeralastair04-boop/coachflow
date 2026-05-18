import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.coachflow.app",
  appName: "CoachFlow",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "https://coachflow.website",
    cleartext: false,
    allowNavigation: [
      "coachflow.website",
      "*.coachflow.website",
      "*.supabase.co",
      "checkout.stripe.com",
      "billing.stripe.com",
      "js.stripe.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0F172A",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
