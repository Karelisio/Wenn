import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { CycleDataContext, type CycleDataValue } from "./CycleDataContext";
import { mirrorDuoBackup } from "../lib/backup";
import type { Couple, CycleDay, FlowIntensity, PartnerNote } from "../types";

interface CoupleContextValue {
  couple: Couple | null;
  role: "owner" | "partner" | null;
  otherPartyEmail: string | null;
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
  loading: boolean;
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

  const loadCouple = useCallback(async () => {
    if (!user) {
      setCouple(null);
      setCycleDays([]);
      setPartnerNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("couples")
      .select("*")
      .or(`owner_id.eq.${user.id},partner_id.eq.${user.id}`)
      .maybeSingle();

    setCouple(data as Couple | null);

    if (data) {
      const [{ data: days }, { data: notes }] = await Promise.all([
        supabase.from("cycle_days").select("*").eq("couple_id", data.id).order("date"),
        supabase.from("partner_notes").select("*").eq("couple_id", data.id).order("date"),
      ]);
      setCycleDays((days as CycleDay[]) ?? []);
      setPartnerNotes((notes as PartnerNote[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCouple();
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
            const incoming = payload.new as CycleDay;
            const exists = prev.some((d) => d.id === incoming.id);
            const next = exists ? prev.map((d) => (d.id === incoming.id ? incoming : d)) : [...prev, incoming];
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
            const incoming = payload.new as PartnerNote;
            const exists = prev.some((n) => n.id === incoming.id);
            return exists ? prev.map((n) => (n.id === incoming.id ? incoming : n)) : [...prev, incoming];
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

  // Filet de sécurité : mirroir local silencieux des données de cycle, indépendant
  // du lien avec un·e partenaire (protège contre la perte d'accès au compte/à l'app).
  useEffect(() => {
    if (couple && cycleDays.length > 0) mirrorDuoBackup(couple.id, cycleDays);
  }, [couple, cycleDays]);

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

  async function upsertCycleDay(
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const { error } = await supabase
      .from("cycle_days")
      .upsert(
        { couple_id: couple.id, date, updated_by: user.id, ...fields },
        { onConflict: "couple_id,date" }
      );
    return { error: error?.message ?? null };
  }

  async function addPartnerNote(date: string, message: string) {
    if (!couple || !user) return { error: "Aucun cycle lié" };
    const { error } = await supabase
      .from("partner_notes")
      .insert({ couple_id: couple.id, date, message, author_id: user.id });
    return { error: error?.message ?? null };
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
