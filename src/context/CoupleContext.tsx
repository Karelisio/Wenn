import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { CycleDataContext, type CycleDataValue } from "./CycleDataContext";
import { saveDuoCache, loadDuoCache } from "../lib/backup";
import { enqueueMutation, getPendingMutations, removeMutation } from "../lib/offlineQueue";
import type { Couple, CycleDay, FlowIntensity, PartnerNote } from "../types";

interface CoupleContextValue {
  couple: Couple | null;
  role: "owner" | "partner" | null;
  otherPartyEmail: string | null;
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
  loading: boolean;
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
  refresh: () => Promise<void>;
}

const CoupleContext = createContext<CoupleContextValue | undefined>(undefined);

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [otherPartyEmail, setOtherPartyEmail] = useState<string | null>(null);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  const [partnerNotes, setPartnerNotes] = useState<PartnerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Sans réseau, les appels Supabase ci-dessous rejettent (fetch échoue) plutôt que
  // de renvoyer une erreur classique : on retombe alors sur la dernière copie locale
  // (voir saveDuoCache) pour que l'app reste utilisable hors ligne au lieu de rester
  // bloquée sur "Chargement...".
  const loadCouple = useCallback(async () => {
    if (!user) {
      setCouple(null);
      setCycleDays([]);
      setPartnerNotes([]);
      setPendingSyncCount(0);
      setOffline(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("couples")
        .select("*")
        .or(`owner_id.eq.${user.id},partner_id.eq.${user.id}`)
        .maybeSingle();

      const loadedCouple = data as Couple | null;
      setCouple(loadedCouple);

      if (loadedCouple) {
        const [{ data: days }, { data: notes }] = await Promise.all([
          supabase.from("cycle_days").select("*").eq("couple_id", loadedCouple.id).order("date"),
          supabase.from("partner_notes").select("*").eq("couple_id", loadedCouple.id).order("date"),
        ]);
        const loadedDays = (days as CycleDay[]) ?? [];
        const loadedNotes = (notes as PartnerNote[]) ?? [];
        setCycleDays(loadedDays);
        setPartnerNotes(loadedNotes);
        saveDuoCache(user.id, { couple: loadedCouple, cycleDays: loadedDays, partnerNotes: loadedNotes });
        setPendingSyncCount(getPendingMutations(loadedCouple.id).length);
      } else {
        setCycleDays([]);
        setPartnerNotes([]);
        setPendingSyncCount(0);
      }
      setOffline(false);
    } catch {
      const cached = loadDuoCache(user.id);
      if (cached) {
        setCouple(cached.couple);
        setCycleDays(cached.cycleDays);
        setPartnerNotes(cached.partnerNotes);
        setPendingSyncCount(getPendingMutations(cached.couple.id).length);
      }
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCouple();
  }, [loadCouple]);

  // Rejoue les écritures faites hors ligne dès qu'une copie fraîche est chargée
  // (retour du réseau détecté par un loadCouple réussi, ou événement 'online').
  const flushPendingMutations = useCallback(async () => {
    if (!couple || !user) return;
    const queue = getPendingMutations(couple.id);
    if (queue.length === 0) return;

    let flushedAny = false;
    for (const mutation of queue) {
      try {
        const { error } =
          mutation.type === "upsertCycleDay"
            ? await supabase
                .from("cycle_days")
                .upsert(
                  { couple_id: couple.id, date: mutation.date, updated_by: user.id, ...mutation.fields },
                  { onConflict: "couple_id,date" }
                )
            : await supabase
                .from("partner_notes")
                .insert({ couple_id: couple.id, date: mutation.date, message: mutation.message, author_id: user.id });
        if (error) break; // erreur réelle (pas un souci réseau) : on arrête, la mutation reste en file
        removeMutation(couple.id, mutation.id);
        flushedAny = true;
      } catch {
        break; // toujours hors ligne : on retentera au prochain retour de connexion
      }
    }
    setPendingSyncCount(getPendingMutations(couple.id).length);
    if (flushedAny) await loadCouple();
  }, [couple, user, loadCouple]);

  useEffect(() => {
    if (couple) flushPendingMutations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id]);

  useEffect(() => {
    window.addEventListener("online", flushPendingMutations);
    return () => window.removeEventListener("online", flushPendingMutations);
  }, [flushPendingMutations]);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple?.id]);

  // Email de l'autre personne du couple, pour afficher clairement l'état de
  // la synchronisation dans Réglages ("connecté·e avec ...").
  useEffect(() => {
    if (!user || !couple) {
      setOtherPartyEmail(null);
      return;
    }
    const otherId = couple.owner_id === user.id ? couple.partner_id : couple.owner_id;
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
  }, [user, couple]);

  // Copie locale tenue à jour à chaque changement (protège contre la perte d'accès
  // au compte/à l'app, et sert de source hors ligne à loadCouple ci-dessus).
  useEffect(() => {
    if (user && couple) saveDuoCache(user.id, { couple, cycleDays, partnerNotes });
  }, [user, couple, cycleDays, partnerNotes]);

  async function createCouple(name: string) {
    if (!user) return { error: "Non connecté" };
    const { data, error } = await supabase
      .from("couples")
      .insert({ owner_id: user.id, name })
      .select()
      .single();
    if (error) return { error: error.message };
    setCouple(data as Couple);
    return { error: null };
  }

  async function joinCouple(inviteCode: string) {
    const { data, error } = await supabase.rpc("join_couple", { p_invite_code: inviteCode.trim() });
    if (error) return { error: error.message };
    setCouple(data as Couple);
    await loadCouple();
    return { error: null };
  }

  async function leaveCouple() {
    const { error } = await supabase.rpc("leave_couple");
    if (error) return { error: error.message };
    setCouple(null);
    setCycleDays([]);
    setPartnerNotes([]);
    return { error: null };
  }

  async function renameCouple(name: string) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const trimmed = name.trim();
    if (!trimmed) return { error: "Le nom ne peut pas être vide" };
    const { data, error } = await supabase
      .from("couples")
      .update({ name: trimmed })
      .eq("id", couple.id)
      .select()
      .single();
    if (error) return { error: error.message };
    setCouple(data as Couple);
    return { error: null };
  }

  function applyCycleDayLocally(
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) {
    if (!couple || !user) return;
    setCycleDays((prev) => {
      const exists = prev.some((d) => d.date === date);
      const now = new Date().toISOString();
      const next = exists
        ? prev.map((d) => (d.date === date ? { ...d, ...fields, updated_at: now } : d))
        : [
            ...prev,
            {
              id: `local-${date}`,
              couple_id: couple.id,
              date,
              flow: null,
              vaginal_pain: null,
              symptoms: [],
              mood: null,
              note: null,
              updated_by: user.id,
              created_at: now,
              updated_at: now,
              ...fields,
            } as CycleDay,
          ];
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  // Applique le changement en local immédiatement (l'app reste réactive hors ligne),
  // puis tente l'écriture réseau ; si elle échoue faute de connexion, la mutation est
  // mise en file pour être rejouée automatiquement au retour du réseau.
  async function upsertCycleDay(
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    applyCycleDayLocally(date, fields);
    try {
      const { error } = await supabase
        .from("cycle_days")
        .upsert(
          { couple_id: couple.id, date, updated_by: user.id, ...fields },
          { onConflict: "couple_id,date" }
        );
      if (error) return { error: error.message };
      setOffline(false);
      return { error: null };
    } catch {
      enqueueMutation(couple.id, { type: "upsertCycleDay", date, fields });
      setPendingSyncCount(getPendingMutations(couple.id).length);
      setOffline(true);
      return { error: null };
    }
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
    try {
      const { error } = await supabase
        .from("partner_notes")
        .insert({ couple_id: couple.id, date, message, author_id: user.id });
      if (error) return { error: error.message };
      setOffline(false);
      return { error: null };
    } catch {
      enqueueMutation(couple.id, { type: "addPartnerNote", date, message });
      setPendingSyncCount(getPendingMutations(couple.id).length);
      setOffline(true);
      return { error: null };
    }
  }

  const role: "owner" | "partner" | null = !couple || !user ? null : couple.owner_id === user.id ? "owner" : "partner";

  const cycleDataValue: CycleDataValue = {
    mode: "duo",
    coupleName: couple?.name ?? "",
    role,
    canEdit: role === "owner",
    averageCycleLength: couple?.average_cycle_length ?? 28,
    averagePeriodLength: couple?.average_period_length ?? 5,
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
        offline,
        pendingSyncCount,
        createCouple,
        joinCouple,
        leaveCouple,
        renameCouple,
        upsertCycleDay,
        addPartnerNote,
        refresh: loadCouple,
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
