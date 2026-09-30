import { Capacitor, registerPlugin } from "@capacitor/core";

export interface WidgetSnapshot {
  /** Jours avant les prochaines règles (≤ 0 : attendues / en retard), null sans prédiction. */
  daysRemaining: number | null;
  /** Avancée dans le cycle (0-1), pour le widget Orbite. */
  cycleProgress: number | null;
  /** Dates (aaaa-mm-jj) dont découlent les deux valeurs ci-dessus. */
  nextPeriodStart: string | null;
  lastPeriodStart: string | null;
  averageCycleLength: number | null;
}

interface WidgetDataPlugin {
  update(options: WidgetSnapshot): Promise<void>;
}

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

/**
 * Pousse vers les widgets d'écran d'accueil Android le nombre de jours restants
 * et l'avancée dans le cycle, ainsi que les dates dont ils découlent : les
 * widgets s'en servent pour se recalculer eux-mêmes chaque jour, app fermée
 * (voir WennWidgetProvider.readState) — les deux valeurs calculées ici ne sont
 * plus qu'un repli.
 */
export function syncDaysRemainingWidget(snapshot: WidgetSnapshot): void {
  if (Capacitor.getPlatform() !== "android") return;
  WidgetData.update(snapshot).catch(() => {
    // widget non ajouté à l'écran d'accueil, ou échec silencieux sans conséquence
  });
}
