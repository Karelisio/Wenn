import { Capacitor, registerPlugin } from "@capacitor/core";

interface WidgetDataPlugin {
  update(options: { daysRemaining: number | null }): Promise<void>;
}

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

/** Pousse le nombre de jours restants avant les prochaines règles vers le widget d'écran d'accueil Android. */
export function syncDaysRemainingWidget(daysRemaining: number | null): void {
  if (Capacitor.getPlatform() !== "android") return;
  WidgetData.update({ daysRemaining }).catch(() => {
    // widget non ajouté à l'écran d'accueil, ou échec silencieux sans conséquence
  });
}
