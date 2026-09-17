import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

const REPO = "Karelisio/Wenn";

interface ApkInstallerPlugin {
  install(options: { path: string }): Promise<void>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  downloadUrl: string | null;
  releaseUrl: string | null;
}

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  assets: GithubReleaseAsset[];
}

/**
 * Compare la version installée (versionName Android, tamponné par la CI à
 * partir du tag git) à la dernière Release GitHub publiée.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const empty: UpdateCheckResult = {
    updateAvailable: false,
    currentVersion: null,
    latestVersion: null,
    downloadUrl: null,
    releaseUrl: null,
  };

  if (!Capacitor.isNativePlatform()) return empty;

  const info = await App.getInfo();

  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error("Impossible de vérifier les mises à jour");

  const release = (await response.json()) as GithubRelease;
  const latestVersion = (release.tag_name ?? "").replace(/^v/, "");
  const apkAsset = (release.assets ?? []).find((a) => a.name.endsWith(".apk"));

  return {
    updateAvailable: Boolean(latestVersion) && latestVersion !== info.version,
    currentVersion: info.version,
    latestVersion: latestVersion || null,
    downloadUrl: apkAsset?.browser_download_url ?? null,
    releaseUrl: release.html_url ?? null,
  };
}

/**
 * Ouvre le téléchargement de l'APK dans le navigateur système (utilisé en
 * repli si le téléchargement in-app n'est pas disponible, ex. iOS).
 */
export async function openUpdateDownload(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

const UPDATE_APK_FILENAME = "wenn-update.apk";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.substring(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Télécharge l'APK de mise à jour directement dans l'app (sans navigateur) et
 * lance l'installateur système Android dessus. `onProgress` reçoit un
 * pourcentage (ou `null` si la taille du fichier est inconnue).
 */
export async function downloadAndInstallUpdate(
  url: string,
  onProgress?: (percent: number | null) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error("Téléchargement impossible");

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(total ? Math.round((received / total) * 100) : null);
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: "application/vnd.android.package-archive" });
  const base64 = await blobToBase64(blob);

  await Filesystem.writeFile({ path: UPDATE_APK_FILENAME, directory: Directory.Cache, data: base64 });
  const { uri } = await Filesystem.getUri({ path: UPDATE_APK_FILENAME, directory: Directory.Cache });

  await ApkInstaller.install({ path: uri.replace("file://", "") });
}
