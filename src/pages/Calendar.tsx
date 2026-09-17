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
          {days.map((date) => (
            <button
              key={date.toISOString()}
              className={dayClasses(date)}
              onClick={() => setSelectedDate(format(date, "yyyy-MM-dd"))}
            >
              {date.getDate()}
            </button>
          ))}
        </div>

        <div className="legend">
          <span>
            <span className="legend-dot" style={{ background: "var(--md-sys-color-primary)" }} />
            Règles
          </span>
          <span>
            <span
              className="legend-dot"
              style={{ background: "color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent)" }}
            />
            Prédiction
          </span>
          <span>
            <span
              className="legend-dot"
              style={{ background: "color-mix(in srgb, var(--md-sys-color-tertiary, #7c5635) 20%, transparent)" }}
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
