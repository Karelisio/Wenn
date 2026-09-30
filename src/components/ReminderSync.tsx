import { useEffect, useMemo } from "react";
import { useCycleData } from "../context/CycleDataContext";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import { cancelPeriodReminder, isPeriodReminderEnabled, schedulePeriodNotification } from "../lib/notifications";

/**
 * Garde le rappel de règles calé sur la prédiction : annulé puis reprogrammé (même
 * id) à chaque changement de la date prévue ou du délai « Prévenir », s'il a été
 * activé dans Réglages. Avant, il n'était programmé qu'au moment d'appuyer sur le
 * bouton, et devenait faux dès que la prédiction bougeait.
 *
 * Réservé à la titulaire et au mode solo : sur le téléphone du/de la partenaire, un
 * éventuel rappel « Tes règles... » laissé par une ancienne version est retiré.
 */
export default function ReminderSync() {
  const { role, cycleDays, averageCycleLength, averagePeriodLength, notificationsDaysBefore } = useCycleData();
  const nextPeriodStart = useMemo(
    () => computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength).nextPeriodStart,
    [cycleDays, averageCycleLength, averagePeriodLength]
  );

  useEffect(() => {
    async function sync() {
      if (role !== "owner") return cancelPeriodReminder();
      // Délai pas encore connu (profil non chargé, hors ligne) : on garde le rappel
      // déjà programmé plutôt que de le recaler sur un délai par défaut.
      if (notificationsDaysBefore == null) return;
      if (!(await isPeriodReminderEnabled())) return;
      if (nextPeriodStart) await schedulePeriodNotification(nextPeriodStart, notificationsDaysBefore);
      else await cancelPeriodReminder();
    }
    sync().catch(() => {
      // notifications indisponibles sur cet appareil : rien à faire
    });
  }, [role, nextPeriodStart, notificationsDaysBefore]);

  return null;
}
