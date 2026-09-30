import { useEffect } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useCycleData } from "../context/CycleDataContext";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import { syncDaysRemainingWidget } from "../lib/widgetSync";

/**
 * Tient le widget d'écran d'accueil Android à jour à chaque changement de prédiction.
 * Mêmes calculs que WennWidgetProvider.readState (côté Java), qui les refait
 * chaque jour à partir des dates poussées ici : les garder identiques.
 */
export default function WidgetSync() {
  const { cycleDays, averageCycleLength, averagePeriodLength } = useCycleData();

  useEffect(() => {
    const prediction = computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength);
    // Jours calendaires entre dates locales : un Math.ceil sur new Date("aaaa-mm-jj")
    // (lu à minuit UTC) se décalait d'un jour entre 0 h et 2 h du matin.
    const daysRemaining = prediction.nextPeriodStart
      ? differenceInCalendarDays(parseISO(prediction.nextPeriodStart), new Date())
      : null;
    const cycleProgress =
      prediction.currentCycleDay != null
        ? ((prediction.currentCycleDay - 1) % prediction.averageCycleLength) / prediction.averageCycleLength
        : null;
    syncDaysRemainingWidget({
      daysRemaining,
      cycleProgress,
      nextPeriodStart: prediction.nextPeriodStart,
      lastPeriodStart: prediction.lastPeriodStart,
      averageCycleLength: prediction.averageCycleLength,
    });
  }, [cycleDays, averageCycleLength, averagePeriodLength]);

  return null;
}
