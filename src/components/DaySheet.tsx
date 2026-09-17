import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useCycleData } from "../context/CycleDataContext";
import { SYMPTOM_LABELS, SYMPTOM_OPTIONS, MOOD_OPTIONS, type FlowIntensity } from "../types";

const FLOW_OPTIONS: { value: FlowIntensity; label: string; emoji: string }[] = [
  { value: "leger", label: "Léger", emoji: "🩸" },
  { value: "moyen", label: "Moyen", emoji: "🩸🩸" },
  { value: "abondant", label: "Abondant", emoji: "🩸🩸🩸" },
];

export default function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { mode, cycleDays, partnerNotes, upsertCycleDay, addPartnerNote, canEdit } = useCycleData();
  const existing = cycleDays.find((d) => d.date === date);
  const dayNotes = partnerNotes.filter((n) => n.date === date);

  const [flow, setFlow] = useState<FlowIntensity | null>(existing?.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [newPartnerNote, setNewPartnerNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFlow(existing?.flow ?? null);
    setSymptoms(existing?.symptoms ?? []);
    setMood(existing?.mood ?? null);
    setNote(existing?.note ?? "");
  }, [existing]);

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSave() {
    setSaving(true);
    await upsertCycleDay(date, { flow, symptoms, mood, note: note || null });
    setSaving(false);
    onClose();
  }

  async function handleAddPartnerNote() {
    if (!newPartnerNote.trim()) return;
    await addPartnerNote(date, newPartnerNote.trim());
    setNewPartnerNote("");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 style={{ margin: "0 0 16px", textTransform: "capitalize" }}>
          {format(parseISO(date), "EEEE d MMMM", { locale: fr })}
        </h2>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Flux</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FLOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip${flow === opt.value ? " selected" : ""}`}
                disabled={!canEdit}
                onClick={() => setFlow(flow === opt.value ? null : opt.value)}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Humeur</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m}
                className={`chip${mood === m ? " selected" : ""}`}
                disabled={!canEdit}
                style={{ fontSize: 18, padding: "8px 12px" }}
                onClick={() => setMood(mood === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Symptômes</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s}
                className={`chip${symptoms.includes(s) ? " selected" : ""}`}
                disabled={!canEdit}
                onClick={() => toggleSymptom(s)}
              >
                {SYMPTOM_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Notes</h3>
          <textarea
            className="input"
            rows={3}
            placeholder="Une note pour cette journée..."
            value={note}
            disabled={!canEdit}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>

        {dayNotes.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h3 className="section-title">Mots doux</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayNotes.map((n) => (
                <div key={n.id} className="card" style={{ padding: 12 }}>
                  {n.message}
                </div>
              ))}
            </div>
          </section>
        )}

        {mode === "duo" && !canEdit && (
          <section style={{ marginBottom: 20 }}>
            <h3 className="section-title">Ajouter un mot doux / rappel</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Ex: Courage, je pense à toi 💕"
                value={newPartnerNote}
                onChange={(e) => setNewPartnerNote(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleAddPartnerNote}>
                Ajouter
              </button>
            </div>
          </section>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-text" onClick={onClose} style={{ flex: 1 }}>
            Fermer
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
