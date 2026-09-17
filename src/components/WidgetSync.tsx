import { useEffect } from "react";
import { useCycleData } from "../context/CycleDataContext";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import { syncDaysRemainingWidget } from "../lib/widgetSync";

/** Tient le widget d'écran d'accueil Android à jour à chaque changement de prédiction. */
export default function WidgetSync() {
  const { cycleDays, averageCycleLength, averagePeriodLength } = useCycleData();

  useEffect(() => {
    const prediction = computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength);
    const daysRemaining = prediction.nextPeriodStart
      ? Math.ceil((new Date(prediction.nextPeriodStart).getTime() - Date.now()) / 86400000)
      : null;
    const cycleProgress =
      prediction.currentCycleDay != null
        ? ((prediction.currentCycleDay - 1) % prediction.averageCycleLength) / prediction.averageCycleLength
        : null;
    syncDaysRemainingWidget(daysRemaining, cycleProgress);
  }, [cycleDays, averageCycleLength, averagePeriodLength]);

  return null;
}
