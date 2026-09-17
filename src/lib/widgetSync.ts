import { Capacitor, registerPlugin } from "@capacitor/core";

interface WidgetDataPlugin {
  update(options: { daysRemaining: number | null; cycleProgress: number | null }): Promise<void>;
}

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

/**
 * Pousse le nombre de jours restants et l'avancée dans le cycle (0-1, pour le
 * widget Orbite) vers les widgets d'écran d'accueil Android.
 */
export function syncDaysRemainingWidget(daysRemaining: number | null, cycleProgress: number | null = null): void {
  if (Capacitor.getPlatform() !== "android") return;
  WidgetData.update({ daysRemaining, cycleProgress }).catch(() => {
    // widget non ajouté à l'écran d'accueil, ou échec silencieux sans conséquence
  });
}
