import { applyTheme, argbFromHex, hexFromArgb, themeFromImage, themeFromSourceColor } from "@material/material-color-utilities";

// Couleur pastel "rose poudré" utilisée tant qu'aucune image n'a été choisie.
export const DEFAULT_SEED_COLOR = "#e8b4c8";

function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applique un thème Material You (variables CSS --md-sys-color-*) au document. */
export async function applyThemeFromImageUrl(imageUrl: string): Promise<string> {
  const image = await loadImage(imageUrl);
  const theme = await themeFromImage(image);
  applyTheme(theme, { target: document.documentElement, dark: prefersDark() });
  return hexFromArgb(theme.source);
}

export function applyThemeFromSeedColor(hex: string): void {
  const theme = themeFromSourceColor(argbFromHex(hex));
  applyTheme(theme, { target: document.documentElement, dark: prefersDark() });
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
