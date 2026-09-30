import assert from "node:assert/strict";
import { addDays, format, parseISO } from "date-fns";
import { computeCyclePrediction, predictedPeriodDatesUntil } from "../src/lib/cyclePredictions.ts";
import {
  backupFileName,
  buildBackup,
  isValidDateString,
  localDateString,
  parseBackup,
  restoreBackup,
  restoreSummary,
  type CycleDayFields,
} from "../src/lib/backupFormat.ts";
import type { CycleDay, FlowIntensity, PartnerNote } from "../src/types/index.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ok  " + name);
}
async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
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

console.log("\ndates locales");
check("date du jour en local, même juste après minuit (toISOString donnait la veille en France)", () => {
  const justAfterMidnight = new Date(2026, 0, 1, 0, 30);
  assert.equal(localDateString(justAfterMidnight), "2026-01-01");
  assert.equal(localDateString(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
  assert.equal(backupFileName(new Date(2026, 8, 30, 0, 15)), "wenn-sauvegarde-2026-09-30.json");
});

check("dates aaaa-mm-jj réelles uniquement", () => {
  assert.equal(isValidDateString("2026-09-30"), true);
  assert.equal(isValidDateString("2024-02-29"), true, "année bissextile");
  assert.equal(isValidDateString("2026-02-29"), false);
  assert.equal(isValidDateString("2026-02-30"), false);
  assert.equal(isValidDateString("2026-13-01"), false);
  assert.equal(isValidDateString("2026-9-30"), false);
  assert.equal(isValidDateString("30/09/2026"), false);
  assert.equal(isValidDateString(20260930), false);
  assert.equal(isValidDateString(null), false);
});

console.log("\nsauvegarde");
const note = (date: string, author_id: string, message: string): PartnerNote => ({
  id: `${date}-${author_id}-${message}`,
  couple_id: "c",
  date,
  author_id,
  message,
  created_at: "",
});
const fullDay: CycleDay = {
  ...day("2026-07-01", "moyen"),
  vaginal_pain: "leger",
  symptoms: ["crampes", "migraine"],
  mood: "stressée",
  note: "fatiguée",
};

check("export puis relecture : jours et mots doux identiques (format version 2)", () => {
  const file = buildBackup([fullDay], [note("2026-07-01", "me", "courage 💕")], "Nous");
  assert.equal(file.version, 2);
  const parsed = parseBackup(JSON.stringify(file));
  assert.equal(parsed.invalidDays, 0);
  assert.deepEqual(parsed.days, [
    {
      date: "2026-07-01",
      fields: { flow: "moyen", vaginal_pain: "leger", symptoms: ["crampes", "migraine"], mood: "stressée", note: "fatiguée" },
    },
  ]);
  assert.deepEqual(parsed.notes, [{ date: "2026-07-01", message: "courage 💕", authorId: "me" }]);
});

check("une sauvegarde de version 1 (jours seulement) reste lisible", () => {
  const v1 = { app: "wenn", version: 1, exportedAt: "", coupleName: "", cycleDays: [{ ...fullDay, id: undefined }] };
  const parsed = parseBackup(JSON.stringify(v1));
  assert.equal(parsed.days.length, 1);
  assert.deepEqual(parsed.notes, []);
});

check("un champ absent du fichier n'écrase rien (il n'est pas restauré à vide)", () => {
  const parsed = parseBackup(JSON.stringify({ cycleDays: [{ date: "2026-07-02", flow: "leger" }] }));
  assert.deepEqual(parsed.days[0].fields, { flow: "leger" });
});

check("entrées invalides écartées et comptées", () => {
  const parsed = parseBackup(
    JSON.stringify({
      app: "wenn",
      cycleDays: [
        { date: "2026-07-03", flow: null, symptoms: [] },
        { date: "2026-02-30", flow: "moyen" },
        { date: "2026-07-04", flow: "enorme" },
        { date: "2026-07-05", vaginal_pain: "spotting" },
        { date: "2026-07-06", symptoms: "crampes" },
        { date: "2026-07-07", symptoms: ["crampes", 3] },
        { date: "2026-07-08", mood: 5 },
        { date: "2026-07-09", note: ["?"] },
        { date: "2026-07-10" },
        "n'importe quoi",
        null,
      ],
      partnerNotes: [{ date: "2026-07-03", message: "  " }, { date: "hier", message: "coucou" }],
    })
  );
  assert.deepEqual(parsed.days, [{ date: "2026-07-03", fields: { flow: null, symptoms: [] } }]);
  assert.equal(parsed.invalidDays, 10);
  assert.equal(parsed.invalidNotes, 2);
});

check("un fichier qui n'est pas une sauvegarde Wenn est refusé", () => {
  assert.throws(() => parseBackup("{pas du json"), /illisible/);
  assert.throws(() => parseBackup("[]"), /pas une sauvegarde Wenn/);
  assert.throws(() => parseBackup(JSON.stringify({ cycleDays: {} })), /pas une sauvegarde Wenn/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "orbit", cycleDays: [] })), /pas une sauvegarde Wenn/);
});

await checkAsync("restauration : un refus n'arrête pas tout, restaurés et ignorés sont comptés", async () => {
  const written: string[] = [];
  const parsed = parseBackup(
    JSON.stringify({ cycleDays: [{ date: "2026-07-01", flow: "moyen" }, { date: "2026-07-02", flow: "leger" }, { date: "x" }] })
  );
  const report = await restoreBackup(parsed, {
    upsertCycleDay: async (date: string, _fields: CycleDayFields) => {
      written.push(date);
      return { error: date === "2026-07-01" ? "refusé" : null };
    },
  });
  assert.deepEqual(written, ["2026-07-01", "2026-07-02"]);
  assert.deepEqual(report, { daysRestored: 1, daysIgnored: 2, notesRestored: 0, notesIgnored: 0 });
  assert.equal(restoreSummary(report), "1 jour restauré, 2 ignorés (invalides ou refusés).");
});

await checkAsync("mots doux : déjà présents gardés, seuls ceux du compte connecté recréés", async () => {
  const file = buildBackup(
    [],
    [note("2026-07-01", "me", "à moi"), note("2026-07-01", "other", "déjà là"), note("2026-07-02", "other", "perdu")],
    "Nous"
  );
  const added: string[] = [];
  const report = await restoreBackup(parseBackup(JSON.stringify(file)), {
    upsertCycleDay: async () => ({ error: null }),
    notes: {
      existing: [note("2026-07-01", "other", "déjà là")],
      userId: "me",
      add: async (date: string, message: string) => {
        added.push(`${date} ${message}`);
        return { error: null };
      },
    },
  });
  assert.deepEqual(added, ["2026-07-01 à moi"]);
  assert.deepEqual(report, { daysRestored: 0, daysIgnored: 0, notesRestored: 2, notesIgnored: 1 });
});

await checkAsync("mode solo : les mots doux du fichier ne sont ni recréés ni comptés", async () => {
  const file = buildBackup([fullDay], [note("2026-07-01", "other", "coucou")], "Nous");
  const report = await restoreBackup(parseBackup(JSON.stringify(file)), { upsertCycleDay: async () => ({ error: null }) });
  assert.deepEqual(report, { daysRestored: 1, daysIgnored: 0, notesRestored: 0, notesIgnored: 0 });
  assert.equal(restoreSummary(report), "1 jour restauré ✅");
});

console.log(`\n${passed} vérifications OK\n`);
