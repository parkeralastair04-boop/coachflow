import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.awarix.app",
  appName: "Awarix",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "https://awarix.co.uk",
    cleartext: false,
    allowNavigation: [
      "awarix.co.uk",
      "*.awarix.co.uk",
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
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
