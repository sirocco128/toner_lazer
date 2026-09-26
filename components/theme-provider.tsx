"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  applyThemeToDocument,
  parseThemeId,
  THEME_STORAGE_KEY,
} from "@/lib/theme-presets";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      applyThemeToDocument(parseThemeId(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      applyThemeToDocument("forest");
    }
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
