import type { CycleDay } from "../types";

const CYCLE_DAYS_KEY = "wenn-solo-cycle-days";
const SETTINGS_KEY = "wenn-solo-settings";

export interface LocalSettings {
  notifications_days_before: number;
  theme_image_url: string | null;
  theme_seed_color: string | null;
}

const DEFAULT_SETTINGS: LocalSettings = {
  notifications_days_before: 2,
  theme_image_url: null,
  theme_seed_color: null,
};

export function loadLocalCycleDays(): CycleDay[] {
  try {
    const raw = localStorage.getItem(CYCLE_DAYS_KEY);
    return raw ? (JSON.parse(raw) as CycleDay[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCycleDays(days: CycleDay[]): void {
  try {
    localStorage.setItem(CYCLE_DAYS_KEY, JSON.stringify(days));
  } catch {
    // stockage indisponible (navigation privée, quota) : la session en cours reste utilisable
  }
}

export function loadLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LocalSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveLocalSettings(settings: LocalSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/** Redimensionne une image choisie par l'utilisatrice en petite data URL (thème local, pas d'upload). */
export function resizeImageToDataUrl(file: File, maxDim = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
