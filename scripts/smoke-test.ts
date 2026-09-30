import assert from "node:assert/strict";
import { addDays, format, parseISO } from "date-fns";
import { computeCyclePrediction, predictedPeriodDatesUntil } from "../src/lib/cyclePredictions.ts";
import type { CycleDay, FlowIntensity } from "../src/types/index.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

// Dates construites en local (comme l'app), jamais via toISOString() qui
// passe en UTC et peut décaler d'un jour selon le fuseau.
const shift = (date: string, n: number) => format(addDays(parseISO(date), n), "yyyy-MM-dd");

const day = (date: string, flow: FlowIntensity | null): CycleDay => ({
  id: date,
  couple_id: "c",
  date,
  flow,
  vaginal_pain: null,
  symptoms: [],
  mood: null,
  note: null,
  updated_by: null,
  created_at: "",
  updated_at: "",
});

/** Règles de `length` jours (flux "moyen") à partir de chaque date de début. */
function periods(starts: string[], length = 4): CycleDay[] {
  return starts.flatMap((start) => Array.from({ length }, (_, i) => day(shift(start, i), "moyen")));
}

console.log("\nprédiction des règles");
// 3 cycles réguliers de 28 jours, règles de 4 jours
const regular = periods(["2026-06-01", "2026-06-29", "2026-07-27"]);

check("cas régulier : durées déduites de l'historique", () => {
  const p = computeCyclePrediction(regular);
  assert.equal(p.averageCycleLength, 28);
  assert.equal(p.averagePeriodLength, 4);
  assert.equal(p.lastPeriodStart, "2026-07-27");
  assert.equal(p.nextPeriodStart, "2026-08-24");
  assert.equal(p.ovulationDate, "2026-08-10");
});

check("un spotting en milieu de cycle ne décale pas les prochaines règles", () => {
  const withSpotting = [...regular, day("2026-08-10", "spotting"), day("2026-08-11", "spotting")];
  const p = computeCyclePrediction(withSpotting);
  assert.equal(p.lastPeriodStart, "2026-07-27");
  assert.equal(p.nextPeriodStart, "2026-08-24");
  assert.equal(p.averagePeriodLength, 4, "le spotting ne compte pas dans la durée des règles");
});

check("un spotting avant les règles n'avance pas leur début", () => {
  const p = computeCyclePrediction([...regular, day("2026-07-26", "spotting")]);
  assert.equal(p.lastPeriodStart, "2026-07-27");
  assert.equal(p.averagePeriodLength, 4);
});

check("du spotting seul ne donne aucune prédiction", () => {
  const p = computeCyclePrediction([day("2026-07-01", "spotting"), day("2026-07-02", "spotting")]);
  assert.equal(p.lastPeriodStart, null);
  assert.equal(p.nextPeriodStart, null);
});

check("la médiane ignore un cycle aberrant", () => {
  // Cycles de 28, 45 (règles oubliées dans la saisie ?) puis 28 jours :
  // la moyenne donnerait 34 jours, la médiane reste à 28.
  const p = computeCyclePrediction(periods(["2026-03-01", "2026-03-29", "2026-05-13", "2026-06-10"]));
  assert.deepEqual(
    p.cycleLengths.map((c) => c.length),
    [28, 45, 28]
  );
  assert.equal(p.averageCycleLength, 28);
  assert.equal(p.nextPeriodStart, "2026-07-08");
});

check("médiane d'un nombre pair de cycles : moyenne des deux du milieu, arrondie", () => {
  // Cycles de 27, 28, 29 et 40 jours -> (28 + 29) / 2 = 28,5 -> 29
  const p = computeCyclePrediction(periods(["2026-01-01", "2026-01-28", "2026-02-25", "2026-03-26", "2026-05-05"]));
  assert.deepEqual(
    p.cycleLengths.map((c) => c.length),
    [27, 28, 29, 40]
  );
  assert.equal(p.averageCycleLength, 29);
});

check("seules les 6 dernières durées comptent", () => {
  // 6 cycles anciens de 35 jours, puis 6 récents de 26 jours : la médiane de
  // tout l'historique donnerait 31, celle des 6 derniers 26.
  const starts = ["2025-01-01"];
  for (let i = 0; i < 6; i++) starts.push(shift(starts[starts.length - 1], 35));
  for (let i = 0; i < 6; i++) starts.push(shift(starts[starts.length - 1], 26));
  const p = computeCyclePrediction(periods(starts));
  assert.equal(p.cycleLengths.length, 12);
  assert.equal(p.averageCycleLength, 26);
});

check("durées hors 15-60 jours ignorées, repli sans cycle valide", () => {
  const p = computeCyclePrediction(periods(["2026-01-01", "2026-04-01"]), 30, 5);
  assert.deepEqual(p.cycleLengths, []);
  assert.equal(p.averageCycleLength, 30, "repli inchangé");
  assert.equal(p.nextPeriodStart, "2026-05-01");
});

check("aucune prédiction sans historique", () => {
  const p = computeCyclePrediction([]);
  assert.equal(p.nextPeriodStart, null);
  assert.equal(p.averageCycleLength, 28);
  assert.equal(p.averagePeriodLength, 5);
  assert.equal(predictedPeriodDatesUntil(p.nextPeriodStart, 28, 5, new Date(2027, 0, 1)).size, 0);
});

check("la projection couvre les mois suivants", () => {
  const p = computeCyclePrediction(regular);
  const predicted = predictedPeriodDatesUntil(p.nextPeriodStart, p.averageCycleLength, p.averagePeriodLength, new Date(2026, 10, 30));
  assert.ok(predicted.has("2026-08-24"), "cycle suivant");
  assert.ok(predicted.has("2026-09-21"), "mois d'après");
  assert.ok(predicted.has("2026-11-16"), "et encore après");
  assert.equal(predicted.has("2026-08-28"), false, "s'arrête après la durée des règles");
});

console.log(`\n${passed} vérifications OK\n`);
