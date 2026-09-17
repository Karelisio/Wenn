import { createContext, useContext } from "react";
import type { CycleDay, PartnerNote } from "../types";

export type AppMode = "solo" | "duo";

export interface CycleDataValue {
  mode: AppMode;
  coupleName: string;
  role: "owner" | "partner" | null;
  canEdit: boolean;
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
  loading: boolean;
  /** Mode duo uniquement : true si la dernière copie chargée vient du cache local (pas de réseau). */
  offline?: boolean;
  /** Mode duo uniquement : nombre d'écritures en attente de synchronisation. */
  pendingSyncCount?: number;
  upsertCycleDay: (
    date: string,
    fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>
  ) => Promise<{ error: string | null }>;
  addPartnerNote: (date: string, message: string) => Promise<{ error: string | null }>;
}

export const CycleDataContext = createContext<CycleDataValue | undefined>(undefined);

/** Fournit les données de cycle quel que soit le mode (solo local ou duo synchronisé). */
export function useCycleData() {
  const ctx = useContext(CycleDataContext);
  if (!ctx) throw new Error("useCycleData doit être utilisé dans SoloProvider ou CoupleProvider");
  return ctx;
}
