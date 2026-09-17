import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Couple, CycleDay, FlowIntensity, PartnerNote } from "../types";

export interface BackupEntry {
  date: string;
  flow: FlowIntensity | null;
  vaginal_pain: FlowIntensity | null;
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

/**
 * Exporte les données de cycle en JSON.
 *
 * Sur le web, le déclenchement `<a download>` + URL de blob fonctionne
 * normalement. Mais dans la WebView Capacitor Android, cet attribut
 * `download` est ignoré par le système : le clic ne fait rien, sans la
 * moindre erreur visible ("l'export ne marche pas"). Sur natif, on écrit
 * donc le fichier via `@capacitor/filesystem` puis on ouvre la feuille de
 * partage système (`@capacitor/share`) pour que l'utilisatrice choisisse où
 * l'enregistrer (Drive, Fichiers, message...).
 */
export async function exportCycleDaysAsFile(cycleDays: CycleDay[], coupleName: string): Promise<void> {
  const payload: BackupFile = {
    app: "wenn",
    version: 1,
    exportedAt: new Date().toISOString(),
    coupleName,
    cycleDays: cycleDays.map((d) => ({
      date: d.date,
      flow: d.flow,
      vaginal_pain: d.vaginal_pain,
      symptoms: d.symptoms,
      mood: d.mood,
      note: d.note,
    })),
  };
  const filename = `wenn-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(payload, null, 2);

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: "Sauvegarde Wenn", url: uri });
    return;
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
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

const DUO_CACHE_PREFIX = "wenn-duo-cache-";

interface DuoCache {
  savedAt: string;
  couple: Couple;
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
}

/**
 * Copie locale silencieuse des données duo (couple + jours + notes), tenue à jour à
 * chaque changement reçu de Supabase. Sert de repli en l'absence de réseau : l'app
 * peut se lancer et être lue hors ligne, les écritures sont rejouées au retour de
 * la connexion (voir offlineQueue.ts). Clé par utilisateur pour rester disponible
 * même avant d'avoir pu recharger l'espace couple depuis le réseau.
 */
export function saveDuoCache(
  userId: string,
  data: { couple: Couple; cycleDays: CycleDay[]; partnerNotes: PartnerNote[] }
): void {
  try {
    const payload: DuoCache = { savedAt: new Date().toISOString(), ...data };
    localStorage.setItem(`${DUO_CACHE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    // stockage indisponible : tant pis pour la copie locale, la source de vérité reste Supabase
  }
}

export function loadDuoCache(userId: string): DuoCache | null {
  try {
    const raw = localStorage.getItem(`${DUO_CACHE_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as DuoCache) : null;
  } catch {
    return null;
  }
}
