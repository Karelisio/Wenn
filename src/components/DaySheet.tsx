import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useCycleData } from "../context/CycleDataContext";
import {
  SYMPTOM_LABELS,
  SYMPTOM_OPTIONS,
  MOOD_OPTIONS,
  FLOW_INTENSITY_EMOJI,
  VAGINAL_PAIN_EMOJI,
  type FlowIntensity,
} from "../types";

const FLOW_OPTIONS: { value: FlowIntensity; label: string; emoji: string }[] = [
  { value: "spotting", label: "Spotting", emoji: FLOW_INTENSITY_EMOJI.spotting },
  { value: "leger", label: "Léger", emoji: FLOW_INTENSITY_EMOJI.leger },
  { value: "moyen", label: "Moyen", emoji: FLOW_INTENSITY_EMOJI.moyen },
  { value: "abondant", label: "Abondant", emoji: FLOW_INTENSITY_EMOJI.abondant },
];

const VAGINAL_PAIN_OPTIONS: { value: FlowIntensity; label: string; emoji: string }[] = [
  { value: "leger", label: "Légère", emoji: VAGINAL_PAIN_EMOJI },
  { value: "moyen", label: "Moyenne", emoji: VAGINAL_PAIN_EMOJI.repeat(2) },
  { value: "abondant", label: "Forte", emoji: VAGINAL_PAIN_EMOJI.repeat(3) },
];

export default function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { mode, cycleDays, partnerNotes, upsertCycleDay, addPartnerNote, canEdit } = useCycleData();
  const existing = cycleDays.find((d) => d.date === date);
  const dayNotes = partnerNotes.filter((n) => n.date === date);

  const [flow, setFlow] = useState<FlowIntensity | null>(existing?.flow ?? null);
  const [vaginalPain, setVaginalPain] = useState<FlowIntensity | null>(existing?.vaginal_pain ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [newPartnerNote, setNewPartnerNote] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [customMood, setCustomMood] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const addingNoteRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Vrai dès que l'utilisatrice a touché à la saisie (ou tenté de l'enregistrer) :
  // à partir de là, elle n'est plus jamais remplacée par la version enregistrée.
  // En cas de refus du serveur (modification annulée à l'écran), la fiche reste
  // aussi ouverte avec ce qui a été saisi, pour pouvoir réessayer.
  const editedRef = useRef(false);
  const shownDateRef = useRef(date);

  // Saisie reprise de la version enregistrée à l'ouverture et à chaque changement
  // de jour. Ensuite, un changement du contenu enregistré (autre appareil, écho
  // temps réel, rechargement au retour dans l'app) n'est repris que tant que rien
  // n'a été touché : il effaçait sinon ce qui était en cours de saisie.
  const existingContent = JSON.stringify(
    existing ? [existing.flow, existing.vaginal_pain, existing.symptoms, existing.mood, existing.note] : null
  );
  useEffect(() => {
    if (shownDateRef.current !== date) {
      shownDateRef.current = date;
      editedRef.current = false;
    } else if (editedRef.current) {
      return;
    }
    setFlow(existing?.flow ?? null);
    setVaginalPain(existing?.vaginal_pain ?? null);
    setSymptoms(existing?.symptoms ?? []);
    setMood(existing?.mood ?? null);
    setNote(existing?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existingContent]);

  function markEdited() {
    editedRef.current = true;
  }

  function toggleSymptom(s: string) {
    markEdited();
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function addCustomSymptom() {
    const trimmed = customSymptom.trim();
    if (!trimmed || symptoms.includes(trimmed)) return;
    markEdited();
    setSymptoms((prev) => [...prev, trimmed]);
    setCustomSymptom("");
  }

  function addCustomMood() {
    const trimmed = customMood.trim();
    if (!trimmed) return;
    markEdited();
    setMood(trimmed);
    setCustomMood("");
  }

  const customSymptoms = symptoms.filter((s) => !(SYMPTOM_OPTIONS as readonly string[]).includes(s));
  const isCustomMood = mood !== null && !(MOOD_OPTIONS as readonly string[]).includes(mood);

  // Hors ligne, l'enregistrement est mis en file d'attente et compte comme réussi :
  // seule une vraie erreur garde la feuille ouverte, avec son message.
  async function handleSave() {
    markEdited();
    setSaving(true);
    setError(null);
    const result = await upsertCycleDay(date, { flow, vaginal_pain: vaginalPain, symptoms, mood, note: note || null });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  // Un seul envoi à la fois : un double appui sur « Ajouter » envoyait le même mot
  // doux deux fois (la référence bloque même avant que le bouton soit grisé).
  async function handleAddPartnerNote() {
    const message = newPartnerNote.trim();
    if (!message || addingNoteRef.current) return;
    addingNoteRef.current = true;
    setAddingNote(true);
    setError(null);
    try {
      const result = await addPartnerNote(date, message);
      if (result.error) setError(result.error);
      else setNewPartnerNote("");
    } finally {
      addingNoteRef.current = false;
      setAddingNote(false);
    }
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
                onClick={() => {
                  markEdited();
                  setFlow(flow === opt.value ? null : opt.value);
                }}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Douleurs</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {VAGINAL_PAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip${vaginalPain === opt.value ? " selected" : ""}`}
                disabled={!canEdit}
                onClick={() => {
                  markEdited();
                  setVaginalPain(vaginalPain === opt.value ? null : opt.value);
                }}
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
                onClick={() => {
                  markEdited();
                  setMood(mood === m ? null : m);
                }}
              >
                {m}
              </button>
            ))}
            {isCustomMood && (
              <button
                className="chip selected"
                disabled={!canEdit}
                onClick={() => {
                  markEdited();
                  setMood(null);
                }}
              >
                {mood} ✕
              </button>
            )}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="input"
                placeholder="Humeur spécifique (ex: stressée, sereine...)"
                value={customMood}
                onChange={(e) => setCustomMood(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomMood();
                  }
                }}
              />
              <button className="btn btn-secondary" onClick={addCustomMood} disabled={!customMood.trim()}>
                Ajouter
              </button>
            </div>
          )}
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
            {customSymptoms.map((s) => (
              <button key={s} className="chip selected" disabled={!canEdit} onClick={() => toggleSymptom(s)}>
                {s} ✕
              </button>
            ))}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="input"
                placeholder="Douleur spécifique (ex: migraine, sciatique...)"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSymptom();
                  }
                }}
              />
              <button className="btn btn-secondary" onClick={addCustomSymptom} disabled={!customSymptom.trim()}>
                Ajouter
              </button>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3 className="section-title">Notes</h3>
          <textarea
            className="input"
            rows={3}
            placeholder="Une note pour cette journée..."
            value={note}
            disabled={!canEdit}
            onChange={(e) => {
              markEdited();
              setNote(e.target.value);
            }}
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
              <button
                className="btn btn-secondary"
                onClick={handleAddPartnerNote}
                disabled={addingNote || !newPartnerNote.trim()}
              >
                Ajouter
              </button>
            </div>
          </section>
        )}

        {error && <p style={{ color: "var(--md-sys-color-error)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

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
