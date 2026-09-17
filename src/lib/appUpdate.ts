import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const REPO = "Karelisio/Wenn";

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
 * Ouvre le téléchargement de l'APK dans le navigateur système : Android
 * prend le relais (téléchargement + proposition d'installation), sans
 * permission particulière à demander côté app.
 */
export async function openUpdateDownload(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
