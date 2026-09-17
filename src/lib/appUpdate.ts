import { App } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
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
  releaseNotes: string | null;
}

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  body?: string;
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
    releaseNotes: null,
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
    releaseNotes: release.body?.trim() || null,
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

/**
 * Télécharge l'APK de mise à jour directement dans l'app (sans navigateur) et
 * lance l'installateur système Android dessus.
 *
 * Le fichier est servi par GitHub via une redirection vers un stockage tiers
 * (objects.githubusercontent.com / Azure Blob) qui ne renvoie aucun header
 * CORS : un `fetch()` classique depuis la WebView est donc bloqué par le
 * navigateur ("Failed to fetch"), même si la requête réseau aboutit bien.
 * `CapacitorHttp` fait la requête côté natif (hors WebView), ce qui
 * contourne cette restriction.
 */
export async function downloadAndInstallUpdate(url: string): Promise<void> {
  const response = await CapacitorHttp.request({
    method: "GET",
    url,
    responseType: "arraybuffer",
    connectTimeout: 30000,
    readTimeout: 60000,
  });

  if (response.status < 200 || response.status >= 300 || !response.data) {
    throw new Error("Téléchargement impossible");
  }

  await Filesystem.writeFile({ path: UPDATE_APK_FILENAME, directory: Directory.Cache, data: response.data });
  const { uri } = await Filesystem.getUri({ path: UPDATE_APK_FILENAME, directory: Directory.Cache });

  await ApkInstaller.install({ path: uri.replace("file://", "") });
}
