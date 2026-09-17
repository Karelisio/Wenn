import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useCycleData } from "../context/CycleDataContext";
import { computeCyclePrediction, isWithinRange } from "../lib/cyclePredictions";
import { FLOW_EMOJI, SYMPTOM_EMOJI, SYMPTOM_OPTIONS, VAGINAL_PAIN_EMOJI } from "../types";
import DaySheet from "../components/DaySheet";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default function Calendar() {
  const { coupleName, cycleDays, role, averageCycleLength, averagePeriodLength } = useCycleData();
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength),
    [cycleDays, averageCycleLength, averagePeriodLength]
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const flowByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of cycleDays) if (d.flow) map.set(d.date, d.flow);
    return map;
  }, [cycleDays]);

  // Emoji résumant ce qui a été enregistré ce jour-là (flux, douleurs, symptômes...),
  // affichés directement sur le calendrier — 3 max, plus un "+N" si besoin.
  const emojisByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of cycleDays) {
      const icons: string[] = [];
      if (d.flow) icons.push(FLOW_EMOJI);
      if (d.vaginal_pain) icons.push(VAGINAL_PAIN_EMOJI);
      for (const s of SYMPTOM_OPTIONS) {
        if (d.symptoms.includes(s)) icons.push(SYMPTOM_EMOJI[s]);
      }
      if (icons.length === 0) continue;
      const shown = icons.slice(0, 3);
      const extra = icons.length - shown.length;
      map.set(d.date, shown.join("") + (extra > 0 ? `+${extra}` : ""));
    }
    return map;
  }, [cycleDays]);

  function dayClasses(date: Date): string {
    const dateStr = format(date, "yyyy-MM-dd");
    const classes = ["calendar-day"];
    if (!isSameMonth(date, month)) classes.push("outside");
    if (isToday(date)) classes.push("today");
    if (flowByDate.has(dateStr)) classes.push("period");
    else if (
      prediction.nextPeriodStart &&
      dateStr >= prediction.nextPeriodStart &&
      dateStr <
        format(
          new Date(new Date(prediction.nextPeriodStart).getTime() + prediction.averagePeriodLength * 86400000),
          "yyyy-MM-dd"
        )
    ) {
      classes.push("predicted-period");
    } else if (isWithinRange(dateStr, prediction.fertileWindowStart, prediction.fertileWindowEnd)) {
      classes.push("fertile");
    }
    if (dateStr === prediction.ovulationDate) classes.push("ovulation");
    return classes.join(" ");
  }

  const daysUntilNextPeriod = prediction.nextPeriodStart
    ? Math.ceil((new Date(prediction.nextPeriodStart).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="screen">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 2px" }}>Wenn 🌸</h1>
        <p style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>
          {coupleName} {role === "partner" && "· lecture"}
        </p>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        {daysUntilNextPeriod !== null ? (
          <>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
              {prediction.currentCycleDay ? `Jour ${prediction.currentCycleDay} du cycle` : "Cycle en cours"}
            </p>
            <h2 style={{ margin: 0 }}>
              {daysUntilNextPeriod <= 0
                ? "Règles attendues aujourd'hui"
                : daysUntilNextPeriod === 1
                  ? "Règles prévues demain"
                  : `Règles prévues dans ${daysUntilNextPeriod} jours`}
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
              Ovulation estimée le{" "}
              {prediction.ovulationDate && format(new Date(prediction.ovulationDate), "d MMMM", { locale: fr })}
            </p>
          </>
        ) : (
          <p style={{ margin: 0 }}>Enregistre tes premières règles pour obtenir des prédictions ✨</p>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button className="btn btn-text" style={{ padding: 8 }} onClick={() => setMonth(addMonths(month, -1))}>
            ◀
          </button>
          <strong style={{ textTransform: "capitalize" }}>{format(month, "MMMM yyyy", { locale: fr })}</strong>
          <button className="btn btn-text" style={{ padding: 8 }} onClick={() => setMonth(addMonths(month, 1))}>
            ▶
          </button>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="calendar-weekday">
              {w}
            </div>
          ))}
          {days.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const emojis = emojisByDate.get(dateStr);
            return (
              <button
                key={date.toISOString()}
                className={dayClasses(date)}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="calendar-day-number">{date.getDate()}</span>
                {emojis && <span className="calendar-day-emojis">{emojis}</span>}
              </button>
            );
          })}
        </div>

        <div className="legend">
          <span>
            <span className="legend-dot" style={{ background: "var(--md-sys-color-primary)" }} />
            Règles
          </span>
          <span>
            <span
              className="legend-dot"
              style={{
                background: "color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)",
                boxShadow: "inset 0 0 0 1.5px var(--md-sys-color-primary)",
              }}
            />
            Prédiction
          </span>
          <span>
            <span
              className="legend-dot"
              style={{
                background: "color-mix(in srgb, var(--md-sys-color-tertiary, #7c5635) 30%, transparent)",
                boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--md-sys-color-tertiary, #7c5635) 65%, transparent)",
              }}
            />
            Fenêtre fertile
          </span>
          <span>
            <span className="legend-dot" style={{ background: "var(--md-sys-color-tertiary, #7c5635)" }} />
            Ovulation
          </span>
        </div>
      </div>

      {selectedDate && <DaySheet date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </div>
  );
}
