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

/** Plafond de lignes par réponse de PostgREST (réglage par défaut de Supabase). */
const PAGE_SIZE = 1000;

interface RowsResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  status: number;
}

/**
 * Lit toutes les lignes d'une requête, page par page. PostgREST coupe toute
 * réponse à 1000 lignes sans erreur ni avertissement : au-delà, le reste de
 * l'historique manquait tout simplement. `build(from, to)` renvoie la requête
 * avec `.range(from, to)` et un ordre déterministe (sinon une ligne peut sauter
 * ou revenir d'une page à l'autre). Comme supabase-js, l'erreur est renvoyée,
 * jamais levée : l'appelant la teste (isNetworkError) exactement comme avant.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<RowsResult<T>>
): Promise<RowsResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error, status } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error, status };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null, status };
  }
}
