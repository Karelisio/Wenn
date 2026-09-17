import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

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

  App.addListener("appUrlOpen", async ({ url }) => {
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
  });
}
