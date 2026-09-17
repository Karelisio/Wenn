import type { CycleDay } from "../types";

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

export type QueuedMutation = (QueuedCycleDayUpsert | QueuedPartnerNote) & { id: string; createdAt: string };

const QUEUE_PREFIX = "wenn-duo-queue-";

/**
 * File d'attente locale des écritures faites hors connexion (mode Duo). Chaque
 * mutation est rejouée dans l'ordre dès le retour du réseau (voir CoupleContext) ;
 * en attendant, l'UI a déjà appliqué le changement en local de façon optimiste.
 */
function readQueue(coupleId: string): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(`${QUEUE_PREFIX}${coupleId}`);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
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

export function enqueueMutation(coupleId: string, mutation: QueuedCycleDayUpsert | QueuedPartnerNote): void {
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
