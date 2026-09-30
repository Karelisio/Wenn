import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

const LAST_HANDLED_URL_KEY = "wenn:lastDeepLink";
let lastHandledUrl: string | null = null;

/**
 * Vrai la première fois qu'une URL est vue. La même peut arriver par les deux
 * chemins d'initDeepLinks, ou revenir via getLaunchUrl() après un rechargement
 * de la page (sessionStorage survit au rechargement) : un lien de connexion ne
 * doit être consommé qu'une fois.
 */
function isNewUrl(url: string): boolean {
  let previous = lastHandledUrl;
  try {
    previous = sessionStorage.getItem(LAST_HANDLED_URL_KEY) ?? previous;
    sessionStorage.setItem(LAST_HANDLED_URL_KEY, url);
  } catch {
    // stockage indisponible : le dédoublonnage en mémoire suffit
  }
  lastHandledUrl = url;
  return previous !== url;
}

async function handleUrl(url: string): Promise<void> {
  if (!isNewUrl(url)) return;
  try {
    const parsed = new URL(url);
    const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "";
    const params = new URLSearchParams(fragment || parsed.search);

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
      return;
    }

    const token_hash = params.get("token_hash");
    const type = params.get("type");
    if (token_hash && type === "magiclink") {
      await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
    }
  } catch {
    // URL non liée à l'authentification (ou malformée) : on ignore
  }
}

/**
 * Gère les liens ouverts depuis l'extérieur de l'app (App Links Android /
 * Universal Links iOS), en particulier le lien magique de connexion.
 *
 * Le domaine web (Vercel) est déclaré comme "vérifié" pour l'app native
 * (voir android/.../AndroidManifest.xml + public/.well-known/assetlinks.json),
 * donc Android ouvre directement l'app au lieu du navigateur. On récupère
 * alors le token de session dans l'URL reçue et on termine la connexion
 * sans jamais faire naviguer la WebView hors de l'app.
 */
export function initDeepLinks(): void {
  if (!Capacitor.isNativePlatform()) return;

  // Deux chemins, et il faut les deux : le plugin App de Capacitor n'émet
  // "appUrlOpen" que depuis onNewIntent, c'est-à-dire uniquement quand l'app
  // tournait DÉJÀ. Sur un démarrage à froid (app fermée au moment de toucher
  // le lien reçu par e-mail), l'URL n'est lisible que via getLaunchUrl() —
  // sans ça le lien magique était simplement perdu.
  App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url);
  });

  void App.getLaunchUrl()
    .then((result) => {
      if (result?.url) void handleUrl(result.url);
    })
    .catch(() => {
      // pas d'URL de lancement : démarrage normal
    });
}
