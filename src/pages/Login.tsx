import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signInWithMagicLink(email);
    setLoading(false);
    if (error) setError(error);
    else setSent(true);
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
        <h1 style={{ margin: "0 0 4px" }}>Wenn</h1>
        <p style={{ color: "var(--md-sys-color-on-surface-variant)", marginTop: 0 }}>
          Suivi de cycle, à deux.
        </p>

        {sent ? (
          <div>
            <p>
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Ouvre-le depuis ton téléphone
              pour te connecter.
            </p>
            <button className="btn btn-text" onClick={() => setSent(false)}>
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
            <input
              className="input"
              type="email"
              required
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {error && <p style={{ color: "var(--md-sys-color-error)", fontSize: 13, margin: 0 }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Recevoir un lien magique"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
