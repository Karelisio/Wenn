import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { watchSystemThemeChanges } from "../lib/materialYou";

export type ThemeMode = "system" | "light" | "dark";

const THEME_MODE_KEY = "wenn-theme-mode";

interface ThemeModeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readStoredThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_MODE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

/**
 * Préférence clair/sombre/système — un réglage propre à l'appareil (comme le
 * fond d'écran), indépendant du mode solo/duo et non synchronisé.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readStoredThemeMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => watchSystemThemeChanges(() => setSystemDark(systemPrefersDark())), []);

  function setThemeMode(mode: ThemeMode) {
    try {
      localStorage.setItem(THEME_MODE_KEY, mode);
    } catch {
      // ignore
    }
    setThemeModeState(mode);
  }

  const isDark = themeMode === "system" ? systemDark : themeMode === "dark";

  return <ThemeModeContext.Provider value={{ themeMode, isDark, setThemeMode }}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode doit être utilisé dans ThemeModeProvider");
  return ctx;
}
