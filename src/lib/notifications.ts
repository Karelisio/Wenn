import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { addDays, parseISO } from "date-fns";

const PERIOD_NOTIFICATION_ID_BASE = 1000;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

export async function cancelPeriodNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const toCancel = pending.notifications.filter(
    (n) => n.id >= PERIOD_NOTIFICATION_ID_BASE && n.id < PERIOD_NOTIFICATION_ID_BASE + 100
  );
  if (toCancel.length) {
    await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
  }
}

/**
 * Planifie une notification locale native avant la date de règles prévue.
 * Fiable même app fermée : Capacitor délègue au système d'alarme natif
 * (AlarmManager sur Android, UNUserNotificationCenter sur iOS).
 */
export async function schedulePeriodNotification(
  nextPeriodStart: string,
  daysBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelPeriodNotifications();

  const triggerDate = addDays(parseISO(nextPeriodStart), -daysBefore);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: PERIOD_NOTIFICATION_ID_BASE,
        title: "Wenn 🌸",
        body:
          daysBefore === 0
            ? "Tes règles sont prévues aujourd'hui."
            : `Tes règles sont prévues dans ${daysBefore} jour${daysBefore > 1 ? "s" : ""}.`,
        schedule: { at: triggerDate, allowWhileIdle: true },
        smallIcon: "ic_stat_wenn",
      },
    ],
  });
}
