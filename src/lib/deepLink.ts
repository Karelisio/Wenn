import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isNetworkError, supabase } from "./supabase";

/**
 * Domaine des App Links (voir android/.../AndroidManifest.xml et
 * public/.well-known/assetlinks.json) : un lien magique qui y mène s'ouvre
 * directement dans l'app. Adresse de retour des liens demandés depuis l'app.
 */
export const APP_LINK_ORIGIN = "https://wenn-five.vercel.app";

const LAST_HANDLED_URL_KEY = "wenn:lastDeepLink";
const PENDING_LOGIN_KEY = "wenn:pendingLogin";
/** Un lien « token_hash » n'est accepté que dans l'heure qui suit une demande faite sur ce téléphone. */
const PENDING_LOGIN_MAX_AGE_MS = 60 * 60 * 1000;
/** Types de lien e-mail qui ouvrent une session (verifyOtp). */
const LOGIN_OTP_TYPES: readonly EmailOtpType[] = ["magiclink", "email", "signup"];

const LOGIN_LINK_ERROR =
  "Ce lien ne fonctionne que sur le téléphone qui l'a demandé, et seulement le plus récent (ou il a expiré). Redemande un lien depuis ce téléphone.";
const LOGIN_LINK_OFFLINE = "Pas de connexion internet : reconnecte-toi au réseau, puis redemande un lien de connexion.";

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

/**
 * Note qu'un lien magique vient d'être demandé depuis ce téléphone (appelé par
 * AuthContext). Un lien « token_hash » n'est accepté qu'avec cette trace récente :
 * sinon, n'importe qui pourrait envoyer un lien de SON compte et y connecter
 * l'app de l'utilisatrice à son insu (ses saisies partiraient alors chez lui).
 */
export function markLoginLinkRequested(): void {
  try {
    localStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    // stockage indisponible : seul un lien « code » (PKCE) pourra connecter
  }
}

function hasRecentLoginRequest(): boolean {
  try {
    const raw = localStorage.getItem(PENDING_LOGIN_KEY);
    const at: unknown = raw ? (JSON.parse(raw) as { at?: unknown }).at : null;
    if (typeof at !== "number") return false;
    const age = Date.now() - at;
    return age >= 0 && age < PENDING_LOGIN_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function clearLoginRequest(): void {
  try {
    localStorage.removeItem(PENDING_LOGIN_KEY);
  } catch {
    // rien à effacer
  }
}

// Échec du dernier lien de connexion reçu, affiché sur l'écran de connexion (via
// AuthContext). Gardé ici : le lien peut être traité avant le montage de React.
type LoginLinkErrorListener = (message: string | null) => void;
let loginLinkError: string | null = null;
const loginLinkErrorListeners = new Set<LoginLinkErrorListener>();

function setLoginLinkError(message: string | null): void {
  loginLinkError = message;
  loginLinkErrorListeners.forEach((listener) => listener(message));
}

export function subscribeLoginLinkError(listener: LoginLinkErrorListener): () => void {
  loginLinkErrorListeners.add(listener);
  listener(loginLinkError);
  return () => {
    loginLinkErrorListeners.delete(listener);
  };
}

export function clearLoginLinkError(): void {
  setLoginLinkError(null);
}

/** Paramètres de la requête, complétés par ceux du fragment (#...) où arrivent erreurs et anciens liens. */
function authParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "";
  new URLSearchParams(fragment).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

function hasFailureParams(params: URLSearchParams): boolean {
  return params.has("error") || params.has("error_code") || params.has("error_description");
}

async function handleUrl(url: string): Promise<void> {
  if (!isNewUrl(url)) return;
  let params: URLSearchParams;
  try {
    params = authParams(url);
  } catch {
    return; // URL malformée : on ignore
  }

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  // Anciens liens (flux implicite) : jetons de session en clair dans l'URL. Plus
  // jamais acceptés — n'importe quel lien pouvait sinon imposer une session choisie
  // par un tiers. Ils ne servent plus qu'à afficher « redemande un lien ».
  const legacyTokens = params.has("access_token") || params.has("refresh_token");
  if (!code && !tokenHash && !legacyTokens && !hasFailureParams(params)) return; // sans rapport avec la connexion

  try {
    // Déjà connecté·e : rien à faire (par exemple l'URL de lancement relue après un
    // redémarrage de l'app, alors que le lien a déjà servi).
    const { data } = await supabase.auth.getSession();
    if (data.session) return;

    if (code) {
      // PKCE : le code ne s'échange qu'avec le secret gardé sur le téléphone qui a
      // demandé le lien (voir signInWithMagicLink) — un lien ouvert ailleurs échoue.
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setLoginLinkError(isNetworkError(error, error.status) ? LOGIN_LINK_OFFLINE : LOGIN_LINK_ERROR);
        return;
      }
    } else if (
      tokenHash &&
      type &&
      LOGIN_OTP_TYPES.includes(type as EmailOtpType) &&
      hasRecentLoginRequest()
    ) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (error) {
        setLoginLinkError(isNetworkError(error, error.status) ? LOGIN_LINK_OFFLINE : LOGIN_LINK_ERROR);
        return;
      }
    } else {
      setLoginLinkError(LOGIN_LINK_ERROR);
      return;
    }
    clearLoginRequest();
    setLoginLinkError(null);
  } catch {
    setLoginLinkError(LOGIN_LINK_ERROR);
  }
}

/**
 * Web : Supabase échange lui-même le ?code= d'un lien magique au chargement
 * (detectSessionInUrl). Si aucune session n'en sort, le lien a été demandé sur un
 * autre appareil (ou a expiré) : on l'explique au lieu d'afficher l'écran de
 * connexion sans un mot. À appeler une fois la session initiale connue.
 */
export function reportUnusedWebLoginLink(hasSession: boolean): void {
  if (Capacitor.isNativePlatform() || hasSession) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code") && !hasFailureParams(authParams(url.href))) return;
    setLoginLinkError(LOGIN_LINK_ERROR);
    // Adresse nettoyée : un rechargement de la page ne réaffiche pas l'erreur.
    window.history.replaceState(window.history.state, "", `${url.origin}${url.pathname}`);
  } catch {
    // adresse illisible : rien à signaler
  }
}

/**
 * Gère les liens ouverts depuis l'extérieur de l'app (App Links Android /
 * Universal Links iOS), en particulier le lien magique de connexion.
 *
 * Le domaine web (Vercel) est déclaré comme "vérifié" pour l'app native
 * (voir android/.../AndroidManifest.xml + public/.well-known/assetlinks.json),
 * donc Android ouvre directement l'app au lieu du navigateur. On échange alors
 * le code reçu dans l'URL contre une session et on termine la connexion sans
 * jamais faire naviguer la WebView hors de l'app.
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
