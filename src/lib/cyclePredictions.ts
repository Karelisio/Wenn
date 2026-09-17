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
 * Regroupe les jours de règles consécutifs (flow non nul) en "débuts de cycle",
 * pour en déduire la longueur des cycles passés.
 */
function getPeriodStarts(days: CycleDay[]): string[] {
  const periodDates = days
    .filter((d) => d.flow)
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

  const recentLengths = cycleLengths.slice(-6).map((c) => c.length);
  const averageCycleLength = recentLengths.length
    ? Math.round(recentLengths.reduce((a, b) => a + b, 0) / recentLengths.length)
    : fallbackCycleLength;

  const lastPeriodStart = starts.length ? starts[starts.length - 1] : null;

  // Longueur moyenne des règles observées
  const periodLengths: number[] = [];
  let currentRun = 0;
  const sortedFlowDays = days.filter((d) => d.flow).map((d) => d.date).sort();
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
