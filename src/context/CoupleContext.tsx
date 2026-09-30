import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { App } from "@capacitor/app";
import { isNetworkError, supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { CycleDataContext, type CycleDataValue } from "./CycleDataContext";
import { saveDuoCache, loadDuoCache, clearDuoCache } from "../lib/backup";
import {
  enqueueMutation,
  getPendingMutations,
  removeMutation,
  type MutationPayload,
  type QueuedMutation,
} from "../lib/offlineQueue";
import type { Couple, CycleDay, FlowIntensity, PartnerNote } from "../types";

interface CoupleContextValue {
  couple: Couple | null;
  role: "owner" | "partner" | null;
  otherPartyEmail: string | null;
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
  loading: boolean;
  /** Échec du chargement sans copie locale à afficher (DuoGate propose alors de réessayer). */
  loadError: string | null;
  offline: boolean;
  pendingSyncCount: number;
  createCouple: (name: string) => Promise<{ error: string | null }>;
  joinCouple: (inviteCode: string) => Promise<{ error: string | null }>;
  leaveCouple: () => Promise<{ error: string | null }>;
  renameCouple: (name: string) => Promise<{ error: string | null }>;
  upsertCycleDay: (
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) => Promise<{ error: string | null }>;
  addPartnerNote: (date: string, message: string) => Promise<{ error: string | null }>;
  reload: () => Promise<void>;
}

const CoupleContext = createContext<CoupleContextValue | undefined>(undefined);

const OFFLINE_MESSAGE = "Pas de connexion internet. Vérifie le réseau puis réessaie.";

/** Message à afficher pour une erreur Supabase (l'absence de réseau dite en clair). */
function errorMessage(error: { message: string }, status: number): string {
  return isNetworkError(error, status) ? OFFLINE_MESSAGE : error.message;
}

/**
 * Envoie une écriture au serveur (directe, ou rejouée depuis la file d'attente).
 * supabase-js renvoie ses erreurs au lieu de les lever ; une exception inattendue
 * est traitée comme un échec réseau (status 0), pour que l'écriture soit gardée en
 * file plutôt que perdue.
 */
async function sendMutation(
  coupleId: string,
  userId: string,
  mutation: MutationPayload
): Promise<{ error: { message: string } | null; status: number }> {
  try {
    const { error, status } =
      mutation.type === "upsertCycleDay"
        ? await supabase
            .from("cycle_days")
            .upsert(
              { couple_id: coupleId, date: mutation.date, updated_by: userId, ...mutation.fields },
              { onConflict: "couple_id,date" }
            )
        : await supabase
            .from("partner_notes")
            .insert({ couple_id: coupleId, date: mutation.date, message: mutation.message, author_id: userId });
    return { error, status };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : String(err) }, status: 0 };
  }
}

/** Applique des champs au jour `date` (ligne créée si absente), liste triée par date. */
function mergeCycleDay(
  days: CycleDay[],
  date: string,
  fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>,
  coupleId: string,
  userId: string
): CycleDay[] {
  const exists = days.some((d) => d.date === date);
  const now = new Date().toISOString();
  const next = exists
    ? days.map((d) => (d.date === date ? { ...d, ...fields, updated_at: now } : d))
    : [
        ...days,
        {
          id: `local-${date}`,
          couple_id: coupleId,
          date,
          flow: null,
          vaginal_pain: null,
          symptoms: [],
          mood: null,
          note: null,
          updated_by: userId,
          created_at: now,
          updated_at: now,
          ...fields,
        } as CycleDay,
      ];
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Réapplique, par-dessus des données fraîches du serveur, les écritures encore en
 * file : sans ça, un rechargement les ferait disparaître de l'écran alors qu'elles
 * attendent toujours d'être envoyées.
 */
function withPendingMutations(
  days: CycleDay[],
  notes: PartnerNote[],
  queue: QueuedMutation[],
  coupleId: string,
  userId: string
): { days: CycleDay[]; notes: PartnerNote[] } {
  for (const mutation of queue) {
    if (mutation.type === "upsertCycleDay") {
      days = mergeCycleDay(days, mutation.date, mutation.fields, coupleId, userId);
    } else {
      notes = [
        ...notes,
        {
          id: `local-${mutation.id}`,
          couple_id: coupleId,
          date: mutation.date,
          author_id: userId,
          message: mutation.message,
          created_at: mutation.createdAt,
        },
      ];
    }
  }
  return { days, notes };
}

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const [couple, setCouple] = useState<Couple | null>(null);
  const [otherPartyEmail, setOtherPartyEmail] = useState<string | null>(null);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  const [partnerNotes, setPartnerNotes] = useState<PartnerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const replayRef = useRef<Promise<boolean> | null>(null);
  // Compte dont l'espace (ou l'absence d'espace) est affiché : les rechargements
  // suivants pour ce même compte restent silencieux (voir loadCouple).
  const shownUserIdRef = useRef<string | null>(null);

  // Rejoue dans l'ordre les écritures faites hors ligne. S'arrête à la première qui
  // échoue (réseau ou refus du serveur) : elle reste en file — rien n'en est retiré
  // sans succès — et sera retentée au prochain chargement. Un seul rejeu à la fois :
  // un appel pendant qu'il tourne attend le même, pour ne jamais envoyer deux fois
  // la même écriture.
  const replayPendingMutations = useCallback((coupleId: string, userId: string): Promise<boolean> => {
    if (replayRef.current) return replayRef.current;
    const run = (async () => {
      const sent = new Set<string>();
      while (true) {
        // Relue à chaque tour : une écriture ajoutée pendant le rejeu part aussi. Une
        // déjà envoyée qui reviendrait en tête (stockage devenu impossible à écrire)
        // arrête la boucle au lieu de la renvoyer indéfiniment.
        const mutation = getPendingMutations(coupleId)[0];
        if (!mutation || sent.has(mutation.id)) break;
        const { error, status } = await sendMutation(coupleId, userId, mutation);
        if (error) {
          if (isNetworkError(error, status)) setOffline(true);
          break;
        }
        sent.add(mutation.id);
        removeMutation(coupleId, mutation.id);
      }
      setPendingSyncCount(getPendingMutations(coupleId).length);
      return sent.size > 0;
    })();
    replayRef.current = run;
    const release = () => {
      if (replayRef.current === run) replayRef.current = null;
    };
    run.then(release, release);
    return run;
  }, []);

  // supabase-js ne lève pas d'exception sans réseau : il renvoie une erreur (status 0)
  // qu'il faut lire explicitement. En cas d'échec, on retombe sur la dernière copie
  // locale (voir saveDuoCache) pour que l'app reste utilisable hors ligne ; sans
  // copie, DuoGate propose de réessayer — jamais l'écran d'accueil, qui ferait
  // croire qu'il n'existe aucun espace (et pousserait à en recréer un).
  //
  // Dépend de l'id du compte, pas de l'objet `user` : celui-ci est recréé à chaque
  // événement d'authentification (rafraîchissement du jeton, environ toutes les
  // heures), ce qui relançait un chargement complet et démontait toute l'UI.
  const loadCouple = useCallback(async () => {
    if (!userId) {
      shownUserIdRef.current = null;
      setCouple(null);
      setCycleDays([]);
      setPartnerNotes([]);
      setPendingSyncCount(0);
      setOffline(false);
      setLoadError(null);
      setLoading(false);
      return;
    }
    // "Chargement..." seulement au premier chargement pour ce compte ; ensuite, les
    // rechargements (retour au premier plan, retour du réseau...) sont silencieux et
    // ne démontent plus l'écran en cours (feuille de saisie ouverte, mois affiché).
    const firstLoad = shownUserIdRef.current !== userId;

    const fallBack = (error: { message: string }, network: boolean) => {
      if (network) setOffline(true);
      // Un espace est déjà affiché : on le garde, il est au moins aussi récent que
      // la copie locale.
      if (shownUserIdRef.current === userId) return;
      const cached = loadDuoCache(userId);
      if (cached) {
        shownUserIdRef.current = userId;
        setCouple(cached.couple);
        setCycleDays(cached.cycleDays);
        setPartnerNotes(cached.partnerNotes);
        setPendingSyncCount(getPendingMutations(cached.couple.id).length);
        setLoadError(null);
      } else {
        setLoadError(network ? OFFLINE_MESSAGE : error.message);
      }
    };

    if (firstLoad) {
      setCouple(null);
      setCycleDays([]);
      setPartnerNotes([]);
      setLoadError(null);
      setLoading(true);
    }
    try {
      // Réseau coupé : inutile d'attendre les nouvelles tentatives de supabase-js
      // (plusieurs secondes) avant d'afficher la copie locale.
      if (!navigator.onLine) {
        fallBack({ message: OFFLINE_MESSAGE }, true);
        return;
      }

      const { data, error, status } = await supabase
        .from("couples")
        .select("*")
        .or(`owner_id.eq.${userId},partner_id.eq.${userId}`)
        .maybeSingle();
      if (error) {
        fallBack(error, isNetworkError(error, status));
        return;
      }

      const loadedCouple = data as Couple | null;
      if (!loadedCouple) {
        // Réponse du serveur : aucun espace pour ce compte (jamais créé, quitté, ou
        // supprimé par la titulaire) — une copie locale restante serait périmée.
        clearDuoCache(userId);
        shownUserIdRef.current = userId;
        setCouple(null);
        setCycleDays([]);
        setPartnerNotes([]);
        setPendingSyncCount(0);
        setOffline(false);
        setLoadError(null);
        return;
      }

      // Le serveur répond : on envoie d'abord les écritures restées en attente, pour
      // que les données rechargées juste après les contiennent déjà.
      await replayPendingMutations(loadedCouple.id, userId);

      const [daysResult, notesResult] = await Promise.all([
        supabase.from("cycle_days").select("*").eq("couple_id", loadedCouple.id).order("date"),
        supabase.from("partner_notes").select("*").eq("couple_id", loadedCouple.id).order("date"),
      ]);
      // Jamais de tableaux vides à la place en cas d'erreur : l'historique affiché et
      // la copie locale seraient effacés alors que le serveur n'a juste pas répondu.
      const failed = daysResult.error ? daysResult : notesResult.error ? notesResult : null;
      if (failed?.error) {
        fallBack(failed.error, isNetworkError(failed.error, failed.status));
        return;
      }

      const pending = getPendingMutations(loadedCouple.id);
      const { days, notes } = withPendingMutations(
        (daysResult.data as CycleDay[]) ?? [],
        (notesResult.data as PartnerNote[]) ?? [],
        pending,
        loadedCouple.id,
        userId
      );
      shownUserIdRef.current = userId;
      setCouple(loadedCouple);
      setCycleDays(days);
      setPartnerNotes(notes);
      saveDuoCache(userId, { couple: loadedCouple, cycleDays: days, partnerNotes: notes });
      setPendingSyncCount(pending.length);
      setOffline(false);
      setLoadError(null);
    } catch (err) {
      // Filet de sécurité : une exception inattendue ne doit pas non plus bloquer
      // l'app sur "Chargement..." ni la renvoyer vers l'écran d'accueil.
      const error = { message: err instanceof Error ? err.message : String(err) };
      fallBack(error, isNetworkError(error));
    } finally {
      setLoading(false);
    }
  }, [userId, replayPendingMutations]);

  useEffect(() => {
    loadCouple();
  }, [loadCouple]);

  // Retour du réseau : recharge une copie fraîche, ce qui rejoue au passage les
  // écritures faites hors ligne (voir loadCouple).
  useEffect(() => {
    const handleOnline = () => {
      void loadCouple();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadCouple]);

  // Retour au premier plan : rechargement silencieux (changements faits sur l'autre
  // téléphone entre-temps, écritures restées en attente).
  useEffect(() => {
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void loadCouple();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [loadCouple]);

  // Synchronisation temps réel : les deux comptes voient les mêmes données instantanément
  useEffect(() => {
    if (!couple) return;

    const channel = supabase
      .channel(`couple-${couple.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cycle_days", filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setCycleDays((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.id !== (payload.old as CycleDay).id);
            }
            // On matche par date (unique par couple), pas par id : une écriture optimiste
            // locale (id temporaire "local-...") doit être remplacée par la confirmation
            // serveur plutôt que dupliquée à côté.
            const incoming = payload.new as CycleDay;
            const exists = prev.some((d) => d.date === incoming.date);
            const next = exists ? prev.map((d) => (d.date === incoming.date ? incoming : d)) : [...prev, incoming];
            return next.sort((a, b) => a.date.localeCompare(b.date));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partner_notes", filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          setPartnerNotes((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((n) => n.id !== (payload.old as PartnerNote).id);
            }
            // Une note ajoutée en local a un id temporaire "local-..." : on la remplace par
            // sa confirmation serveur (même date/auteur/message) plutôt que de la dupliquer.
            const incoming = payload.new as PartnerNote;
            const matchIndex = prev.findIndex(
              (n) =>
                n.id === incoming.id ||
                (n.id.startsWith("local-") &&
                  n.date === incoming.date &&
                  n.author_id === incoming.author_id &&
                  n.message === incoming.message)
            );
            return matchIndex === -1
              ? [...prev, incoming]
              : prev.map((n, i) => (i === matchIndex ? incoming : n));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "couples", filter: `id=eq.${couple.id}` },
        (payload) => setCouple(payload.new as Couple)
      )
      // Supabase ne livre pas les DELETE sur un abonnement filtré (couple_id=eq...) et
      // l'ancienne ligne n'y contient que la clé primaire : les suppressions sont donc
      // écoutées sans filtre, et seules les lignes connues localement sont retirées
      // (la copie locale suit via l'effet saveDuoCache).
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cycle_days" }, (payload) => {
        const id = (payload.old as Partial<CycleDay>).id;
        if (id) setCycleDays((prev) => (prev.some((d) => d.id === id) ? prev.filter((d) => d.id !== id) : prev));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "partner_notes" }, (payload) => {
        const id = (payload.old as Partial<PartnerNote>).id;
        if (id) setPartnerNotes((prev) => (prev.some((n) => n.id === id) ? prev.filter((n) => n.id !== id) : prev));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple?.id]);

  // Email de l'autre personne du couple, pour afficher clairement l'état de
  // la synchronisation dans Réglages ("connecté·e avec ..."). Dépend de son id
  // seulement : pas de nouvelle requête à chaque rechargement de l'espace.
  const otherId = !userId || !couple ? null : couple.owner_id === userId ? couple.partner_id : couple.owner_id;
  useEffect(() => {
    if (!otherId) {
      setOtherPartyEmail(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("email")
      .eq("id", otherId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOtherPartyEmail((data as { email: string | null } | null)?.email ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [otherId]);

  // Copie locale tenue à jour à chaque changement (protège contre la perte d'accès
  // au compte/à l'app, et sert de source hors ligne à loadCouple ci-dessus).
  useEffect(() => {
    if (userId && couple) saveDuoCache(userId, { couple, cycleDays, partnerNotes });
  }, [userId, couple, cycleDays, partnerNotes]);

  async function createCouple(name: string) {
    if (!user) return { error: "Non connecté" };
    const { data, error, status } = await supabase
      .from("couples")
      .insert({ owner_id: user.id, name })
      .select()
      .single();
    if (error) return { error: errorMessage(error, status) };
    setCouple(data as Couple);
    return { error: null };
  }

  async function joinCouple(inviteCode: string) {
    // Les codes générés sont en minuscules ; le clavier du téléphone met souvent
    // une majuscule d'office (et le champ affiche le code en capitales).
    const { data, error, status } = await supabase.rpc("join_couple", {
      p_invite_code: inviteCode.trim().toLowerCase(),
    });
    if (error) return { error: errorMessage(error, status) };
    setCouple(data as Couple);
    await loadCouple();
    return { error: null };
  }

  async function leaveCouple() {
    const { error, status } = await supabase.rpc("leave_couple");
    if (error) return { error: errorMessage(error, status) };
    if (user) clearDuoCache(user.id);
    setCouple(null);
    setCycleDays([]);
    setPartnerNotes([]);
    return { error: null };
  }

  async function renameCouple(name: string) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const trimmed = name.trim();
    if (!trimmed) return { error: "Le nom ne peut pas être vide" };
    const { data, error, status } = await supabase
      .from("couples")
      .update({ name: trimmed })
      .eq("id", couple.id)
      .select()
      .single();
    if (error) return { error: errorMessage(error, status) };
    setCouple(data as Couple);
    return { error: null };
  }

  // Écriture réseau d'une modification déjà appliquée à l'écran. Hors ligne, elle
  // part dans la file d'attente et compte comme réussie ; seul un vrai refus du
  // serveur (droits, contrainte...) est renvoyé, pour que l'appelant annule
  // l'affichage optimiste.
  async function writeOrQueue(mutation: MutationPayload): Promise<{ error: string | null }> {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const coupleId = couple.id;
    // Des écritures attendent déjà : celle-ci passe derrière elles (sinon leur rejeu,
    // plus tard, écraserait cette valeur plus récente par une plus ancienne), puis on
    // retente d'envoyer toute la file.
    if (getPendingMutations(coupleId).length > 0) {
      enqueueMutation(coupleId, mutation);
      setPendingSyncCount(getPendingMutations(coupleId).length);
      void replayPendingMutations(coupleId, user.id);
      return { error: null };
    }
    const { error, status } = await sendMutation(coupleId, user.id, mutation);
    if (!error) {
      setOffline(false);
      return { error: null };
    }
    if (!isNetworkError(error, status)) return { error: error.message };
    enqueueMutation(coupleId, mutation);
    setPendingSyncCount(getPendingMutations(coupleId).length);
    setOffline(true);
    return { error: null };
  }

  // Applique le changement en local immédiatement (l'app reste réactive hors ligne),
  // puis l'écrit sur le serveur ou le met en file (voir writeOrQueue). S'il est
  // refusé par le serveur, l'écran revient à l'état d'avant et l'erreur est renvoyée.
  async function upsertCycleDay(
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const previous = cycleDays.find((d) => d.date === date);
    const coupleId = couple.id;
    const updatedBy = user.id;
    setCycleDays((prev) => mergeCycleDay(prev, date, fields, coupleId, updatedBy));
    const result = await writeOrQueue({ type: "upsertCycleDay", date, fields });
    if (result.error) {
      setCycleDays((prev) =>
        previous ? prev.map((d) => (d.date === date ? previous : d)) : prev.filter((d) => d.date !== date)
      );
    }
    return result;
  }

  async function addPartnerNote(date: string, message: string) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const optimisticNote: PartnerNote = {
      id: `local-${Date.now()}`,
      couple_id: couple.id,
      date,
      author_id: user.id,
      message,
      created_at: new Date().toISOString(),
    };
    setPartnerNotes((prev) => [...prev, optimisticNote]);
    const result = await writeOrQueue({ type: "addPartnerNote", date, message });
    if (result.error) setPartnerNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id));
    return result;
  }

  const role: "owner" | "partner" | null = !couple || !user ? null : couple.owner_id === user.id ? "owner" : "partner";

  const cycleDataValue: CycleDataValue = {
    mode: "duo",
    coupleName: couple?.name ?? "",
    role,
    canEdit: role === "owner",
    averageCycleLength: couple?.average_cycle_length ?? 28,
    averagePeriodLength: couple?.average_period_length ?? 5,
    notificationsDaysBefore: profile?.notifications_days_before ?? null,
    cycleDays,
    partnerNotes,
    loading,
    offline,
    pendingSyncCount,
    upsertCycleDay,
    addPartnerNote,
  };

  return (
    <CoupleContext.Provider
      value={{
        couple,
        role,
        otherPartyEmail,
        cycleDays,
        partnerNotes,
        loading,
        loadError,
        offline,
        pendingSyncCount,
        createCouple,
        joinCouple,
        leaveCouple,
        renameCouple,
        upsertCycleDay,
        addPartnerNote,
        reload: loadCouple,
      }}
    >
      <CycleDataContext.Provider value={cycleDataValue}>{children}</CycleDataContext.Provider>
    </CoupleContext.Provider>
  );
}

export function useCouple() {
  const ctx = useContext(CoupleContext);
  if (!ctx) throw new Error("useCouple doit être utilisé dans CoupleProvider");
  return ctx;
}

export type { FlowIntensity };
