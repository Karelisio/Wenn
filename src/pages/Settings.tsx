import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCouple } from "../context/CoupleContext";
import { supabase } from "../lib/supabase";
import { applyThemeFromImageUrl } from "../lib/materialYou";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import { requestNotificationPermission, schedulePeriodNotification } from "../lib/notifications";
import { Capacitor } from "@capacitor/core";

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { couple, role, cycleDays } = useCouple();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [daysBefore, setDaysBefore] = useState(profile?.notifications_days_before ?? 2);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, couple?.average_cycle_length, couple?.average_period_length),
    [cycleDays, couple]
  );

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("theme-images").upload(path, file, {
      upsert: true,
    });

    if (!uploadError) {
      const { data } = supabase.storage.from("theme-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const seedHex = await applyThemeFromImageUrl(publicUrl);
      await supabase
        .from("profiles")
        .update({ theme_image_url: publicUrl, theme_seed_color: seedHex })
        .eq("id", user.id);
      await refreshProfile();
    }
    setUploading(false);
  }

  async function copyInviteCode() {
    if (!couple) return;
    await navigator.clipboard.writeText(couple.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSaveNotifications() {
    if (!user) return;
    await supabase.from("profiles").update({ notifications_days_before: daysBefore }).eq("id", user.id);
    await refreshProfile();

    if (!Capacitor.isNativePlatform()) {
      setNotifStatus("Les notifications natives ne sont actives que dans l'app installée (Android/iOS).");
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      setNotifStatus("Permission de notification refusée.");
      return;
    }
    if (prediction.nextPeriodStart) {
      await schedulePeriodNotification(prediction.nextPeriodStart, daysBefore);
      setNotifStatus("Notification programmée ✅");
    } else {
      setNotifStatus("Pas encore assez de données pour prédire la prochaine notification.");
    }
  }

  return (
    <div className="screen">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 2px" }}>Réglages</h1>
        <p style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>{user?.email}</p>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Apparence — Material You</h3>
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          Choisis une image : les couleurs de l'app s'adapteront automatiquement.
        </p>
        {profile?.theme_image_url && (
          <img
            src={profile.theme_image_url}
            alt="Fond choisi"
            style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: "var(--radius-m)", marginBottom: 12 }}
          />
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "Chargement..." : "Choisir une image"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Notifications</h3>
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          Reçois une alerte avant le début prévu de tes règles.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ flex: 1 }}>Prévenir</span>
          <select
            className="input"
            style={{ width: 140 }}
            value={daysBefore}
            onChange={(e) => setDaysBefore(Number(e.target.value))}
          >
            <option value={0}>Le jour J</option>
            <option value={1}>1 jour avant</option>
            <option value={2}>2 jours avant</option>
            <option value={3}>3 jours avant</option>
          </select>
        </label>
        <button className="btn btn-primary" onClick={handleSaveNotifications}>
          Activer les rappels
        </button>
        {notifStatus && <p style={{ fontSize: 13, marginTop: 10 }}>{notifStatus}</p>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Couple lié</h3>
        <p style={{ marginTop: 0 }}>
          {couple?.name} — {role === "owner" ? "tu es la titulaire" : "tu as un accès partenaire (lecture)"}
        </p>
        {role === "owner" && (
          <>
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
              {couple?.partner_id
                ? "Un·e partenaire est lié·e à ton cycle."
                : "Partage ce code pour lier ton/ta partenaire :"}
            </p>
            {!couple?.partner_id && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code className="chip" style={{ fontSize: 16, letterSpacing: 2 }}>
                  {couple?.invite_code}
                </code>
                <button className="btn btn-text" onClick={copyInviteCode}>
                  {copied ? "Copié !" : "Copier"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <button className="btn btn-text" onClick={signOut}>
        Se déconnecter
      </button>
    </div>
  );
}
