import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { clearAllDuoCaches } from "../lib/backup";
import { clearAllPendingMutations, countAllPendingMutations } from "../lib/offlineQueue";
import { clearWidgets } from "../lib/widgetSync";
import type { Profile } from "../types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
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
