export const THEME_STORAGE_KEY = "awarix-theme";
/** Pre-rebrand theme key — ThemeProvider migrates then removes on first load. */
export const LEGACY_THEME_STORAGE_KEY = "coachflow-theme";

export type ThemeMode = "light" | "dark" | "system";

export const BRAND_EMERALD = "#059669";
export const BRAND_NAVY = "#0F172A";

export const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: "☀️",
    description: "Bright backgrounds with navy text for daytime use.",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "🌙",
    description: "Low-glare surfaces — the default Awarix experience.",
  },
  {
    value: "system",
    label: "System",
    icon: "💻",
    description: "Follow your device appearance settings automatically.",
  },
];
