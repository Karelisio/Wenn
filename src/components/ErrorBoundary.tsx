import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité : sans ça, une exception pendant le rendu démonte tout
 * l'arbre React sans rien afficher (écran vide/noir silencieux, impossible
 * à diagnostiquer à distance). Affiche l'erreur à la place.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Erreur non gérée dans Wenn :", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            // La barre d'état reste affichée (bord à bord) : le texte commence dessous.
            padding: "calc(16px + var(--safe-top, 8px)) 24px 24px",
            fontFamily: "monospace",
            background: "#fffbfe",
            color: "#1c1b1f",
            minHeight: "100dvh",
          }}
        >
          <h2 style={{ color: "#b3261e" }}>Wenn a rencontré une erreur</h2>
          <p>{this.state.error.message}</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.8 }}>{this.state.error.stack}</pre>
          <button
            style={{ marginTop: 16, padding: "10px 16px", borderRadius: 999, border: "none", background: "#6750a4", color: "white" }}
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
