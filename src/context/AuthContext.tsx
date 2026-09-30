import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  APP_LINK_ORIGIN,
  clearLoginLinkError,
  markLoginLinkRequested,
  reportUnusedWebLoginLink,
  subscribeLoginLinkError,
} from "../lib/deepLink";
import { clearAllDuoCaches } from "../lib/backup";
import { clearAllPendingMutations, countAllPendingMutations } from "../lib/offlineQueue";
import { clearWidgets } from "../lib/widgetSync";
import type { Profile } from "../types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Échec du dernier lien de connexion reçu (affiché sur l'écran de connexion). */
  loginLinkError: string | null;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLinkError, setLoginLinkError] = useState<string | null>(null);

  useEffect(() => subscribeLoginLinkError(setLoginLinkError), []);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
      reportUnusedWebLoginLink(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        clearLoginLinkError();
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithMagicLink(email: string) {
    clearLoginLinkError();
    // Trace de la demande faite sur cet appareil (voir deepLink.ts). Le secret PKCE,
    // lui, est gardé par supabase-js : le lien ne marchera que sur cet appareil.
    markLoginLinkRequested();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Dans l'app, window.location.origin vaut https://localhost : le lien ne
        // marchait que grâce au repli de Supabase sur l'URL du site. On vise
        // explicitement le domaine des App Links, qui rouvre l'app.
        emailRedirectTo: Capacitor.isNativePlatform() ? APP_LINK_ORIGIN : window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    // Écritures faites hors ligne pas encore envoyées : elles sont effacées avec le
    // reste ci-dessous, donc perdues. On prévient avant.
    const pending = countAllPendingMutations();
    if (
      pending > 0 &&
      !window.confirm(
        pending > 1
          ? `${pending} modifications pas encore envoyées seront perdues. Te déconnecter quand même ?`
          : "1 modification pas encore envoyée sera perdue. Te déconnecter quand même ?"
      )
    ) {
      return;
    }
    await supabase.auth.signOut();
    // Rien de l'espace partagé ne reste sur le téléphone après la déconnexion : ni la
    // copie locale (tout l'historique et les mots doux), ni la file d'attente, ni les
    // dates affichées par les widgets.
    clearAllDuoCaches();
    clearAllPendingMutations();
    clearWidgets();
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        loginLinkError,
        signInWithMagicLink,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
