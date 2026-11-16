#!/usr/bin/env node
/**
 * check:archive — nothing an office user does in this console deletes a record (`DL-225`).
 *
 * What the municipality offered its residents, and when, is a public record (RA 9470 §18, as the
 * backend's ADR 0002 reads it). The backend refuses a delete in the database; this console holds the
 * same line in its own source, so a screen cannot grow a Delete button that would only ever fail —
 * or, worse, one that a future API would honour.
 *
 *   1. No repository port (`interface …Repository` under `domain/`) declares a method named
 *      delete, remove, destroy, purge or erase. Archive and restore are the acts.
 *   2. No adapter sends a DELETE: no `api.delete(` call and no `@consumes DELETE` tag, except the
 *      one the API keeps for something that is not a record — taking a Balita article's pin away
 *      (`DELETE news/{id}/pin`), which deletes nothing.
 *   3. No screen says "Delete": no button, label or copy in `features/`, `shared/`, `core/` or
 *      `layout/` carries the word, and the archive modules' words keep none of the old
 *      regret-phrases ("Nothing brings it back", "hide it instead", "delete it", "was deleted").
 *   4. An archive or a restore states what it does before its button:
 *      - the shared `ArchiveDialog` lists the effects before its confirming button, which is the
 *        primary act (`.btn--primary`, never `.btn--danger`: it is undone by a restore), and
 *        emits only from `confirm()`, which refuses a reason the server would refuse;
 *      - every `<app-archive-dialog>` is handed its `[effects]` and a `[confirmLabel]`;
 *      - the directory and home-screen sections call a repository's `archive…`/`restore…` only
 *        inside `confirmMove`, which their template reaches only from an archive dialog's
 *        `(confirmed)` (an event's archive is older, one-way and held by `check:events`, DL-131);
 *      - the two acts with no dialog say so elsewhere: a feature flag is archived and restored
 *        through App settings' review, whose effects are `appConfigEffects` handed the archived
 *        flags; a saved view — a filter, reversible, no reason kept — is archived from its bar
 *        without a confirmation, and in exchange the bar announces the outcome and how to restore.
 *
 * The exceptions that keep a resident's own data deletable (closing their account, erasing a
 * selfie) live in the residents' app and the API, not in this console, and so are not listed here.
 *
 * Each rule was validated against a planted regression before being trusted.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const shown = (file) => relative(ROOT, file).split(sep).join('/');
const read = (file) => readFileSync(file, 'utf8');
const failures = [];

/** Comments explain these rules and must not trip them. */
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

/** The text between the brace that opens at or after `from` and the one that closes it. */
function block(text, from) {
  const open = text.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === '{') depth += 1;
    if (text[at] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, at);
    }
  }
  return text.slice(open + 1);
}

function methodBody(text, name) {
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const DOMAIN = join(APP, 'domain');
const ADAPTERS = join(APP, 'data', 'http');
const MAPPERS = join(ADAPTERS, 'mappers');
const SCREENS = ['features', 'shared', 'core', 'layout'].map((dir) => join(APP, dir));
const DIALOG = join(APP, 'shared', 'archive', 'archive-dialog.ts');
const BAR = join(APP, 'shared', 'ui', 'saved-views', 'saved-views-bar.ts');
const SETTINGS = join(APP, 'features', 'app-settings', 'app-settings-page.ts');
const APP_CONFIG = join(DOMAIN, 'app-config', 'app-config.ts');

for (const file of [DOMAIN, ADAPTERS, MAPPERS, DIALOG, BAR, SETTINGS, APP_CONFIG]) {
  if (!existsSync(file))
    failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
}
if (failures.length > 0) report();

/* ── 1. no port deletes ──────────────────────────────────────────────────── */

const FORBIDDEN_VERB = /^(?:delete|remove|destroy|purge|erase)/i;
let ports = 0;
for (const file of walk(DOMAIN).filter((path) => path.endsWith('.ts'))) {
  const text = code(read(file));
  for (const port of text.matchAll(/export interface (\w+Repository)\b[^{]*/g)) {
    ports += 1;
    const body = block(text, port.index + port[0].length);
    for (const method of body.matchAll(
      /^\s*(?:readonly\s+)?([A-Za-z_]\w*)\s*(?:<[^>\n]*>)?\s*\(/gm,
    )) {
      if (FORBIDDEN_VERB.test(method[1])) {
        failures.push(
          `${shown(file)}: ${port[1]}.${method[1]} deletes. A record is archived and restored, never ` +
            'deleted (DL-225).',
        );
      }
    }
  }
}
if (ports < 30) {
  failures.push(
    `Only ${ports} repository ports were read under domain/, so the ports were not checked.`,
  );
}

/* ── 2. no DELETE sent, but the Balita unpin ─────────────────────────────── */

const UNPIN = /^\s*`\$\{API_ENDPOINTS\s*\.\s*news\}\/\$\{id\}\/pin`\s*\)/;
let unpins = 0;
for (const file of walk(ADAPTERS).filter((path) => path.endsWith('.ts'))) {
  const text = code(read(file));
  for (const call of text.matchAll(/\bapi\s*\.\s*delete\s*(?:<[^>]*>)?\s*\(/g)) {
    if (UNPIN.test(text.slice(call.index + call[0].length))) {
      unpins += 1;
    } else {
      failures.push(
        `${shown(file)} sends a DELETE. Nothing an office user does deletes a record: archive it ` +
          '(DL-225).',
      );
    }
  }
}
if (unpins > 1) {
  failures.push(`The Balita unpin is sent from ${unpins} places; it is the one DELETE allowed.`);
}
for (const file of walk(MAPPERS).filter((path) => path.endsWith('.ts'))) {
  for (const tag of read(file).matchAll(/@consumes DELETE (\S+)/g)) {
    if (tag[1] !== 'news/{id}/pin') {
      failures.push(
        `${shown(file)} consumes DELETE ${tag[1]}. The console deletes no record (DL-225).`,
      );
    }
  }
}

/* ── 3. no screen says Delete ────────────────────────────────────────────── */

const ARCHIVE_MODULES = [
  join(APP, 'features', 'directory'),
  join(APP, 'features', 'home-screen'),
  join(APP, 'features', 'app-settings'),
  join(APP, 'shared', 'archive'),
  join(APP, 'shared', 'ui', 'saved-views'),
  join(DOMAIN, 'directory'),
  join(DOMAIN, 'home'),
  join(DOMAIN, 'app-config'),
  join(DOMAIN, 'views'),
];
const REGRET =
  /Nothing brings it back|hide it instead|make it inactive instead|\bdelete it\b|\bwas deleted\b|deleting is the only way|deleted flag/i;
for (const dir of SCREENS) {
  for (const file of walk(dir)) {
    const text = code(read(file));
    if (/\bDelete\b/.test(text)) {
      failures.push(
        `${shown(file)} says "Delete". Nothing here is deleted: the act is Archive, undone by Restore ` +
          '(DL-225).',
      );
    }
  }
}
for (const dir of ARCHIVE_MODULES) {
  for (const file of walk(dir)) {
    const found = REGRET.exec(code(read(file)));
    if (found !== null) {
      failures.push(
        `${shown(file)} still says "${found[0]}". An archived record can be restored (DL-225).`,
      );
    }
  }
}

/* ── 4. what an archive or a restore does, before its button ─────────────── */

{
  const dialog = code(read(DIALOG));
  const effects = dialog.indexOf('@for (line of effects()');
  const confirm = dialog.indexOf('(click)="confirm()"');
  const button = dialog.lastIndexOf('<button', confirm);
  const confirmTag = button === -1 ? '' : dialog.slice(button, confirm);
  if (effects === -1 || confirm === -1 || effects > button) {
    failures.push('ArchiveDialog no longer lists what the act does before its confirming button.');
  }
  if (!/class="btn btn--primary"/.test(confirmTag) || /btn--danger/.test(dialog)) {
    failures.push(
      'ArchiveDialog no longer confirms with the primary button. Archiving is reversible, so it is ' +
        'never drawn as destructive (.btn--danger).',
    );
  }
  const emit = methodBody(dialog, 'confirm');
  if (
    [...dialog.matchAll(/this\s*\.\s*confirmed\s*\.\s*emit\s*\(/g)].length !== 1 ||
    !/this\s*\.\s*confirmed\s*\.\s*emit\s*\(/.test(emit) ||
    !/reasonProblem\s*\(\s*\)\s*!==\s*null/.test(emit)
  ) {
    failures.push(
      'ArchiveDialog emits somewhere other than confirm(), or without refusing an empty reason.',
    );
  }
}

/** `archive(`, `restoreBanner(` — an act; `archivedFlags(` is a read. */
const ACT = /this\s*\.\s*repository\s*\.\s*(?:archive|restore)(?:[A-Z]\w*)?\s*\(/g;
const ARCHIVE_SCREENS = ['directory', 'home-screen'].map((dir) => join(APP, 'features', dir));
for (const file of ARCHIVE_SCREENS.flatMap(walk).filter((path) => path.endsWith('.ts'))) {
  const text = code(read(file));
  const calls = [...text.matchAll(ACT)].length;
  const template = file.replace(/\.ts$/, '.html');
  const html = existsSync(template) ? code(read(template)) : '';
  for (const dialog of html.matchAll(/<app-archive-dialog\b([\s\S]*?)\/>/g)) {
    if (!/\[effects\]="[^"]+"/.test(dialog[1]) || !/\[confirmLabel\]="[^"]+"/.test(dialog[1])) {
      failures.push(
        `${shown(template)}: an archive dialog is not handed its effects and its button's words.`,
      );
    }
  }
  if (calls === 0) continue;
  const move = methodBody(text, 'confirmMove');
  if ([...move.matchAll(ACT)].length !== calls) {
    failures.push(
      `${shown(file)} archives or restores somewhere other than confirmMove, after the confirmation.`,
    );
  }
  const dialogs = [...html.matchAll(/<app-archive-dialog\b([\s\S]*?)\/>/g)];
  if (
    dialogs.length !== 1 ||
    !/\(confirmed\)="confirmMove\(\$event\)"/.test(dialogs[0][1]) ||
    [...html.matchAll(/confirmMove\(/g)].length !== 1
  ) {
    failures.push(
      `${shown(template)}: confirmMove is reached from somewhere other than its archive dialog.`,
    );
  }
}

{
  const settings = code(read(SETTINGS));
  if (
    !/appConfigEffects\(\s*config\s*,\s*this\s*\.\s*changes\(\)\s*,\s*this\s*\.\s*archived\(\)\s*\)/.test(
      settings,
    )
  ) {
    failures.push(
      'App settings no longer hands the archived flags to appConfigEffects, so its review cannot say ' +
        'which flags a change archives or restores.',
    );
  }
  const effects = code(read(APP_CONFIG));
  if (!/flagsArchived\s*:/.test(effects) || !/flagsRestored\s*:/.test(effects)) {
    failures.push('APP_CONFIG_EFFECTS no longer says what archiving and restoring a flag do.');
  }
}

{
  const bar = code(read(BAR));
  const archive = methodBody(bar, 'archive');
  if (
    !/this\s*\.\s*notifications\s*\.\s*success\s*\([^;]*archivedBody/.test(archive) ||
    !/restored/.test(read(join(APP, 'shared', 'ui', 'saved-views', 'saved-views.copy.ts')))
  ) {
    failures.push(
      'The saved-views bar archives with no confirmation, so it must announce the outcome and how to ' +
        'restore; it no longer does.',
    );
  }
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nArchive check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Archive check passed (${ports} ports, none deleting; no DELETE sent but the Balita unpin; no ` +
      'screen says Delete; every archive and restore says what it does before its button, or through ' +
      'the settings review, or announces how to restore — DL-225).',
  );
}
