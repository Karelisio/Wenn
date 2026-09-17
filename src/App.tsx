import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { CoupleProvider, useCouple } from "./context/CoupleContext";
import { applyThemeFromImageUrl, applyThemeFromSeedColor, DEFAULT_SEED_COLOR } from "./lib/materialYou";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Calendar from "./pages/Calendar";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import BottomNav from "./components/BottomNav";

function AppShell() {
  const { couple, loading } = useCouple();

  if (loading) return <div className="center-screen">Chargement...</div>;
  if (!couple) return <Onboarding />;

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

export default function App() {
  const { session, loading, profile } = useAuth();

  useEffect(() => {
    if (profile?.theme_image_url) {
      applyThemeFromImageUrl(profile.theme_image_url).catch(() => applyThemeFromSeedColor(DEFAULT_SEED_COLOR));
    } else if (profile?.theme_seed_color) {
      applyThemeFromSeedColor(profile.theme_seed_color);
    }
  }, [profile?.theme_image_url, profile?.theme_seed_color]);

  if (loading) return <div className="center-screen">Chargement...</div>;
  if (!session) return <Login />;

  return (
    <HashRouter>
      <CoupleProvider>
        <AppShell />
      </CoupleProvider>
    </HashRouter>
  );
}
