import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCouple } from "../context/CoupleContext";
import { computeCyclePrediction } from "../lib/cyclePredictions";

export default function Trends() {
  const { couple, cycleDays } = useCouple();

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, couple?.average_cycle_length, couple?.average_period_length),
    [cycleDays, couple]
  );

  const chartData = prediction.cycleLengths.map((c) => ({
    label: format(parseISO(c.start), "MMM", { locale: fr }),
    length: c.length,
  }));

  const lengths = prediction.cycleLengths.map((c) => c.length);
  const variability = lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : null;

  return (
    <div className="screen">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 2px" }}>Tendances</h1>
        <p style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>
          Régularité du cycle au fil des mois
        </p>
      </header>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <p className="section-title" style={{ margin: "0 0 4px" }}>
            Moyenne
          </p>
          <strong style={{ fontSize: 22 }}>{prediction.averageCycleLength} j</strong>
        </div>
        <div style={{ flex: 1 }}>
          <p className="section-title" style={{ margin: "0 0 4px" }}>
            Règles
          </p>
          <strong style={{ fontSize: 22 }}>{prediction.averagePeriodLength} j</strong>
        </div>
        <div style={{ flex: 1 }}>
          <p className="section-title" style={{ margin: "0 0 4px" }}>
            Variabilité
          </p>
          <strong style={{ fontSize: 22 }}>{variability !== null ? `±${Math.round(variability / 2)} j` : "—"}</strong>
        </div>
      </div>

      <div className="card">
        {chartData.length === 0 ? (
          <p style={{ margin: 0 }}>
            Pas encore assez de données. Enregistre au moins deux cycles complets pour voir apparaître le
            graphique de tendance.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline)" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--md-sys-color-on-surface-variant)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--md-sys-color-on-surface-variant)" width={32} />
              <ReferenceLine
                y={prediction.averageCycleLength}
                stroke="var(--md-sys-color-primary)"
                strokeDasharray="4 4"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  background: "var(--md-sys-color-surface)",
                  color: "var(--md-sys-color-on-surface)",
                }}
                formatter={(value: number) => [`${value} jours`, "Longueur du cycle"]}
              />
              <Bar dataKey="length" radius={[8, 8, 8, 8]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="var(--md-sys-color-primary)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
