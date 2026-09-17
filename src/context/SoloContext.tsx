import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CycleDataContext, type CycleDataValue } from "./CycleDataContext";
import { loadLocalCycleDays, loadLocalSettings, saveLocalCycleDays, saveLocalSettings, type LocalSettings } from "../lib/localStore";
import { applyThemeFromImageUrl, applyThemeFromSeedColor, DEFAULT_SEED_COLOR } from "../lib/materialYou";
import { getWallpaperSeedColor } from "../lib/wallpaperColor";
import { useThemeMode } from "./ThemeModeContext";
import type { CycleDay } from "../types";

interface SoloProfileContextValue {
  settings: LocalSettings;
  updateSettings: (fields: Partial<LocalSettings>) => void;
}

const SoloProfileContext = createContext<SoloProfileContextValue | undefined>(undefined);

export function useSoloProfile() {
  const ctx = useContext(SoloProfileContext);
  if (!ctx) throw new Error("useSoloProfile doit être utilisé dans SoloProvider");
  return ctx;
}

export function SoloProvider({ children }: { children: ReactNode }) {
  const [cycleDays, setCycleDays] = useState<CycleDay[]>(() => loadLocalCycleDays());
  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const { isDark } = useThemeMode();

  useEffect(() => {
    let cancelled = false;
    async function applyTheme() {
      const wallpaperColor = await getWallpaperSeedColor();
      if (cancelled) return;
      if (wallpaperColor) {
        applyThemeFromSeedColor(wallpaperColor, isDark);
        return;
      }
      if (settings.theme_image_url) {
        applyThemeFromImageUrl(settings.theme_image_url, isDark).catch(() =>
          applyThemeFromSeedColor(DEFAULT_SEED_COLOR, isDark)
        );
      } else if (settings.theme_seed_color) {
        applyThemeFromSeedColor(settings.theme_seed_color, isDark);
      }
    }
    applyTheme();
    return () => {
      cancelled = true;
    };
  }, [settings.theme_image_url, settings.theme_seed_color, isDark]);

  function updateSettings(fields: Partial<LocalSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...fields };
      saveLocalSettings(next);
      return next;
    });
  }

  async function upsertCycleDay(
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) {
    setCycleDays((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((d) => d.date === date);
      let next: CycleDay[];
      if (existing) {
        next = prev.map((d) => (d.date === date ? { ...d, ...fields, updated_at: now } : d));
      } else {
        const created: CycleDay = {
          id: crypto.randomUUID(),
          couple_id: "solo",
          date,
          flow: fields.flow ?? null,
          vaginal_pain: fields.vaginal_pain ?? null,
          symptoms: fields.symptoms ?? [],
          mood: fields.mood ?? null,
          note: fields.note ?? null,
          updated_by: null,
          created_at: now,
          updated_at: now,
        };
        next = [...prev, created];
      }
      next.sort((a, b) => a.date.localeCompare(b.date));
      saveLocalCycleDays(next);
      return next;
    });
    return { error: null };
  }

  const cycleDataValue: CycleDataValue = {
    mode: "solo",
    coupleName: "Mon cycle",
    role: "owner",
    canEdit: true,
    averageCycleLength: 28,
    averagePeriodLength: 5,
    cycleDays,
    partnerNotes: [],
    loading: false,
    upsertCycleDay,
    addPartnerNote: async () => ({ error: "Indisponible en mode solo" }),
  };

  return (
    <SoloProfileContext.Provider value={{ settings, updateSettings }}>
      <CycleDataContext.Provider value={cycleDataValue}>{children}</CycleDataContext.Provider>
    </SoloProfileContext.Provider>
  );
}
