import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Couple, CycleDay, PartnerNote } from "../types";
import { backupFileName, buildBackup, parseBackup, type ParsedBackup } from "./backupFormat";
import { removeLocalKeysWithPrefix } from "./localStore";

/**
 * Exporte les données en JSON : jours du cycle et mots doux (format décrit dans
 * backupFormat.ts). Les données viennent de l'état de l'app, qui contient tout
 * l'historique (chargé page par page) ainsi que les saisies pas encore envoyées.
 *
 * Sur le web, le déclenchement `<a download>` + URL de blob fonctionne
 * normalement. Mais dans la WebView Capacitor Android, cet attribut
 * `download` est ignoré par le système : le clic ne fait rien, sans la
 * moindre erreur visible ("l'export ne marche pas"). Sur natif, on écrit
 * donc le fichier via `@capacitor/filesystem` puis on ouvre la feuille de
 * partage système (`@capacitor/share`) pour que l'utilisatrice choisisse où
 * l'enregistrer (Drive, Fichiers, message...).
 */
export async function exportBackupFile(
  cycleDays: CycleDay[],
  partnerNotes: PartnerNote[],
  coupleName: string
): Promise<void> {
  const filename = backupFileName();
  const json = JSON.stringify(buildBackup(cycleDays, partnerNotes, coupleName), null, 2);

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

/** Lit un fichier de sauvegarde choisi par l'utilisatrice (voir parseBackup). */
export function parseBackupFile(file: File): Promise<ParsedBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.onload = () => {
      try {
        resolve(parseBackup(String(reader.result ?? "")));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Fichier de sauvegarde illisible ou corrompu"));
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

/**
 * Efface la copie locale quand le serveur confirme qu'il n'y a plus d'espace pour
 * ce compte (quitté, ou supprimé par la titulaire) : sinon un démarrage hors ligne
 * réafficherait un espace qui n'existe plus.
 */
export function clearDuoCache(userId: string): void {
  try {
    localStorage.removeItem(`${DUO_CACHE_PREFIX}${userId}`);
  } catch {
    // stockage indisponible : rien à effacer
  }
}

/**
 * Efface la copie locale de tous les comptes (déconnexion) : tout l'historique de
 * cycle et les mots doux ne doivent pas rester sur le téléphone, en particulier
 * celui du/de la partenaire.
 */
export function clearAllDuoCaches(): void {
  removeLocalKeysWithPrefix(DUO_CACHE_PREFIX);
}
