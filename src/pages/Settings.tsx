import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCouple } from "../context/CoupleContext";
import { useSoloProfile } from "../context/SoloContext";
import { useCycleData } from "../context/CycleDataContext";
import { useMode } from "../context/ModeContext";
import { useThemeMode } from "../context/ThemeModeContext";
import { useUiScale, UI_SCALE_OPTIONS } from "../context/UiScaleContext";
import { isNetworkError, supabase } from "../lib/supabase";
import { applyThemeFromImageUrl } from "../lib/materialYou";
import { resizeImageToDataUrl } from "../lib/localStore";
import { exportBackupFile, parseBackupFile } from "../lib/backup";
import { restoreBackup, restoreSummary, type ParsedBackup, type RestoreReport } from "../lib/backupFormat";
import { computeCyclePrediction } from "../lib/cyclePredictions";
import {
  isExactAlarmGranted,
  isPeriodReminderEnabled,
  openExactAlarmSettings,
  requestNotificationPermission,
  schedulePeriodNotification,
  setPeriodReminderEnabled,
} from "../lib/notifications";
import { checkForUpdate, downloadAndInstallUpdate, openUpdateDownload, type UpdateCheckResult } from "../lib/appUpdate";
import { clearLastCrash, getLastCrash, type CrashReport } from "../lib/crashLog";
import { Capacitor } from "@capacitor/core";
import ThemeModeCard from "../components/ThemeModeCard";
import type { CycleDay, PartnerNote } from "../types";

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

  // Sur Android, le thème suit déjà le fond d'écran nativement : cette carte
  // n'aurait rien d'actionnable à proposer.
  if (Capacitor.getPlatform() === "android") return null;

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

function UiScaleCard() {
  const { scale, setScale } = useUiScale();

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Taille de l'affichage</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
        Propre à cet appareil (texte et éléments plus grands ou plus petits).
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {UI_SCALE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`chip${scale === opt.value ? " selected" : ""}`}
            onClick={() => setScale(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Active le rappel de règles sur cet appareil (reprogrammé ensuite automatiquement
 * par ReminderSync à chaque changement de prédiction) et programme tout de suite le
 * prochain. Le message ne dit « programmée » que si une notification l'a vraiment été.
 */
async function enablePeriodReminder(
  nextPeriodStart: string | null,
  daysBefore: number
): Promise<{ enabled: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    return {
      enabled: false,
      message: "Les notifications natives ne sont actives que dans l'app installée (Android/iOS).",
    };
  }
  if (!(await requestNotificationPermission())) {
    return { enabled: false, message: "Permission de notification refusée." };
  }
  setPeriodReminderEnabled(true);
  if (!nextPeriodStart) {
    return { enabled: true, message: "Pas encore assez de données pour prédire la prochaine notification." };
  }
  const scheduled = await schedulePeriodNotification(nextPeriodStart, daysBefore);
  return {
    enabled: true,
    message: scheduled
      ? "Notification programmée ✅"
      : "La date du rappel est déjà passée : il sera programmé pour tes prochaines règles prévues.",
  };
}

function NotificationsCard({
  daysBefore,
  onDaysBeforeChange,
  onSave,
  status,
}: {
  daysBefore: number;
  onDaysBeforeChange: (n: number) => void;
  /** Renvoie si le rappel est bien activé (permission accordée). */
  onSave: () => Promise<boolean>;
  status: string | null;
}) {
  const [activated, setActivated] = useState(false);

  // Le rappel reste actif d'une visite à l'autre (voir ReminderSync) : le bouton
  // l'indique, et ne redevient actif que si le délai change.
  useEffect(() => {
    isPeriodReminderEnabled().then(setActivated);
  }, []);

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
          onChange={(e) => {
            onDaysBeforeChange(Number(e.target.value));
            setActivated(false);
          }}
        >
          <option value={0}>Le jour J</option>
          <option value={1}>1 jour avant</option>
          <option value={2}>2 jours avant</option>
          <option value={3}>3 jours avant</option>
        </select>
      </label>
      <button
        className="btn btn-primary"
        disabled={activated}
        onClick={async () => {
          setActivated(true);
          setActivated(await onSave());
        }}
      >
        {activated ? "Rappels activés ✅" : "Activer les rappels"}
      </button>
      {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}
    </div>
  );
}

/**
 * Sans ce réglage système accordé (Android 12+), le rappel de règles est programmé
 * en alarme inexacte et peut n'arriver qu'à la réouverture de l'app (voir
 * isExactAlarmGranted dans lib/notifications.ts). N'apparaît que si le réglage
 * manque, et disparaît une fois accordé.
 */
function ExactAlarmCard() {
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    isExactAlarmGranted().then(setGranted);
  }, []);

  if (granted) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Alarmes et rappels</h3>
      <p style={{ marginTop: 0, fontSize: 13 }}>
        Pour que le rappel de règles arrive à l'heure même si Wenn n'est pas ouverte, autorise "Alarmes et rappels"
        dans les réglages système.
      </p>
      <button
        className="btn btn-primary"
        onClick={async () => {
          if (await openExactAlarmSettings()) setGranted(true);
        }}
      >
        Autoriser
      </button>
    </div>
  );
}

type RestoreHandler = (
  backup: ParsedBackup,
  onProgress: (done: number, total: number) => void
) => Promise<RestoreReport>;

function BackupCard({
  cycleDays,
  partnerNotes,
  coupleName,
  canRestore,
  onRestore,
}: {
  cycleDays: CycleDay[];
  partnerNotes: PartnerNote[];
  coupleName: string;
  canRestore: boolean;
  onRestore: RestoreHandler;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    setStatus(null);
    try {
      await exportBackupFile(cycleDays, partnerNotes, coupleName);
    } catch {
      setStatus("Échec de l'export");
    } finally {
      setExporting(false);
    }
  }

  // Le résultat annoncé est celui réellement obtenu : entrées invalides (écartées à
  // la lecture) et écritures refusées sont comptées à part, au lieu d'annoncer
  // « N jour(s) restauré(s) » quoi qu'il arrive.
  async function handleFile(file: File) {
    setRestoring(true);
    setStatus(null);
    try {
      const backup = await parseBackupFile(file);
      const report = await onRestore(backup, (done, total) => setStatus(`Restauration… ${done}/${total}`));
      setStatus(restoreSummary(report));
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
        <button className="btn btn-secondary" onClick={handleExport} disabled={cycleDays.length === 0 || exporting}>
          {exporting ? "Export..." : "Exporter mes données"}
        </button>
        {canRestore && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Vidé tout de suite : sinon choisir à nouveau le même fichier (après
                // une restauration incomplète) ne déclencherait plus rien.
                e.target.value = "";
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
  const [downloading, setDownloading] = useState(false);

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

  async function handleInstall() {
    if (!result?.downloadUrl) return;
    setError(null);

    if (Capacitor.getPlatform() !== "android") {
      await openUpdateDownload(result.downloadUrl);
      return;
    }

    setDownloading(true);
    try {
      await downloadAndInstallUpdate(result.downloadUrl);
    } catch {
      setError("Le téléchargement de la mise à jour a échoué.");
    } finally {
      setDownloading(false);
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
        <>
          {result.releaseNotes && (
            <div
              style={{
                background: "var(--md-sys-color-surface-variant)",
                color: "var(--md-sys-color-on-surface-variant)",
                borderRadius: "var(--radius-m)",
                padding: 12,
                marginBottom: 12,
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4, color: "var(--md-sys-color-on-surface)" }}>
                Nouveautés de la version {result.latestVersion}
              </strong>
              {result.releaseNotes}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleInstall} disabled={downloading}>
            {downloading ? "Téléchargement en cours..." : `Installer la version ${result.latestVersion}`}
          </button>
        </>
      )}
      {result && !result.updateAvailable && result.currentVersion && (
        <p style={{ fontSize: 13, marginTop: 10 }}>Tu as déjà la dernière version ✅</p>
      )}
      {error && <p style={{ fontSize: 13, marginTop: 10, color: "var(--md-sys-color-error)" }}>{error}</p>}
    </div>
  );
}

/** Copie du texte ; faux si le presse-papiers est refusé ou indisponible. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Affiche la dernière fermeture brutale enregistrée côté natif. Sans accès au
 * logcat de l'appareil, c'est le seul moyen de diagnostiquer une app qui « se
 * ferme toute seule » : la carte n'apparaît que s'il y a quelque chose à
 * signaler.
 */
function CrashCard() {
  const [crash, setCrash] = useState<CrashReport | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);

  useEffect(() => {
    getLastCrash().then(setCrash);
  }, []);

  if (!crash) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 className="section-title">Dernière fermeture inattendue</h3>
      <p style={{ marginTop: 0, fontSize: 13 }}>
        L'app s'est fermée seule{crash.when ? ` le ${crash.when}` : ""}. Copie ce
        rapport et envoie-le pour qu'on corrige le problème.
      </p>
      <pre
        style={{
          fontSize: 11,
          maxHeight: 160,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "var(--md-sys-color-surface-variant)",
          color: "var(--md-sys-color-on-surface-variant)",
          padding: 8,
          borderRadius: 8,
        }}
      >
        {crash.trace}
      </pre>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            // Presse-papiers refusé ou indisponible : on le dit au lieu d'afficher
            // « Copié » sans que rien ne soit copié.
            setCopyStatus((await copyToClipboard(crash.trace)) ? "copied" : "failed");
          }}
        >
          {copyStatus === "copied" ? "Copié ✅" : copyStatus === "failed" ? "Copie impossible" : "Copier"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            clearLastCrash();
            setCrash(null);
          }}
        >
          Effacer
        </button>
      </div>
      {copyStatus === "failed" && (
        <p style={{ fontSize: 13, marginTop: 10 }}>
          Garde le doigt appuyé sur le rapport pour le sélectionner et le copier à la main.
        </p>
      )}
    </div>
  );
}

function DuoSettings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { couple, role, otherPartyEmail, leaveCouple, renameCouple } = useCouple();
  const {
    cycleDays,
    partnerNotes,
    averageCycleLength,
    averagePeriodLength,
    canEdit,
    upsertCycleDay,
    addPartnerNote,
    offline,
    pendingSyncCount,
  } = useCycleData();
  const { isDark } = useThemeMode();
  const [uploading, setUploading] = useState(false);
  const [inviteCopyStatus, setInviteCopyStatus] = useState<"copied" | "failed" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [nameInput, setNameInput] = useState(couple?.name ?? "");
  const [renaming, setRenaming] = useState(false);
  const [renameStatus, setRenameStatus] = useState<string | null>(null);
  const [daysBefore, setDaysBefore] = useState(profile?.notifications_days_before ?? 2);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(couple?.name ?? "");
  }, [couple?.name]);

  // Le profil arrive souvent après l'ouverture de Réglages : le délai affiché
  // restait alors sur « 2 jours avant », et « Activer les rappels » l'écrasait.
  const savedDaysBefore = profile?.notifications_days_before;
  useEffect(() => {
    if (savedDaysBefore != null) setDaysBefore(savedDaysBefore);
  }, [savedDaysBefore]);

  async function handleRename() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === couple?.name) return;
    setRenaming(true);
    setRenameStatus(null);
    const { error } = await renameCouple(trimmed);
    setRenaming(false);
    setRenameStatus(error ?? "Nom mis à jour ✅");
  }

  const prediction = useMemo(
    () => computeCyclePrediction(cycleDays, averageCycleLength, averagePeriodLength),
    [cycleDays, averageCycleLength, averagePeriodLength]
  );

  async function handleImagePick(file: File) {
    if (!user) return;
    setUploading(true);
    // finally : une image illisible (applyThemeFromImageUrl lève) laissait sinon le
    // bouton bloqué sur « Chargement... ».
    try {
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
    } catch {
      // image illisible, réseau... : le thème actuel est simplement gardé
    } finally {
      setUploading(false);
    }
  }

  // Mots doux : seuls ceux écrits par ce compte peuvent être recréés (la base
  // n'accepte un mot doux que de son auteur) ; ceux déjà présents sont gardés tels quels.
  const handleRestoreBackup: RestoreHandler = (backup, onProgress) =>
    restoreBackup(backup, {
      upsertCycleDay,
      notes: user ? { existing: partnerNotes, userId: user.id, add: addPartnerNote } : undefined,
      onProgress,
    });

  // Côté titulaire, leave_couple() supprime l'espace EN CASCADE : l'historique Wenn,
  // mais aussi toutes les données Orbit du couple (même projet Supabase, même
  // espace). D'où l'avertissement complet, l'export proposé avant, et la
  // confirmation à taper (un simple "OK" se valide trop facilement par erreur).
  async function confirmOwnerDeletion(): Promise<boolean> {
    if (cycleDays.length > 0 && window.confirm("Exporter une sauvegarde avant de supprimer ?")) {
      try {
        await exportBackupFile(cycleDays, partnerNotes, couple?.name ?? "");
      } catch {
        window.alert("L'export a échoué : la suppression est annulée.");
        return false;
      }
    }
    const typed = window.prompt("Pour confirmer la suppression définitive, tape SUPPRIMER :");
    return typed?.trim().toLowerCase() === "supprimer";
  }

  async function handleLeaveCouple() {
    const warning =
      role === "owner"
        ? "Supprimer cet espace effacera définitivement tout l'historique Wenn (règles, symptômes, notes) ET toutes les données Orbit (événements, tâches, budget, journal), qui utilise le même espace partagé. Le lien avec ton/ta partenaire sera aussi rompu. Continuer ?"
        : "Tu vas te délier de cet espace (tu pourras en rejoindre un autre ou en créer un). Les données de la titulaire ne sont pas affectées. Continuer ?";
    if (!window.confirm(warning)) return;
    if (role === "owner" && !(await confirmOwnerDeletion())) return;
    setLeaving(true);
    const { error } = await leaveCouple();
    setLeaving(false);
    if (error) window.alert(error);
  }

  async function copyInviteCode() {
    if (!couple) return;
    // Copie refusée : le code reste lisible juste à côté, on le dit au lieu de
    // laisser croire qu'il a été copié.
    setInviteCopyStatus((await copyToClipboard(couple.invite_code)) ? "copied" : "failed");
    setTimeout(() => setInviteCopyStatus(null), 2000);
  }

  async function handleSaveNotifications() {
    if (!user) return false;
    const { error, status } = await supabase
      .from("profiles")
      .update({ notifications_days_before: daysBefore })
      .eq("id", user.id);
    if (error) {
      setNotifStatus(
        isNetworkError(error, status)
          ? "Pas de connexion internet : réessaie une fois en ligne."
          : `Impossible d'enregistrer le délai : ${error.message}`
      );
      return false;
    }
    await refreshProfile();

    const { enabled, message } = await enablePeriodReminder(prediction.nextPeriodStart, daysBefore);
    setNotifStatus(message);
    return enabled;
  }

  return (
    <div className="screen">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 2px" }}>Réglages</h1>
        <p style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>{user?.email}</p>
      </header>

      {(offline || !!pendingSyncCount) && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: "var(--md-sys-color-surface-variant)",
            color: "var(--md-sys-color-on-surface-variant)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {offline
            ? "📴 Hors ligne — tu vois la dernière copie enregistrée sur cet appareil."
            : "🔄 Synchronisation en cours..."}
          {!!pendingSyncCount &&
            ` ${pendingSyncCount} modification${pendingSyncCount > 1 ? "s" : ""} en attente d'envoi, elle${
              pendingSyncCount > 1 ? "s seront" : " sera"
            } synchronisée${pendingSyncCount > 1 ? "s" : ""} dès que le réseau revient.`}
        </div>
      )}

      <AppearanceCard imageUrl={profile?.theme_image_url} onPickImage={handleImagePick} uploading={uploading} />

      <ThemeModeCard />

      <UiScaleCard />

      {/* Rappel « Tes règles... » : réservé à la titulaire, sans objet pour le/la partenaire. */}
      {role === "owner" && (
        <>
          <NotificationsCard
            daysBefore={daysBefore}
            onDaysBeforeChange={setDaysBefore}
            onSave={handleSaveNotifications}
            status={notifStatus}
          />

          <ExactAlarmCard />
        </>
      )}

      <BackupCard
        cycleDays={cycleDays}
        partnerNotes={partnerNotes}
        coupleName={couple?.name ?? ""}
        canRestore={canEdit}
        onRestore={handleRestoreBackup}
      />

      <CrashCard />

      <UpdateCard />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title">Couple lié</h3>

        {role === "owner" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <input
              className="input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Nom de l'espace"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleRename}
              disabled={renaming || !nameInput.trim() || nameInput.trim() === couple?.name}
            >
              {renaming ? "..." : "Renommer"}
            </button>
          </div>
        ) : (
          <p style={{ marginTop: 0 }}>{couple?.name}</p>
        )}
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
          {role === "owner" ? "tu es la titulaire" : "tu as un accès partenaire (lecture)"}
          {renameStatus && ` · ${renameStatus}`}
        </p>

        {(role === "partner" || (role === "owner" && couple?.partner_id)) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--md-sys-color-secondary-container)",
              color: "var(--md-sys-color-on-secondary-container)",
              borderRadius: "var(--radius-m)",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            🔗 Connecté·e avec {otherPartyEmail ?? (role === "partner" ? "la titulaire" : "ton/ta partenaire")}
            {" — synchronisation active"}
          </div>
        )}

        {role === "owner" && !couple?.partner_id && (
          <>
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
              Partage ce code pour lier ton/ta partenaire :
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code className="chip" style={{ fontSize: 16, letterSpacing: 2 }}>
                {couple?.invite_code}
              </code>
              <button className="btn btn-text" onClick={copyInviteCode}>
                {inviteCopyStatus === "copied"
                  ? "Copié !"
                  : inviteCopyStatus === "failed"
                    ? "Copie impossible"
                    : "Copier"}
              </button>
            </div>
          </>
        )}
        <button className="btn btn-text" onClick={handleLeaveCouple} disabled={leaving} style={{ marginTop: 12, color: "var(--md-sys-color-error)" }}>
          {leaving ? "..." : role === "owner" ? "Supprimer cet espace / changer de rôle" : "Quitter cet espace / changer de rôle"}
        </button>
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

  // Pas de mots doux en mode solo : ceux d'une sauvegarde duo restent dans le fichier.
  const handleRestoreBackup: RestoreHandler = (backup, onProgress) =>
    restoreBackup(backup, { upsertCycleDay, onProgress });

  async function handleSaveNotifications() {
    updateSettings({ notifications_days_before: daysBefore });
    const { enabled, message } = await enablePeriodReminder(prediction.nextPeriodStart, daysBefore);
    setNotifStatus(message);
    return enabled;
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

      <UiScaleCard />

      <NotificationsCard
        daysBefore={daysBefore}
        onDaysBeforeChange={setDaysBefore}
        onSave={handleSaveNotifications}
        status={notifStatus}
      />

      <ExactAlarmCard />

      <BackupCard
        cycleDays={cycleDays}
        partnerNotes={[]}
        coupleName="Mon cycle"
        canRestore
        onRestore={handleRestoreBackup}
      />

      <CrashCard />

      <UpdateCard />

      <ModeSwitcher label="Passer en mode duo (compte partagé)" />
    </div>
  );
}
