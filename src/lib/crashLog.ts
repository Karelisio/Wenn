import { Capacitor, registerPlugin } from "@capacitor/core";

interface CrashLogPlugin {
  get(): Promise<{ trace: string | null; when: string | null }>;
  clear(): Promise<void>;
}

const CrashLog = registerPlugin<CrashLogPlugin>("CrashLog");

export interface CrashReport {
  trace: string;
  when: string | null;
}

/**
 * Dernière fermeture brutale de l'app enregistrée côté natif (voir
 * CrashLogPlugin.java). Sans logcat sur l'appareil de l'utilisatrice, c'est
 * le seul moyen de savoir pourquoi l'app « se ferme toute seule ».
 */
export async function getLastCrash(): Promise<CrashReport | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { trace, when } = await CrashLog.get();
    return trace ? { trace, when } : null;
  } catch {
    return null;
  }
}

export async function clearLastCrash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CrashLog.clear();
  } catch {
    // rien à faire : au pire le rapport reste affiché
  }
}
