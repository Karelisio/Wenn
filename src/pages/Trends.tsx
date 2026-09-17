import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCycleData } from "../context/CycleDataContext";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import type { FlowIntensity } from "../types";

const INTENSITY_VALUE: Record<FlowIntensity, number> = { leger: 1, moyen: 2, abondant: 3 };
const INTENSITY_LABEL: Record<number, string> = { 1: "Léger", 2: "Moyen", 3: "Fort" };

function intensityTickFormatter(value: number | null | undefined): string {
  return value != null ? (INTENSITY_LABEL[value] ?? "") : "";
}

export default function Trends() {
  const { cycleDays, averageCycleLength, averagePeriodLength } = useCycleData();

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength),
    [cycleDays, averageCycleLength, averagePeriodLength]
  );

  const chartData = prediction.cycleLengths.map((c) => ({
    label: format(parseISO(c.start), "MMM", { locale: fr }),
    length: c.length,
  }));

  const lengths = prediction.cycleLengths.map((c) => c.length);
  const variability = lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : null;

  // Flux et douleurs vaginales des 30 derniers jours renseignés (les deux graphiques
  // dédiés et celui de comparaison partagent exactement les mêmes points).
  const intensityData = useMemo(
    () =>
      [...cycleDays]
        .filter((d) => d.flow || d.vaginal_pain)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30)
        .map((d) => ({
          label: format(parseISO(d.date), "d MMM", { locale: fr }),
          flux: d.flow ? INTENSITY_VALUE[d.flow] : null,
          douleur: d.vaginal_pain ? INTENSITY_VALUE[d.vaginal_pain] : null,
        })),
    [cycleDays]
  );

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
            <LineChart data={chartData} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
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
              <Line
                type="monotone"
                dataKey="length"
                stroke="var(--md-sys-color-primary)"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "var(--md-sys-color-primary)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              >
                <LabelList
                  dataKey="length"
                  position="top"
                  formatter={(value: number) => `${value}`}
                  style={{ fontSize: 12, fontWeight: 700, fill: "var(--md-sys-color-on-surface)" }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">🩸 Flux</h3>
        {intensityData.filter((d) => (d.flux ?? 0) > 0).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Pas encore de flux enregistré.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={intensityData} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline)" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--md-sys-color-on-surface-variant)" />
              <YAxis
                domain={[0, 3]}
                ticks={[1, 2, 3]}
                tickFormatter={intensityTickFormatter}
                tick={{ fontSize: 11 }}
                stroke="var(--md-sys-color-on-surface-variant)"
                width={52}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  background: "var(--md-sys-color-surface)",
                  color: "var(--md-sys-color-on-surface)",
                }}
                formatter={(value: number) => [intensityTickFormatter(value) || "—", "Flux"]}
              />
              <Line
                type="monotone"
                dataKey="flux"
                stroke="var(--md-sys-color-primary)"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "var(--md-sys-color-primary)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              >
                <LabelList
                  dataKey="flux"
                  position="top"
                  formatter={(value: number) => intensityTickFormatter(value)}
                  style={{ fontSize: 10, fontWeight: 700, fill: "var(--md-sys-color-on-surface)" }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">🔥 Douleurs vaginales</h3>
        {intensityData.filter((d) => (d.douleur ?? 0) > 0).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Pas encore de douleur vaginale enregistrée.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={intensityData} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline)" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--md-sys-color-on-surface-variant)" />
              <YAxis
                domain={[0, 3]}
                ticks={[1, 2, 3]}
                tickFormatter={intensityTickFormatter}
                tick={{ fontSize: 11 }}
                stroke="var(--md-sys-color-on-surface-variant)"
                width={52}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  background: "var(--md-sys-color-surface)",
                  color: "var(--md-sys-color-on-surface)",
                }}
                formatter={(value: number) => [intensityTickFormatter(value) || "—", "Douleur vaginale"]}
              />
              <Line
                type="monotone"
                dataKey="douleur"
                stroke="var(--md-sys-color-tertiary, #7c5635)"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "var(--md-sys-color-tertiary, #7c5635)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              >
                <LabelList
                  dataKey="douleur"
                  position="top"
                  formatter={(value: number) => intensityTickFormatter(value)}
                  style={{ fontSize: 10, fontWeight: 700, fill: "var(--md-sys-color-on-surface)" }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">Comparaison flux / douleurs vaginales</h3>
        {intensityData.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Pas encore assez de données pour comparer.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={intensityData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline)" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--md-sys-color-on-surface-variant)" />
              <YAxis
                domain={[0, 3]}
                ticks={[1, 2, 3]}
                tickFormatter={intensityTickFormatter}
                tick={{ fontSize: 11 }}
                stroke="var(--md-sys-color-on-surface-variant)"
                width={52}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  background: "var(--md-sys-color-surface)",
                  color: "var(--md-sys-color-on-surface)",
                }}
                formatter={(value: number, name: string) => [intensityTickFormatter(value) || "—", name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="flux"
                name="Flux"
                stroke="var(--md-sys-color-primary)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--md-sys-color-primary)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="douleur"
                name="Douleur vaginale"
                stroke="var(--md-sys-color-tertiary, #7c5635)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--md-sys-color-tertiary, #7c5635)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
