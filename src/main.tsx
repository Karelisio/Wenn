import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { ModeProvider } from "./context/ModeContext";
import { ThemeModeProvider } from "./context/ThemeModeContext";
import { UiScaleProvider } from "./context/UiScaleContext";
import { applyThemeFromSeedColor, DEFAULT_SEED_COLOR } from "./lib/materialYou";
import { initDeepLinks } from "./lib/deepLink";
// Polices embarquées dans l'app (mêmes familles et graisses que l'ancien lien
// Google Fonts) : plus de téléchargement bloquant au démarrage sur un réseau
// lent, et plus de repli sur la police système hors connexion.
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/600.css";
import "@fontsource/quicksand/700.css";
import "./styles/global.css";

// Ce code tourne avant le montage de React : une exception ici ne serait
// rattrapée par aucun ErrorBoundary et laisserait un écran vide silencieux.
try {
  applyThemeFromSeedColor(DEFAULT_SEED_COLOR);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("applyThemeFromSeedColor a échoué :", err);
}

try {
  initDeepLinks();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("initDeepLinks a échoué :", err);
}

// Pas de StatusBar.hide() ici (même correctif que dans Orbit) : Android
// réaffichait la barre masquée en surimpression sur un fond noir, d'où la bande
// noire en haut. La barre d'état reste donc normale, et le contenu est décalé
// dessous par la zone de sécurité CSS (voir .app-shell dans global.css).

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeModeProvider>
        <UiScaleProvider>
          <ModeProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ModeProvider>
        </UiScaleProvider>
      </ThemeModeProvider>
    </ErrorBoundary>
  </StrictMode>
);
