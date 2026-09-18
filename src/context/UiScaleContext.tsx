import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const UI_SCALE_KEY = "wenn-ui-scale";

export const UI_SCALE_OPTIONS = [
  { value: 0.85, label: "Petite" },
  { value: 1, label: "Normale" },
  { value: 1.15, label: "Grande" },
  { value: 1.3, label: "Très grande" },
] as const;

interface UiScaleContextValue {
  scale: number;
  setScale: (scale: number) => void;
}

const UiScaleContext = createContext<UiScaleContextValue | undefined>(undefined);

function readStoredScale(): number {
  try {
    const value = Number(localStorage.getItem(UI_SCALE_KEY));
    return UI_SCALE_OPTIONS.some((o) => o.value === value) ? value : 1;
  } catch {
    return 1;
  }
}

/**
 * Taille d'affichage — un réglage propre à l'appareil (les deux téléphones
 * n'ont pas la même densité d'écran), indépendant du compte et non
 * synchronisé. Appliqué via `zoom` sur la racine, seule propriété qui
 * agrandit toute l'app (texte + mise en page) sans réécrire chaque taille en
 * dur ; suffisant puisque seul Android (WebView Chromium) est réellement
 * testé.
 */
export function UiScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(readStoredScale);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
  }, [scale]);

  function setScale(next: number) {
    try {
      localStorage.setItem(UI_SCALE_KEY, String(next));
    } catch {
      // ignore
    }
    setScaleState(next);
  }

  return <UiScaleContext.Provider value={{ scale, setScale }}>{children}</UiScaleContext.Provider>;
}

export function useUiScale() {
  const ctx = useContext(UiScaleContext);
  if (!ctx) throw new Error("useUiScale doit être utilisé dans UiScaleProvider");
  return ctx;
}
