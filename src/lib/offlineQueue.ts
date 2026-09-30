import type { CycleDay } from "../types";
import { localKeysWithPrefix, removeLocalKeysWithPrefix } from "./localStore";

interface QueuedCycleDayUpsert {
  type: "upsertCycleDay";
  date: string;
  fields: Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>;
}

interface QueuedPartnerNote {
  type: "addPartnerNote";
  date: string;
  message: string;
}

/** Une écriture Duo, avant sa mise en file (sans id ni date d'ajout). */
export type MutationPayload = QueuedCycleDayUpsert | QueuedPartnerNote;

export type QueuedMutation = MutationPayload & { id: string; createdAt: string };

const QUEUE_PREFIX = "wenn-duo-queue-";

/**
 * File d'attente locale des écritures faites hors connexion (mode Duo). Chaque
 * mutation est rejouée dans l'ordre dès le retour du réseau (voir CoupleContext) ;
 * en attendant, l'UI a déjà appliqué le changement en local de façon optimiste.
 */
function readQueue(coupleId: string): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(`${QUEUE_PREFIX}${coupleId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(coupleId: string, queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(`${QUEUE_PREFIX}${coupleId}`, JSON.stringify(queue));
  } catch {
    // stockage indisponible : la mutation ne pourra pas être rejouée automatiquement
  }
}

export function enqueueMutation(coupleId: string, mutation: MutationPayload): void {
  const queue = readQueue(coupleId);
  queue.push({ ...mutation, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  writeQueue(coupleId, queue);
}

export function getPendingMutations(coupleId: string): QueuedMutation[] {
  return readQueue(coupleId);
}

export function removeMutation(coupleId: string, id: string): void {
  writeQueue(
    coupleId,
    readQueue(coupleId).filter((m) => m.id !== id)
  );
}

/** Écritures en attente sur cet appareil, tous espaces confondus (avertissement avant déconnexion). */
export function countAllPendingMutations(): number {
  return localKeysWithPrefix(QUEUE_PREFIX).reduce(
    (total, key) => total + readQueue(key.slice(QUEUE_PREFIX.length)).length,
    0
  );
}

/** Vide la file d'un espace quitté ou supprimé : ses écritures seraient refusées de toute façon. */
export function clearPendingMutations(coupleId: string): void {
  try {
    localStorage.removeItem(`${QUEUE_PREFIX}${coupleId}`);
  } catch {
    // stockage indisponible : rien à effacer
  }
}

/** Vide toutes les files d'attente (déconnexion). */
export function clearAllPendingMutations(): void {
  removeLocalKeysWithPrefix(QUEUE_PREFIX);
}
