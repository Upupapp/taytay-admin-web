#!/usr/bin/env node
/**
 * check:app-settings — a change to the residents' app's settings is reviewed, and a change that can
 * stop residents using the app is acknowledged, before it is sent (`DL-170`).
 *
 * A newer oldest version can force every resident to update; a new terms or privacy version can make
 * every resident accept again. One stray digit reaches the whole municipality. So:
 *
 *   1. The page's title block says "Residents see this in the Taytay app".
 *   2. The repository's `change` is called once, in `confirm`, which refuses unless the review is open
 *      and — where `needsAcknowledgement()` — the acknowledgement is ticked; `review` sends nothing.
 *   3. The confirmation lists the effects before its button, offers the acknowledgement box when it is
 *      needed, and the button is disabled until it is ticked.
 *   4. The effects say a newer version can force every resident to update, a new terms or privacy
 *      version can make every resident accept again, the notice's text is not changed here, and the
 *      server keeps no record of which setting changed; `asksEveryResident` covers the three.
 *   5. The flags are said not to be secret, and the mapper never reads the privacy notice's text.
 *   6. No `console`, web storage or cookie in the module.
 *   7. `app-config.manage` is in `PERMISSIONS`, named by no role, not read-only, and asked for by the
 *      route and the menu entry.
 *
 * Each rule was validated against a planted regression before being trusted.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const read = (...segments) => readFileSync(join(...segments), 'utf8');
const shown = (file) => relative(ROOT, file).split(sep).join('/');

const failures = [];

const FEATURE = join(APP, 'features', 'app-settings');
const PAGE = join(FEATURE, 'app-settings-page.ts');
const TEMPLATE = join(FEATURE, 'app-settings-page.html');
const COPY = join(FEATURE, 'app-settings.copy.ts');
const DOMAIN = join(APP, 'domain', 'app-config', 'app-config.ts');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'app-config.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-app-config.repository.ts');

for (const file of [PAGE, TEMPLATE, COPY, DOMAIN, MAPPER, MOCK]) {
  if (!existsSync(file)) failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
}
if (failures.length > 0) report();

/** Comments explain these rules and must not trip them. */
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

function block(text, start) {
  if (start === -1) return '';
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return '';
}

function methodBody(text, name) {
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?(?:async )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const page = code(readFileSync(PAGE, 'utf8'));
const template = code(readFileSync(TEMPLATE, 'utf8'));
const domain = code(readFileSync(DOMAIN, 'utf8'));
const moduleFiles = [...walk(FEATURE), DOMAIN, MAPPER, MOCK];

/* ── 1. residents see it ─────────────────────────────────────────────────── */

if (!/subtitle:\s*\n?\s*'Residents see this in the Taytay app/.test(readFileSync(COPY, 'utf8'))) {
  failures.push('The app settings page no longer opens by saying residents see it in the Taytay app.');
}
if (!/\[subtitle\]="copy\.subtitle"/.test(template)) {
  failures.push('The app settings page header no longer shows the sentence saying residents see it.');
}

/* ── 2. sent only from the confirmation, and only when acknowledged ──────── */

const changeCall = /this\s*\.\s*repository\s*\.\s*change\s*\(/g;
const confirm = methodBody(page, 'confirm');
if ([...page.matchAll(changeCall)].length !== 1 || !new RegExp(changeCall.source).test(confirm)) {
  failures.push('The settings are sent from somewhere other than confirm, after the review.');
}
if (
  !/!\s*this\s*\.\s*reviewing\s*\(\s*\)/.test(confirm) ||
  !/this\s*\.\s*needsAcknowledgement\s*\(\s*\)\s*&&\s*!\s*this\s*\.\s*acknowledged\s*\(\s*\)/.test(confirm)
) {
  failures.push('confirm no longer refuses outside the review, or without the acknowledgement it needs.');
}
if (new RegExp(changeCall.source).test(methodBody(page, 'review'))) {
  failures.push('review sends the change. It only opens the confirmation.');
}

/* ── 3. the confirmation ─────────────────────────────────────────────────── */

const modal = template.indexOf('<app-modal');
const effects = template.indexOf('@for (effect of effects()', modal);
const acknowledge = template.indexOf('@if (needsAcknowledgement())', modal);
const button = template.indexOf('(click)="confirm()"', modal);
const buttonTag = template.slice(template.lastIndexOf('<button', button), button);
if (modal === -1 || effects === -1 || acknowledge === -1 || button === -1 || !(effects < button && acknowledge < button)) {
  failures.push('The confirmation no longer lists the effects and the acknowledgement before its button.');
}
if (!/\[disabled\]="[^"]*needsAcknowledgement\s*\(\s*\)\s*&&\s*!\s*acknowledged\s*\(\s*\)/.test(buttonTag)) {
  failures.push("The confirmation's button is no longer disabled until the acknowledgement is ticked.");
}
if ([...template.matchAll(/\(click\)="confirm\(\)"/g)].length !== 1) {
  failures.push('Something besides the confirmation saves the settings.');
}

/* ── 4. what a change does ───────────────────────────────────────────────── */

const effectsText = domain.slice(domain.indexOf('export const APP_CONFIG_EFFECTS'));
for (const [pattern, said] of [
  [/can force every resident[\s\S]{0,80}update/, 'a newer version can force every resident to update'],
  [/can make every resident accept the terms again/, 'a new terms version can make every resident accept again'],
  [/can make every resident accept the privacy notice again/, 'a new privacy version can make every resident accept again'],
  [/text does not change here/, "the notice's text is not changed here"],
  [/not which setting/, 'the server keeps no record of which setting changed'],
]) {
  if (!pattern.test(effectsText)) failures.push(`APP_CONFIG_EFFECTS no longer says ${said}.`);
}
const asks = block(domain, domain.indexOf('export function asksEveryResident'));
for (const field of ['minimumAppVersion', 'termsVersion', 'privacyVersion']) {
  if (!asks.includes(field)) failures.push(`asksEveryResident no longer covers ${field}.`);
}

/* ── 5. not secret, and not the notice's text ────────────────────────────── */

if (!/Not secret/.test(readFileSync(COPY, 'utf8')) || !/\{\{\s*copy\s*\.\s*flagsLead\s*\}\}/.test(template)) {
  failures.push('The flags are no longer said not to be secret.');
}
if (/body_markdown/.test(code(readFileSync(MAPPER, 'utf8')))) {
  failures.push("The settings mapper reads the privacy notice's text, which this screen neither shows nor changes.");
}

/* ── 6. no log, no storage ───────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing about the settings is logged or stored.`);
}

/* ── 7. the server's key ─────────────────────────────────────────────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
// Everything after the vocabulary: the role definitions and the shared lists they spread.
const roles = permission.slice(permission.indexOf('] as const;'));
if (!vocabulary.includes("'app-config.manage'")) failures.push("PERMISSIONS does not hold 'app-config.manage', the API's own key.");
if (roles.includes("'app-config.manage'")) failures.push("A role lists 'app-config.manage' by name. The API grants it to administrators alone.");
if (code(read(APP, 'domain', 'access', 'permission-matrix.ts')).includes('app-config.manage')) {
  failures.push("'app-config.manage' is classified read-only. It changes what every resident's app does.");
}
if (
  !/path:\s*'app-settings',[\s\S]{0,300}?canActivate:\s*\[servedGuard\('app-config'\),\s*permissionGuard\('app-config\.manage'\)\]/.test(
    read(APP, 'app.routes.ts'),
  )
) {
  failures.push("The /app-settings route does not ask for servedGuard('app-config') and permissionGuard('app-config.manage').");
}
if (!/route:\s*'\/app-settings',[\s\S]{0,120}permissions:\s*\['app-config\.manage'\]/.test(read(APP, 'core', 'navigation', 'navigation.ts'))) {
  failures.push("The menu's App settings entry does not ask for 'app-config.manage'.");
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nApp settings check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `App settings check passed (${moduleFiles.length} files: residents told, sent only after the review, ` +
      'acknowledged where it can stop residents, effects before the button, flags not secret, the key ' +
      'the administrator’s).',
  );
}
