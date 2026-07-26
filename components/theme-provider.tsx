"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/theme";

function migrateLegacyThemeKey() {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (current) return;
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy) {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  } catch {
    // ignore private mode / quota
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    migrateLegacyThemeKey();
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
