import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Configuration Supabase manquante. Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans un fichier .env (voir .env.example)."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * supabase-js v2 ne lève pas d'exception sur un échec réseau : il renvoie
 * `{ data: null, error, status: 0 }` (message du type "TypeError: Failed to
 * fetch"). À tester explicitement pour distinguer l'absence de connexion (on
 * garde la copie locale, on met l'écriture en file) d'un vrai refus du serveur.
 */
export function isNetworkError(error: { message?: string } | null | undefined, status?: number): boolean {
  if (!error) return false;
  return (
    status === 0 ||
    /Failed to fetch|NetworkError|Network request failed|Load failed/i.test(error.message ?? "") ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}
