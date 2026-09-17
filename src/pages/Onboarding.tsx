import { useState } from "react";
import { useCouple } from "../context/CoupleContext";
import { useAuth } from "../context/AuthContext";

export default function Onboarding() {
  const { createCouple, joinCouple } = useCouple();
  const { signOut } = useAuth();
  const [mode, setMode] = useState<"choice" | "create" | "join">("choice");
  const [name, setName] = useState("Nos règles");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const { error } = await createCouple(name);
    setLoading(false);
    if (error) setError(error);
  }

  async function handleJoin() {
    setLoading(true);
    setError(null);
    const { error } = await joinCouple(code);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        {mode === "choice" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ marginTop: 0, textAlign: "center" }}>Bienvenue 🌷</h2>
            <p style={{ color: "var(--md-sys-color-on-surface-variant)", textAlign: "center" }}>
              Es-tu celle qui suit son cycle, ou son/sa partenaire ?
            </p>
            <button className="btn btn-primary" onClick={() => setMode("create")}>
              Je suis la titulaire du cycle
            </button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>
              Je rejoins le cycle de ma/mon partenaire
            </button>
            <button className="btn btn-text" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </div>
        )}

        {mode === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ marginTop: 0 }}>Créer mon espace</h2>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: Nos règles)" />
            {error && <p style={{ color: "var(--md-sys-color-error)", fontSize: 13 }}>{error}</p>}
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? "Création..." : "Créer"}
            </button>
            <button className="btn btn-text" onClick={() => setMode("choice")}>
              Retour
            </button>
          </div>
        )}

        {mode === "join" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ marginTop: 0 }}>Rejoindre</h2>
            <p style={{ color: "var(--md-sys-color-on-surface-variant)", marginTop: -8 }}>
              Demande le code d'invitation à ta/ton partenaire (visible dans ses réglages).
            </p>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code d'invitation"
              style={{ textTransform: "uppercase" }}
            />
            {error && <p style={{ color: "var(--md-sys-color-error)", fontSize: 13 }}>{error}</p>}
            <button className="btn btn-primary" onClick={handleJoin} disabled={loading || !code}>
              {loading ? "Connexion..." : "Rejoindre"}
            </button>
            <button className="btn btn-text" onClick={() => setMode("choice")}>
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
