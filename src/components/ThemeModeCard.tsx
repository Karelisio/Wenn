import { useThemeMode, type ThemeMode } from "../context/ThemeModeContext";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Système" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

export default function ThemeModeCard() {
  const { themeMode, setThemeMode } = useThemeMode();

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Thème</h3>
      <div style={{ display: "flex", gap: 8 }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`chip${themeMode === opt.value ? " selected" : ""}`}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setThemeMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
