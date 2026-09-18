import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ModeProvider } from "./context/ModeContext";
import { ThemeModeProvider } from "./context/ThemeModeContext";
import { UiScaleProvider } from "./context/UiScaleContext";
import { applyThemeFromSeedColor, DEFAULT_SEED_COLOR } from "./lib/materialYou";
import { initDeepLinks } from "./lib/deepLink";
import "./styles/global.css";

applyThemeFromSeedColor(DEFAULT_SEED_COLOR);
initDeepLinks();

// Barre d'état (heure, batterie...) masquée dans l'app : elle n'apporte rien
// ici et se superposait au contenu (l'app dessine son propre fond dégradé).
if (Capacitor.isNativePlatform()) {
  StatusBar.hide().catch(() => {
    // plateforme sans barre de statut contrôlable : tant pis
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeModeProvider>
      <UiScaleProvider>
        <ModeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ModeProvider>
      </UiScaleProvider>
    </ThemeModeProvider>
  </StrictMode>
);
