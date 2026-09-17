import type { CycleDay, FlowIntensity } from "../types";

export interface BackupEntry {
  date: string;
  flow: FlowIntensity | null;
  symptoms: string[];
  mood: string | null;
  note: string | null;
}

interface BackupFile {
  app: "wenn";
  version: 1;
  exportedAt: string;
  coupleName: string;
  cycleDays: BackupEntry[];
}

export function exportCycleDaysAsFile(cycleDays: CycleDay[], coupleName: string): void {
  const payload: BackupFile = {
    app: "wenn",
    version: 1,
    exportedAt: new Date().toISOString(),
    coupleName,
    cycleDays: cycleDays.map((d) => ({
      date: d.date,
      flow: d.flow,
      symptoms: d.symptoms,
      mood: d.mood,
      note: d.note,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wenn-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<BackupEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Partial<BackupFile>;
        if (!Array.isArray(data.cycleDays)) throw new Error("Format de sauvegarde invalide");
        const entries = data.cycleDays.filter(
          (d): d is BackupEntry => typeof d === "object" && d !== null && typeof (d as BackupEntry).date === "string"
        );
        resolve(entries);
      } catch {
        reject(new Error("Fichier de sauvegarde illisible ou corrompu"));
      }
    };
    reader.readAsText(file);
  });
}

const LOCAL_BACKUP_PREFIX = "wenn-duo-backup-";

/** Mirroir silencieux des données duo sur l'appareil (filet de sécurité, pas une source de vérité). */
export function mirrorDuoBackup(coupleId: string, cycleDays: CycleDay[]): void {
  try {
    localStorage.setItem(`${LOCAL_BACKUP_PREFIX}${coupleId}`, JSON.stringify({ savedAt: new Date().toISOString(), cycleDays }));
  } catch {
    // stockage indisponible : tant pis pour le mirroir, la source de vérité reste Supabase
  }
}
