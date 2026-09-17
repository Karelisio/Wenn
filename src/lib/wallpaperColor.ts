import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

interface WallpaperColorResult {
  available: boolean;
  primary?: string;
  secondary?: string;
  tertiary?: string;
}

interface WallpaperColorPlugin {
  getColors(): Promise<WallpaperColorResult>;
}

const WallpaperColor = registerPlugin<WallpaperColorPlugin>("WallpaperColor");

/**
 * Couleur dominante du fond d'écran système (Android 8.1+ uniquement, via
 * WallpaperManager#getWallpaperColors — la même API que le thème Material You
 * natif du téléphone). Pas d'équivalent public sur iOS/web : on utilise alors
 * l'image de thème choisie manuellement dans Réglages.
 */
export async function getWallpaperSeedColor(): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  try {
    const result = await WallpaperColor.getColors();
    return result.available && result.primary ? result.primary : null;
  } catch {
    return null;
  }
}
