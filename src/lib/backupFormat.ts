import { format } from "date-fns";
import type { CycleDay, FlowIntensity, PartnerNote } from "../types";

// Module pur (aucun import Capacitor) : lu tel quel par scripts/smoke-test.ts.

/**
 * Date du jour (ou de `date`) au format aaaa-mm-jj, dans le fuseau du
 * téléphone. Jamais via toISOString(), qui passe en UTC : entre minuit et
 * 1-2 h du matin en France, on obtenait la date de la veille.
 */
export function localDateString(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Vrai pour une date réelle du calendrier au format aaaa-mm-jj (« 2026-02-30 » est refusé). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export type CycleDayFields = Partial<Pick<CycleDay, "flow" | "vaginal_pain" | "symptoms" | "mood" | "note">>;

/** Un jour tel qu'écrit dans le fichier de sauvegarde. */
export interface BackupEntry {
  date: string;
  flow: FlowIntensity | null;
  vaginal_pain: FlowIntensity | null;
  symptoms: string[];
  mood: string | null;
  note: string | null;
}

/** Un mot doux tel qu'écrit dans le fichier de sauvegarde (depuis la version 2). */
export interface BackupNote {
  date: string;
  message: string;
  author_id: string;
  created_at: string;
}

/**
 * Version 2 : ajout des mots doux (`partnerNotes`). Les fichiers de version 1
 * (jours seulement) restent acceptés à la restauration.
 */
export const BACKUP_VERSION = 2;

export interface BackupFile {
  app: "wenn";
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  coupleName: string;
  cycleDays: BackupEntry[];
  partnerNotes: BackupNote[];
}

export function buildBackup(
  cycleDays: CycleDay[],
  partnerNotes: PartnerNote[],
  coupleName: string,
  now: Date = new Date()
): BackupFile {
  return {
    app: "wenn",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    coupleName,
    cycleDays: cycleDays.map((d) => ({
      date: d.date,
      flow: d.flow,
      vaginal_pain: d.vaginal_pain,
      symptoms: d.symptoms,
      mood: d.mood,
      note: d.note,
    })),
    partnerNotes: partnerNotes.map((n) => ({
      date: n.date,
      message: n.message,
      author_id: n.author_id,
      created_at: n.created_at,
    })),
  };
}

/** Nom du fichier exporté, daté du jour local (pas UTC). */
export function backupFileName(now: Date = new Date()): string {
  return `wenn-sauvegarde-${localDateString(now)}.json`;
}

// Mêmes valeurs que les contraintes « check » de cycle_days (supabase/schema.sql).
const FLOW_VALUES: readonly FlowIntensity[] = ["spotting", "leger", "moyen", "abondant"];
const PAIN_VALUES: readonly FlowIntensity[] = ["leger", "moyen", "abondant"];

export interface RestoreDay {
  date: string;
  /** Seulement les champs présents dans le fichier : un champ absent n'écrase rien. */
  fields: CycleDayFields;
}

export interface RestoreNote {
  date: string;
  message: string;
  /** null si le fichier ne dit pas qui l'a écrit (restauration alors impossible). */
  authorId: string | null;
}

export interface ParsedBackup {
  days: RestoreDay[];
  notes: RestoreNote[];
  /** Entrées écartées à la lecture (date ou valeur invalide, rien à restaurer). */
  invalidDays: number;
  invalidNotes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texte libre facultatif : null, ou une chaîne (vide = null, comme à la saisie). */
function optionalText(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  return { ok: true, value: trimmed ? trimmed : null };
}

/**
 * Valide un jour du fichier. Seuls les champs présents sont repris ; une valeur
 * présente mais invalide écarte tout le jour. Symptômes et humeur acceptent aussi
 * le texte libre saisi dans l'app (« Douleur spécifique », « Humeur spécifique »).
 */
function parseDay(raw: unknown): RestoreDay | null {
  if (!isRecord(raw) || !isValidDateString(raw.date)) return null;
  const fields: CycleDayFields = {};

  if ("flow" in raw) {
    if (raw.flow !== null && !FLOW_VALUES.includes(raw.flow as FlowIntensity)) return null;
    fields.flow = raw.flow as FlowIntensity | null;
  }
  if ("vaginal_pain" in raw) {
    if (raw.vaginal_pain !== null && !PAIN_VALUES.includes(raw.vaginal_pain as FlowIntensity)) return null;
    fields.vaginal_pain = raw.vaginal_pain as FlowIntensity | null;
  }
  if ("symptoms" in raw) {
    const symptoms = raw.symptoms;
    if (!Array.isArray(symptoms) || !symptoms.every((s) => typeof s === "string" && s.trim() !== "")) return null;
    fields.symptoms = [...new Set((symptoms as string[]).map((s) => s.trim()))];
  }
  if ("mood" in raw) {
    const mood = optionalText(raw.mood);
    if (!mood.ok) return null;
    fields.mood = mood.value;
  }
  if ("note" in raw) {
    const note = optionalText(raw.note);
    if (!note.ok) return null;
    fields.note = note.value;
  }

  // Une date seule : rien à restaurer.
  if (Object.keys(fields).length === 0) return null;
  return { date: raw.date, fields };
}

function parseNote(raw: unknown): RestoreNote | null {
  if (!isRecord(raw) || !isValidDateString(raw.date)) return null;
  if (typeof raw.message !== "string" || !raw.message.trim()) return null;
  return {
    date: raw.date,
    message: raw.message.trim(),
    authorId: typeof raw.author_id === "string" && raw.author_id ? raw.author_id : null,
  };
}

/**
 * Lit le contenu d'un fichier de sauvegarde (version 1 ou 2). Lève une erreur
 * lisible si ce n'est pas une sauvegarde Wenn ; sinon, chaque jour et mot doux
 * est validé un par un, les invalides sont comptés au lieu d'être restaurés.
 */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Fichier de sauvegarde illisible ou corrompu");
  }
  if (!isRecord(data) || !Array.isArray(data.cycleDays) || ("app" in data && data.app !== "wenn")) {
    throw new Error("Ce fichier n'est pas une sauvegarde Wenn");
  }

  const days: RestoreDay[] = [];
  let invalidDays = 0;
  for (const raw of data.cycleDays) {
    const day = parseDay(raw);
    if (day) days.push(day);
    else invalidDays++;
  }

  const notes: RestoreNote[] = [];
  let invalidNotes = 0;
  for (const raw of Array.isArray(data.partnerNotes) ? data.partnerNotes : []) {
    const note = parseNote(raw);
    if (note) notes.push(note);
    else invalidNotes++;
  }

  return { days, notes, invalidDays, invalidNotes };
}

export interface RestoreReport {
  daysRestored: number;
  daysIgnored: number;
  notesRestored: number;
  notesIgnored: number;
}

export interface RestoreTarget {
  upsertCycleDay: (date: string, fields: CycleDayFields) => Promise<{ error: string | null }>;
  /** Mode duo seulement : le mode solo n'a pas de mots doux (ils ne sont alors pas comptés). */
  notes?: {
    /** Mots doux déjà présents : jamais recréés en double. */
    existing: PartnerNote[];
    /** Compte connecté : la base n'accepte un mot doux que de son auteur. */
    userId: string;
    add: (date: string, message: string) => Promise<{ error: string | null }>;
  };
  onProgress?: (done: number, total: number) => void;
}

/**
 * Restaure une sauvegarde lue par parseBackup, un jour à la fois, et compte ce qui
 * a été restauré ou ignoré. Un refus du serveur n'arrête plus tout : l'entrée est
 * comptée comme ignorée et on continue (hors ligne, les écritures partent en file
 * d'attente et comptent comme restaurées).
 */
export async function restoreBackup(backup: ParsedBackup, target: RestoreTarget): Promise<RestoreReport> {
  const notes = target.notes ? backup.notes : [];
  const report: RestoreReport = {
    daysRestored: 0,
    daysIgnored: backup.invalidDays,
    notesRestored: 0,
    notesIgnored: target.notes ? backup.invalidNotes : 0,
  };
  const total = backup.days.length + notes.length;
  let done = 0;

  for (const day of backup.days) {
    const { error } = await target.upsertCycleDay(day.date, day.fields);
    if (error) report.daysIgnored++;
    else report.daysRestored++;
    target.onProgress?.(++done, total);
  }

  if (target.notes) {
    const { existing, userId, add } = target.notes;
    const present = new Set(existing.map((n) => `${n.date}|${n.author_id}|${n.message}`));
    for (const note of notes) {
      const key = `${note.date}|${note.authorId}|${note.message}`;
      if (present.has(key)) {
        // Déjà là (sauvegarde du même espace) : rien à recréer.
        report.notesRestored++;
      } else if (note.authorId !== userId) {
        report.notesIgnored++;
      } else {
        const { error } = await add(note.date, note.message);
        if (error) {
          report.notesIgnored++;
        } else {
          report.notesRestored++;
          present.add(key);
        }
      }
      target.onProgress?.(++done, total);
    }
  }

  return report;
}

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n > 1 ? plural : singular}`;
}

/** Résumé affiché après une restauration, ex. « 118 jours restaurés, 2 ignorés (invalides ou refusés). » */
export function restoreSummary(report: RestoreReport): string {
  let text = count(report.daysRestored, "jour restauré", "jours restaurés");
  if (report.daysIgnored) text += `, ${count(report.daysIgnored, "ignoré", "ignorés")} (invalides ou refusés)`;
  if (report.notesRestored || report.notesIgnored) {
    text += ` · ${count(report.notesRestored, "mot doux restauré", "mots doux restaurés")}`;
    if (report.notesIgnored) {
      text += `, ${count(report.notesIgnored, "ignoré", "ignorés")} (seule la personne qui a écrit un mot doux peut le restaurer)`;
    }
  }
  return report.daysIgnored || report.notesIgnored ? `${text}.` : `${text} ✅`;
}
