import { applyTheme, argbFromHex, hexFromArgb, themeFromImage, themeFromSourceColor } from "@material/material-color-utilities";

// Couleur pastel "rose poudré" utilisée tant qu'aucune image n'a été choisie.
export const DEFAULT_SEED_COLOR = "#e8b4c8";

function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Applique un thème Material You (variables CSS --md-sys-color-*) au document.
 * `dark` force le mode clair/sombre ; omis, il suit la préférence système.
 */
export async function applyThemeFromImageUrl(imageUrl: string, dark?: boolean): Promise<string> {
  const image = await loadImage(imageUrl);
  const theme = await themeFromImage(image);
  const isDark = dark ?? prefersDark();
  applyTheme(theme, { target: document.documentElement, dark: isDark });
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  return hexFromArgb(theme.source);
}

export function applyThemeFromSeedColor(hex: string, dark?: boolean): void {
  const theme = themeFromSourceColor(argbFromHex(hex));
  const isDark = dark ?? prefersDark();
  applyTheme(theme, { target: document.documentElement, dark: isDark });
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function watchSystemThemeChanges(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => onChange();
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
