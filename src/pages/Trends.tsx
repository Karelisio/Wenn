import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

function intensityTickFormatter(value: number): string {
  return INTENSITY_LABEL[value] ?? "";
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
          flux: d.flow ? INTENSITY_VALUE[d.flow] : 0,
          douleur: d.vaginal_pain ? INTENSITY_VALUE[d.vaginal_pain] : 0,
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

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">🩸 Flux</h3>
        {intensityData.filter((d) => d.flux > 0).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Pas encore de flux enregistré.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intensityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
              <Bar dataKey="flux" radius={[6, 6, 6, 6]} fill="var(--md-sys-color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">🔥 Douleurs vaginales</h3>
        {intensityData.filter((d) => d.douleur > 0).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Pas encore de douleur vaginale enregistrée.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intensityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
              <Bar dataKey="douleur" radius={[6, 6, 6, 6]} fill="var(--md-sys-color-tertiary, #7c5635)" />
            </BarChart>
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
            <BarChart data={intensityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
              <Bar dataKey="flux" name="Flux" radius={[6, 6, 0, 0]} fill="var(--md-sys-color-primary)" />
              <Bar
                dataKey="douleur"
                name="Douleur vaginale"
                radius={[6, 6, 0, 0]}
                fill="var(--md-sys-color-tertiary, #7c5635)"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
