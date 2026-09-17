import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { CoupleProvider, useCouple } from "./context/CoupleContext";
import { SoloProvider } from "./context/SoloContext";
import { useMode } from "./context/ModeContext";
import { useThemeMode } from "./context/ThemeModeContext";
import { applyThemeFromImageUrl, applyThemeFromSeedColor, DEFAULT_SEED_COLOR } from "./lib/materialYou";
import { getWallpaperSeedColor } from "./lib/wallpaperColor";
import ModeSelect from "./pages/ModeSelect";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Calendar from "./pages/Calendar";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import BottomNav from "./components/BottomNav";

function AppShell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Calendar />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function DuoGate() {
  const { couple, loading } = useCouple();
  if (loading) return <div className="center-screen">Chargement...</div>;
  if (!couple) return <Onboarding />;
  return <AppShell />;
}

function DuoApp() {
  const { session, loading, profile } = useAuth();
  const { isDark } = useThemeMode();

  useEffect(() => {
    let cancelled = false;

    async function applyTheme() {
      // Sur Android, le thème suit le fond d'écran du téléphone (propre à
      // chaque appareil, non synchronisé) — comme le Material You natif.
      const wallpaperColor = await getWallpaperSeedColor();
      if (cancelled) return;
      if (wallpaperColor) {
        applyThemeFromSeedColor(wallpaperColor, isDark);
        return;
      }

      // Sinon (iOS, navigateur), on retombe sur l'image de thème partagée.
      if (profile?.theme_image_url) {
        applyThemeFromImageUrl(profile.theme_image_url, isDark).catch(() =>
          applyThemeFromSeedColor(DEFAULT_SEED_COLOR, isDark)
        );
      } else if (profile?.theme_seed_color) {
        applyThemeFromSeedColor(profile.theme_seed_color, isDark);
      }
    }

    applyTheme();
    return () => {
      cancelled = true;
    };
  }, [profile?.theme_image_url, profile?.theme_seed_color, isDark]);

  if (loading) return <div className="center-screen">Chargement...</div>;
  if (!session) return <Login />;

  return (
    <CoupleProvider>
      <DuoGate />
    </CoupleProvider>
  );
}

function SoloApp() {
  return (
    <SoloProvider>
      <AppShell />
    </SoloProvider>
  );
}

export default function App() {
  const { mode } = useMode();

  return (
    <HashRouter>
      {mode === null ? <ModeSelect /> : mode === "solo" ? <SoloApp /> : <DuoApp />}
    </HashRouter>
  );
}
