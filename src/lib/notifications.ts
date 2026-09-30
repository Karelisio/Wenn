import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { addDays, parseISO } from "date-fns";

const PERIOD_NOTIFICATION_ID_BASE = 1000;
const PERIOD_REMINDER_ENABLED_KEY = "wenn:periodReminderEnabled";

function isPeriodNotificationId(id: number): boolean {
  return id >= PERIOD_NOTIFICATION_ID_BASE && id < PERIOD_NOTIFICATION_ID_BASE + 100;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

/**
 * Sur Android 12+, déclarer SCHEDULE_EXACT_ALARM dans le manifeste ne suffit
 * plus : l'utilisatrice doit en plus accorder le réglage système "Alarmes et
 * rappels" (Paramètres > Applis > Wenn > Alarmes et rappels). Sans ça, le
 * rappel est programmé en alarme inexacte, que Doze/App Standby peut reporter
 * arbitrairement — jusqu'à ce que l'app soit rouverte.
 */
export async function isExactAlarmGranted(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return true;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === "granted";
  } catch {
    return true;
  }
}

/** Ouvre l'écran système "Alarmes et rappels" pour Wenn. */
export async function openExactAlarmSettings(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return true;
  try {
    const { exact_alarm } = await LocalNotifications.changeExactNotificationSetting();
    return exact_alarm === "granted";
  } catch {
    return false;
  }
}

/** Active (ou non) le rappel de règles sur cet appareil : posé par le bouton de Réglages. */
export function setPeriodReminderEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PERIOD_REMINDER_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // stockage indisponible : le rappel ne sera pas reprogrammé automatiquement
  }
}

/**
 * Rappel de règles activé sur cet appareil ? Pour un rappel activé avant que ce
 * drapeau n'existe, une notification de règles encore programmée vaut activation.
 */
export async function isPeriodReminderEnabled(): Promise<boolean> {
  let stored: string | null;
  try {
    stored = localStorage.getItem(PERIOD_REMINDER_ENABLED_KEY);
  } catch {
    return false;
  }
  if (stored !== null) return stored === "true";
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { notifications } = await LocalNotifications.getPending();
    const enabled = notifications.some((n) => isPeriodNotificationId(n.id));
    if (enabled) setPeriodReminderEnabled(true);
    return enabled;
  } catch {
    return false;
  }
}

async function cancelPeriodNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const toCancel = pending.notifications.filter((n) => isPeriodNotificationId(n.id));
  if (toCancel.length) {
    await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
  }
}

// Les (re)programmations passent une par une : deux appels rapprochés (prédiction
// qui change plusieurs fois de suite, bouton de Réglages + ReminderSync) ne doivent
// pas se croiser, sinon le plus ancien pourrait être programmé en dernier.
let reminderQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = reminderQueue.then(task, task);
  reminderQueue = run.catch(() => undefined);
  return run;
}

/** Retire le rappel de règles programmé sur cet appareil, s'il y en a un. */
export function cancelPeriodReminder(): Promise<void> {
  return oneAtATime(cancelPeriodNotifications);
}

/**
 * (Re)programme le rappel de règles : annule le précédent (id fixe), puis planifie
 * une notification locale native à 9 h, `daysBefore` jours avant `nextPeriodStart`.
 * Renvoie `true` seulement si une notification a vraiment été programmée — pas si
 * la permission manque, ni si la date du rappel est déjà passée.
 * Fiable même app fermée : Capacitor délègue au système d'alarme natif
 * (AlarmManager sur Android, UNUserNotificationCenter sur iOS).
 */
export function schedulePeriodNotification(nextPeriodStart: string, daysBefore: number): Promise<boolean> {
  return oneAtATime(async () => {
    if (!Capacitor.isNativePlatform()) return false;

    await cancelPeriodNotifications();

    // Vérifie sans redemander : ce rappel est aussi reprogrammé automatiquement
    // (voir ReminderSync), qui ne doit pas faire surgir de demande de permission.
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") return false;

    const triggerDate = addDays(parseISO(nextPeriodStart), -daysBefore);
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate.getTime() <= Date.now()) return false;

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
    return true;
  });
}
