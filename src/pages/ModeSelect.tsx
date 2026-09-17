import { useMode } from "../context/ModeContext";
import OrbitMark from "../components/OrbitMark";

export default function ModeSelect() {
  const { selectMode } = useMode();

  return (
    <div className="center-screen">
      <div className="card" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <OrbitMark size={56} />
        </div>
        <h1 style={{ margin: "0 0 4px" }}>Wenn</h1>
        <p style={{ color: "var(--md-sys-color-on-surface-variant)", marginTop: 0, marginBottom: 20 }}>
          Comment veux-tu utiliser l'app ?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
          <button className="btn btn-primary" style={{ padding: "18px 20px" }} onClick={() => selectMode("duo")}>
            <div style={{ fontSize: 15 }}>👫 Duo</div>
            <div style={{ fontWeight: 400, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              Compte partagé, synchronisé en temps réel avec ma/mon partenaire
            </div>
          </button>

          <button className="btn btn-secondary" style={{ padding: "18px 20px" }} onClick={() => selectMode("solo")}>
            <div style={{ fontSize: 15 }}>🙋 Solo</div>
            <div style={{ fontWeight: 400, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Aucun compte requis, les données restent uniquement sur cet appareil
            </div>
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", marginTop: 20, marginBottom: 0 }}>
          Tu pourras changer de mode plus tard depuis les réglages.
        </p>
      </div>
    </div>
  );
}
