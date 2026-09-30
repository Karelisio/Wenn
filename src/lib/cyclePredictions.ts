import { addDays, differenceInCalendarDays, parseISO, format } from "date-fns";
import type { CycleDay, CyclePrediction } from "../types";

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const OVULATION_OFFSET_BEFORE_NEXT_PERIOD = 14;
const FERTILE_WINDOW_BEFORE_OVULATION = 5;
const FERTILE_WINDOW_AFTER_OVULATION = 1;

function toDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Vrai flux de règles. Le spotting (et l'absence de flux) ne compte ni pour
 * détecter un début de règles ni dans leur durée : un spotting en milieu de
 * cycle devenait sinon un "début de règles" et décalait la prochaine date
 * d'environ deux semaines. Il reste affiché tel quel au calendrier.
 */
function isPeriodFlow(day: CycleDay): boolean {
  return day.flow === "leger" || day.flow === "moyen" || day.flow === "abondant";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Regroupe les jours de règles consécutifs (vrai flux, voir isPeriodFlow) en
 * "débuts de cycle", pour en déduire la longueur des cycles passés.
 */
function getPeriodStarts(days: CycleDay[]): string[] {
  const periodDates = days
    .filter(isPeriodFlow)
    .map((d) => d.date)
    .sort();

  const starts: string[] = [];
  let previous: string | null = null;

  for (const date of periodDates) {
    if (!previous || differenceInCalendarDays(toDate(date), toDate(previous)) > 1) {
      starts.push(date);
    }
    previous = date;
  }

  return starts;
}

export function computeCyclePrediction(
  days: CycleDay[],
  fallbackCycleLength = DEFAULT_CYCLE_LENGTH,
  fallbackPeriodLength = DEFAULT_PERIOD_LENGTH
): CyclePrediction {
  const starts = getPeriodStarts(days);

  const cycleLengths: { start: string; length: number }[] = [];
  for (let i = 1; i < starts.length; i++) {
    const length = differenceInCalendarDays(toDate(starts[i]), toDate(starts[i - 1]));
    if (length >= 15 && length <= 60) {
      cycleLengths.push({ start: starts[i - 1], length });
    }
  }

  // Médiane (et non moyenne) des 6 dernières durées : un cycle inhabituel
  // (règles oubliées dans la saisie, cycle isolé très long ou très court) ne
  // décale plus toute la prédiction.
  const recentLengths = cycleLengths.slice(-6).map((c) => c.length);
  const averageCycleLength = recentLengths.length ? Math.round(median(recentLengths)) : fallbackCycleLength;

  const lastPeriodStart = starts.length ? starts[starts.length - 1] : null;

  // Longueur moyenne des règles observées (vrai flux seulement, voir isPeriodFlow)
  const periodLengths: number[] = [];
  let currentRun = 0;
  const sortedFlowDays = days.filter(isPeriodFlow).map((d) => d.date).sort();
  for (let i = 0; i < sortedFlowDays.length; i++) {
    currentRun++;
    const next = sortedFlowDays[i + 1];
    if (!next || differenceInCalendarDays(toDate(next), toDate(sortedFlowDays[i])) > 1) {
      periodLengths.push(currentRun);
      currentRun = 0;
    }
  }
  const averagePeriodLength = periodLengths.length
    ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
    : fallbackPeriodLength;

  let nextPeriodStart: string | null = null;
  let ovulationDate: string | null = null;
  let fertileWindowStart: string | null = null;
  let fertileWindowEnd: string | null = null;
  let currentCycleDay: number | null = null;

  if (lastPeriodStart) {
    const next = addDays(toDate(lastPeriodStart), averageCycleLength);
    nextPeriodStart = format(next, "yyyy-MM-dd");

    const ovulation = addDays(next, -OVULATION_OFFSET_BEFORE_NEXT_PERIOD);
    ovulationDate = format(ovulation, "yyyy-MM-dd");

    fertileWindowStart = format(addDays(ovulation, -FERTILE_WINDOW_BEFORE_OVULATION), "yyyy-MM-dd");
    fertileWindowEnd = format(addDays(ovulation, FERTILE_WINDOW_AFTER_OVULATION), "yyyy-MM-dd");

    currentCycleDay = differenceInCalendarDays(new Date(), toDate(lastPeriodStart)) + 1;
  }

  return {
    lastPeriodStart,
    nextPeriodStart,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    averageCycleLength,
    averagePeriodLength,
    cycleLengths,
    currentCycleDay,
  };
}

export function isWithinRange(date: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const d = toDate(date).getTime();
  return d >= toDate(start).getTime() && d <= toDate(end).getTime();
}

/**
 * Jours de règles prédits, en projetant plusieurs cycles à partir de
 * `nextPeriodStart` jusqu'à couvrir la date `until` — sans ça, le calendrier
 * ne prédisait que le tout prochain cycle et n'affichait plus rien en
 * naviguant sur les mois suivants.
 */
export function predictedPeriodDatesUntil(
  nextPeriodStart: string | null,
  averageCycleLength: number,
  averagePeriodLength: number,
  until: Date
): Set<string> {
  const result = new Set<string>();
  if (!nextPeriodStart) return result;

  let cursor = toDate(nextPeriodStart);
  const untilTime = until.getTime();
  // Garde-fou : au plus 24 cycles projetés (~2 ans), largement suffisant.
  for (let cycle = 0; cycle < 24 && cursor.getTime() <= untilTime; cycle++) {
    for (let i = 0; i < averagePeriodLength; i++) {
      result.add(format(addDays(cursor, i), "yyyy-MM-dd"));
    }
    cursor = addDays(cursor, averageCycleLength);
  }
  return result;
}
