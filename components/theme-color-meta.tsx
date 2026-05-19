"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { BRAND_EMERALD } from "@/lib/theme";

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", resolvedTheme === "light" ? "#fafafa" : BRAND_EMERALD);
  }, [resolvedTheme]);

  return null;
}
