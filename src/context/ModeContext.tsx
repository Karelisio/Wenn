import { createContext, useContext, useState, type ReactNode } from "react";

export type LaunchMode = "solo" | "duo";

const MODE_KEY = "wenn-mode";

interface ModeContextValue {
  mode: LaunchMode | null;
  selectMode: (mode: LaunchMode) => void;
  resetMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

function readStoredMode(): LaunchMode | null {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === "solo" || value === "duo" ? value : null;
  } catch {
    return null;
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LaunchMode | null>(readStoredMode);

  function selectMode(next: LaunchMode) {
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // stockage indisponible (navigation privée) : le choix ne survivra pas au rechargement
    }
    setMode(next);
  }

  function resetMode() {
    try {
      localStorage.removeItem(MODE_KEY);
    } catch {
      // ignore
    }
    setMode(null);
  }

  return <ModeContext.Provider value={{ mode, selectMode, resetMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode doit être utilisé dans ModeProvider");
  return ctx;
}
