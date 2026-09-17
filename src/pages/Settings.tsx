import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCouple } from "../context/CoupleContext";
import { useSoloProfile } from "../context/SoloContext";
import { useCycleData } from "../context/CycleDataContext";
import { useMode } from "../context/ModeContext";
import { useThemeMode } from "../context/ThemeModeContext";
import { supabase } from "../lib/supabase";
import { applyThemeFromImageUrl } from "../lib/materialYou";
import { resizeImageToDataUrl } from "../lib/localStore";
import { exportCycleDaysAsFile, parseBackupFile } from "../lib/backup";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import { requestNotificationPermission, schedulePeriodNotification } from "../lib/notifications";
import { checkForUpdate, openUpdateDownload, type UpdateCheckResult } from "../lib/appUpdate";
import { Capacitor } from "@capacitor/core";
import ThemeModeCard from "../components/ThemeModeCard";

export default function Settings() {
  const { mode } = useMode();
  return mode === "solo" ? <SoloSettings /> : <DuoSettings />;
}

function ModeSwitcher({ label }: { label: string }) {
  const { resetMode } = useMode();
  return (
    <button className="btn btn-text" onClick={resetMode}>
      {label}
    </button>
  );
}

function AppearanceCard({
  imageUrl,
  onPickImage,
  uploading,
}: {
  imageUrl: string | null | undefined;
  onPickImage: (file: File) => void;
  uploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (Capacitor.getPlatform() === "android") {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Apparence — Material You</h3>
        <p style={{ marginTop: 0, marginBottom: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          Les couleurs de l'app s'adaptent automatiquement à ton fond d'écran, comme le reste du
          téléphone.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Apparence — Material You</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
        Choisis une image : les couleurs de l'app s'adapteront automatiquement (sur Android, l'app
        utilise directement le fond d'écran du téléphone).
      </p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Fond choisi"
          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: "var(--radius-m)", marginBottom: 12 }}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickImage(file);
        }}
      />
      <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? "Chargement..." : "Choisir une image"}
      </button>
    </div>
  );
}

function NotificationsCard({
  daysBefore,
  onDaysBeforeChange,
  onSave,
  status,
}: {
  daysBefore: number;
  onDaysBeforeChange: (n: number) => void;
  onSave: () => void;
  status: string | null;
}) {
  return (
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
          onChange={(e) => onDaysBeforeChange(Number(e.target.value))}
        >
          <option value={0}>Le jour J</option>
          <option value={1}>1 jour avant</option>
          <option value={2}>2 jours avant</option>
          <option value={3}>3 jours avant</option>
        </select>
      </label>
      <button className="btn btn-primary" onClick={onSave}>
        Activer les rappels
      </button>
      {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}
    </div>
  );
}

function BackupCard({
  cycleDays,
  coupleName,
  canRestore,
  onRestore,
}: {
  cycleDays: import("../types").CycleDay[];
  coupleName: string;
  canRestore: boolean;
  onRestore: (entries: import("../lib/backup").BackupEntry[]) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleFile(file: File) {
    setRestoring(true);
    setStatus(null);
    try {
      const entries = await parseBackupFile(file);
      await onRestore(entries);
      setStatus(`${entries.length} jour(s) restauré(s) ✅`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Échec de la restauration");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Sauvegarde</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
        Exporte un fichier de secours avec tout ton historique. Utile en cas de changement de
        téléphone ou de perte d'accès au compte.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn btn-secondary"
          onClick={() => exportCycleDaysAsFile(cycleDays, coupleName)}
          disabled={cycleDays.length === 0}
        >
          Exporter mes données
        </button>
        {canRestore && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <button className="btn btn-text" onClick={() => fileInputRef.current?.click()} disabled={restoring}>
              {restoring ? "Restauration..." : "Restaurer une sauvegarde"}
            </button>
          </>
        )}
      </div>
      {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}
    </div>
  );
}

function UpdateCard() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!Capacitor.isNativePlatform()) return null;

  async function handleCheck() {
    setChecking(true);
    setError(null);
    try {
      setResult(await checkForUpdate());
    } catch {
      setError("Impossible de vérifier les mises à jour pour le moment.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Mises à jour</h3>
      {result?.currentVersion && (
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          Version installée : {result.currentVersion}
        </p>
      )}
      {!result?.updateAvailable ? (
        <button className="btn btn-secondary" onClick={handleCheck} disabled={checking}>
          {checking ? "Vérification..." : "Vérifier les mises à jour"}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => result.downloadUrl && openUpdateDownload(result.downloadUrl)}
        >
          Télécharger la version {result.latestVersion}
        </button>
      )}
      {result && !result.updateAvailable && result.currentVersion && (
        <p style={{ fontSize: 13, marginTop: 10 }}>Tu as déjà la dernière version ✅</p>
      )}
      {error && <p style={{ fontSize: 13, marginTop: 10, color: "var(--md-sys-color-error)" }}>{error}</p>}
    </div>
  );
}

function DuoSettings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { couple, role } = useCouple();
  const { cycleDays, averageCycleLength, averagePeriodLength, canEdit, upsertCycleDay } = useCycleData();
  const { isDark } = useThemeMode();
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [daysBefore, setDaysBefore] = useState(profile?.notifications_days_before ?? 2);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength),
    [cycleDays, averageCycleLength, averagePeriodLength]
  );

  async function handleImagePick(file: File) {
    if (!user) return;
    setUploading(true);

    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("theme-images").upload(path, file, {
      upsert: true,
    });

    if (!uploadError) {
      const { data } = supabase.storage.from("theme-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const seedHex = await applyThemeFromImageUrl(publicUrl, isDark);
      await supabase
        .from("profiles")
        .update({ theme_image_url: publicUrl, theme_seed_color: seedHex })
        .eq("id", user.id);
      await refreshProfile();
    }
    setUploading(false);
  }

  async function handleRestoreBackup(entries: { date: string; flow: import("../types").FlowIntensity | null; symptoms: string[]; mood: string | null; note: string | null }[]) {
    for (const entry of entries) {
      await upsertCycleDay(entry.date, {
        flow: entry.flow,
        symptoms: entry.symptoms,
        mood: entry.mood,
        note: entry.note,
      });
    }
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

      <AppearanceCard imageUrl={profile?.theme_image_url} onPickImage={handleImagePick} uploading={uploading} />

      <ThemeModeCard />

      <NotificationsCard
        daysBefore={daysBefore}
        onDaysBeforeChange={setDaysBefore}
        onSave={handleSaveNotifications}
        status={notifStatus}
      />

      <BackupCard
        cycleDays={cycleDays}
        coupleName={couple?.name ?? ""}
        canRestore={canEdit}
        onRestore={handleRestoreBackup}
      />

      <UpdateCard />

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

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-text" onClick={signOut}>
          Se déconnecter
        </button>
        <ModeSwitcher label="Passer en mode solo" />
      </div>
    </div>
  );
}

function SoloSettings() {
  const { settings, updateSettings } = useSoloProfile();
  const { cycleDays, upsertCycleDay } = useCycleData();
  const { isDark } = useThemeMode();
  const [uploading, setUploading] = useState(false);
  const [daysBefore, setDaysBefore] = useState(settings.notifications_days_before);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const prediction = useMemo(() => computeCyclePrediction(cycleDays, 28, 5), [cycleDays]);

  async function handleImagePick(file: File) {
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const seedHex = await applyThemeFromImageUrl(dataUrl, isDark);
      updateSettings({ theme_image_url: dataUrl, theme_seed_color: seedHex });
    } finally {
      setUploading(false);
    }
  }

  async function handleRestoreBackup(entries: { date: string; flow: import("../types").FlowIntensity | null; symptoms: string[]; mood: string | null; note: string | null }[]) {
    for (const entry of entries) {
      await upsertCycleDay(entry.date, {
        flow: entry.flow,
        symptoms: entry.symptoms,
        mood: entry.mood,
        note: entry.note,
      });
    }
  }

  async function handleSaveNotifications() {
    updateSettings({ notifications_days_before: daysBefore });

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
        <p style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>Mode solo</p>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Mode solo</h3>
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          Aucun compte : tes données restent uniquement sur cet appareil et ne sont partagées avec
          personne.
        </p>
      </div>

      <AppearanceCard imageUrl={settings.theme_image_url} onPickImage={handleImagePick} uploading={uploading} />

      <ThemeModeCard />

      <NotificationsCard
        daysBefore={daysBefore}
        onDaysBeforeChange={setDaysBefore}
        onSave={handleSaveNotifications}
        status={notifStatus}
      />

      <BackupCard cycleDays={cycleDays} coupleName="Mon cycle" canRestore onRestore={handleRestoreBackup} />

      <UpdateCard />

      <ModeSwitcher label="Passer en mode duo (compte partagé)" />
    </div>
  );
}
