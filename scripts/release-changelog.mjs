// Notes de version et archivage de CHANGELOG.md pour la CI (build-android.yml).
//
//   node scripts/release-changelog.mjs notes <sortie> [<CHANGELOG de origin/main>]
//     Écrit dans <sortie> les puces de « ## Non publié » de CHANGELOG.md (texte de
//     la Release GitHub, affiché dans l'app : Réglages → Mises à jour). Avec le
//     CHANGELOG le plus récent de main, ne garde que les puces qui y sont encore
//     en attente : celles déjà publiées par un run précédent ne sont pas répétées.
//     Section vide : « - Corrections et améliorations internes. »
//
//   node scripts/release-changelog.mjs archive <tag> <date> <notes>
//     Réécrit CHANGELOG.md : retire de « ## Non publié » les puces publiées (celles
//     du fichier <notes>) et les range sous « ## <tag> — <date> » juste en dessous.
//     Des puces arrivées entre-temps sur main restent dans « ## Non publié ».
//
// Sans dépendance (Node seul). Testé par scripts/smoke-test.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MARKER = "## Non publié";
export const DEFAULT_NOTE = "- Corrections et améliorations internes.";

/** Découpe « ## Non publié » : texte avant, puces de la section, reste (titre suivant compris). */
export function splitChangelog(content) {
  const start = content.indexOf(MARKER);
  if (start === -1) return null;
  const bodyStart = start + MARKER.length;
  const next = content.slice(bodyStart).search(/\n## /);
  const bodyEnd = next === -1 ? content.length : bodyStart + next + 1;
  return {
    before: content.slice(0, start),
    bullets: parseBullets(content.slice(bodyStart, bodyEnd)),
    rest: content.slice(bodyEnd),
  };
}

/** Puces d'une section : une ligne « - » ou « * » ouvre une puce, les lignes suivantes la continuent. */
export function parseBullets(body) {
  const bullets = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    if (/^[-*] /.test(line) || bullets.length === 0) bullets.push([line]);
    else bullets[bullets.length - 1].push(line);
  }
  return bullets.map((lines) => lines.join("\n"));
}

/** Même puce, quel que soit le retour à la ligne. */
function bulletKey(bullet) {
  return bullet.replace(/\s+/g, " ").trim();
}

export function releaseNotes(content, latestMainContent) {
  const section = splitChangelog(content);
  let bullets = section ? section.bullets : [];
  const latest = latestMainContent != null ? splitChangelog(latestMainContent) : null;
  if (latest) {
    const pending = new Set(latest.bullets.map(bulletKey));
    bullets = bullets.filter((b) => pending.has(bulletKey(b)));
  }
  return bullets.length ? bullets.join("\n") : DEFAULT_NOTE;
}

export function archiveChangelog(content, tag, date, notes) {
  const section = splitChangelog(content);
  if (!section) throw new Error(`Section « ${MARKER} » introuvable dans CHANGELOG.md`);
  const released = parseBullets(notes);
  const remaining = [...section.bullets];
  for (const bullet of released) {
    const i = remaining.findIndex((b) => bulletKey(b) === bulletKey(bullet));
    if (i !== -1) remaining.splice(i, 1);
  }
  const pendingBlock = remaining.length ? `${remaining.join("\n")}\n\n` : "";
  const releasedBlock = released.length ? released.join("\n") : DEFAULT_NOTE;
  const rest = section.rest ? `\n${section.rest}` : "";
  return `${section.before}${MARKER}\n\n${pendingBlock}## ${tag} — ${date}\n\n${releasedBlock}\n${rest}`;
}

function main([command, ...args]) {
  if (command === "notes" && args.length >= 1) {
    const [output, latestMainPath] = args;
    const latest = latestMainPath ? readFileSync(latestMainPath, "utf8") : undefined;
    writeFileSync(output, `${releaseNotes(readFileSync("CHANGELOG.md", "utf8"), latest)}\n`);
  } else if (command === "archive" && args.length === 3) {
    const [tag, date, notesPath] = args;
    const updated = archiveChangelog(readFileSync("CHANGELOG.md", "utf8"), tag, date, readFileSync(notesPath, "utf8"));
    writeFileSync("CHANGELOG.md", updated);
  } else {
    console.error("Usage : release-changelog.mjs notes <sortie> [<CHANGELOG main>] | archive <tag> <date> <notes>");
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
