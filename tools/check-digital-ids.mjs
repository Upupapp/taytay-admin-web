#!/usr/bin/env node
/**
 * check:digital-ids — checking a resident's card is a lookup kept as small as the API makes it, and
 * every act on a card says what it does to the resident's card in the app before it is done
 * (`DL-171`).
 *
 *   1. The page says residents carry the card in the Taytay app, and that no camera is needed.
 *   2. No camera, no storage, no log: nothing in the module asks for the camera or a barcode
 *      detector, and nothing touches web storage, cookies or the console.
 *   3. The code is sent from `check()` alone, and the field is emptied before it is sent.
 *   4. The photo is fetched from `CardPhoto.open()` alone, whose button is inside the warning, after
 *      the warning's words; every object URL is revoked when the component goes.
 *   5. Every act on a card goes through `commit`, whose one button is inside the confirmation, after
 *      the act's effects.
 *   6. The effects say the card stops working in the app, a suspension cannot be lifted, a
 *      replacement has a new number, and a check is recorded by the API while this console keeps
 *      nothing.
 *   7. The mappers never read a QR, and a check's answer is read for its five fields only.
 *   8. `digital-id.verify` and `digital-id.manage` are the server's keys: both in `PERMISSIONS`, the
 *      second named by no role and mutating, the first a read; the route and the menu ask for both.
 *
 * Each rule was validated against a planted regression before being trusted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const shown = (file) => relative(ROOT, file).split(sep).join('/');
const failures = [];

const FEATURE = join(APP, 'features', 'digital-ids');
const FILES = {
  copy: join(FEATURE, 'digital-ids.copy.ts'),
  page: join(FEATURE, 'digital-ids-page.html'),
  check: join(FEATURE, 'card-check.ts'),
  checkTemplate: join(FEATURE, 'card-check.html'),
  photo: join(FEATURE, 'card-photo.ts'),
  panel: join(FEATURE, 'card-panel.ts'),
  panelTemplate: join(FEATURE, 'card-panel.html'),
  domain: join(APP, 'domain', 'digital-ids', 'digital-id.ts'),
  mapper: join(APP, 'data', 'http', 'mappers', 'digital-id.mapper.ts'),
  mock: join(APP, 'data', 'mock', 'mock-digital-id.repository.ts'),
};
for (const file of Object.values(FILES)) {
  if (!existsSync(file))
    failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
}
if (failures.length > 0) report();

/** Comments explain these rules and must not trip them. */
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');
const source = (file) => code(readFileSync(file, 'utf8'));

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
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const count = (text, pattern) => [...text.matchAll(new RegExp(pattern.source, 'g'))].length;

/* ── 1. residents carry it; no camera needed ─────────────────────────────── */

const copy = readFileSync(FILES.copy, 'utf8');
if (!/subtitle:\s*\n?\s*'Residents carry this card in the Taytay app/.test(copy)) {
  failures.push(
    'The digital IDs page no longer opens by saying residents carry the card in the Taytay app.',
  );
}
if (
  !/noCamera:\s*\n?\s*'This console does not use the camera/.test(copy) ||
  !/copy\.noCamera/.test(source(FILES.checkTemplate))
) {
  failures.push('The check no longer says that no camera is needed.');
}

/* ── 2. no camera, no storage, no log ────────────────────────────────────── */

const http = readFileSync(join(APP, 'data', 'http', 'http-repositories.ts'), 'utf8');
const adapter = block(http, http.indexOf('export class HttpDigitalIdRepository'));
if (adapter === '') failures.push('HttpDigitalIdRepository is missing from http-repositories.ts.');
const LEAK =
  /\b(getUserMedia|mediaDevices|BarcodeDetector|ImageCapture|localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir))\b/;
for (const [file, text] of [
  ...[...walk(FEATURE), FILES.domain, FILES.mapper, FILES.mock].map((file) => [
    shown(file),
    source(file),
  ]),
  ['HttpDigitalIdRepository', code(adapter)],
]) {
  const found = LEAK.exec(text);
  if (found !== null)
    failures.push(`${file} uses ${found[1]}. A card check asks for no camera and keeps nothing.`);
}

/* ── 3. sent from check(), the field emptied first ──────────────────────── */

const check = source(FILES.check);
const sendCall = /this\s*\.\s*repository\s*\.\s*check\s*\(/;
const checkBody = methodBody(check, 'check');
if (count(check, sendCall) !== 1 || !sendCall.test(checkBody)) {
  failures.push('The code is sent from somewhere other than CardCheck.check.');
}
const emptied = checkBody.search(/this\s*\.\s*payload\s*\.\s*set\s*\(\s*''\s*\)/);
if (emptied === -1 || emptied > checkBody.search(sendCall)) {
  failures.push('CardCheck.check no longer empties the field before the code is sent.');
}

/* ── 4. the photo only from the warning ──────────────────────────────────── */

const photo = source(FILES.photo);
const openCall = /this\s*\.\s*repository\s*\.\s*openPhoto\s*\(/;
if (count(photo, openCall) !== 1 || !openCall.test(methodBody(photo, 'open'))) {
  failures.push('The photo is fetched from somewhere other than CardPhoto.open.');
}
for (const file of [FILES.check, FILES.checkTemplate, FILES.panel, FILES.panelTemplate]) {
  if (/openPhoto\s*\(/.test(source(file)))
    failures.push(`${shown(file)} fetches a photo itself. Only CardPhoto does, after its warning.`);
}
const modal = photo.indexOf('<app-modal');
const warning = photo.indexOf('copy.warning', modal);
const button = photo.indexOf('(click)="open()"');
if (
  modal === -1 ||
  warning === -1 ||
  button === -1 ||
  !(modal < warning && warning < button) ||
  count(photo, /\(click\)="open\(\)"/) !== 1
) {
  failures.push("The photo's only button is no longer inside the warning, after its words.");
}
if (/this\s*\.\s*open\s*\(/.test(photo)) {
  failures.push(
    "CardPhoto calls open itself. The photo is fetched only from the warning's own button.",
  );
}
if (
  !/onDestroy\s*\(\s*\(\)\s*=>\s*this\s*\.\s*objectUrls\s*\.\s*revokeAll\s*\(\s*\)\s*\)/.test(photo)
) {
  failures.push('CardPhoto no longer revokes its object URLs when it goes.');
}

/* ── 5. every act through commit, from the confirmation ─────────────────── */

const panel = source(FILES.panel);
const panelTemplate = source(FILES.panelTemplate);
const acts = /this\s*\.\s*repository\s*\.\s*(issue|suspend|revoke|reissue)\s*\(/;
const requestFor = methodBody(panel, 'requestFor');
if (count(panel, acts) !== 4 || count(requestFor, acts) !== 4) {
  failures.push('An act on a card is sent from somewhere other than CardPanel.requestFor.');
}
if (
  count(panel, /this\s*\.\s*requestFor\s*\(/) !== 1 ||
  !/this\s*\.\s*requestFor\s*\(/.test(methodBody(panel, 'commit'))
) {
  failures.push('CardPanel.requestFor is reached from somewhere other than commit.');
}
if (/this\s*\.\s*commit\s*\(/.test(panel)) {
  failures.push(
    "CardPanel calls commit itself. A card is changed only from the confirmation's own button.",
  );
}
const confirmation = panelTemplate.indexOf('<app-modal');
const effects = panelTemplate.indexOf('@for (effect of effects[act]', confirmation);
const commit = panelTemplate.indexOf('(click)="commit(');
if (
  confirmation === -1 ||
  effects === -1 ||
  commit === -1 ||
  !(confirmation < effects && effects < commit) ||
  count(panelTemplate, /\(click\)="commit\(/) !== 1
) {
  failures.push(
    "A card is changed from outside the confirmation, or before the act's effects are shown.",
  );
}

/* ── 6. what each act and a check do ─────────────────────────────────────── */

const fullDomain = source(FILES.domain);
// The catalog repeats some of these words; only the effects shown before a button count.
const domain = fullDomain.slice(fullDomain.indexOf('export const DIGITAL_ID_EFFECTS'));
for (const [pattern, said] of [
  [/stops working in the app/, 'the card stops working in the app'],
  [/No route makes a suspended card active again/, 'a suspension cannot be lifted'],
  [/with a new number/, 'a replacement has a new number'],
  [/records that you checked this card/, 'the API records a check'],
  [/This console keeps nothing/, 'this console keeps nothing of a check'],
]) {
  if (!pattern.test(domain)) failures.push(`The digital ID effects no longer say ${said}.`);
}

/* ── 7. no QR read, five fields of a check ───────────────────────────────── */

const mapper = source(FILES.mapper);
if (/['"]qr['"]|['"]token['"]\s*\)/.test(mapper))
  failures.push('The digital ID mapper reads a QR. The office keeps no QR.');
const holder = block(mapper, mapper.indexOf('export function toDigitalIdHolder'));
const ALLOWED = new Set(['name', 'photo_media_id', 'status', 'expired', 'barangay']);
for (const match of holder.matchAll(/field\(\s*wire\s*,\s*'([a-z_]+)'\s*\)/g)) {
  if (!ALLOWED.has(match[1]))
    failures.push(
      `toDigitalIdHolder reads ${match[1]}. A check shows what the API answers, and nothing beside it.`,
    );
}

/* ── 8. the server's keys ────────────────────────────────────────────────── */

const permission = source(join(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(
  permission.indexOf('export const PERMISSIONS'),
  permission.indexOf('] as const;'),
);
const roles = permission.slice(permission.indexOf('] as const;'));
for (const key of ['digital-id.verify', 'digital-id.manage']) {
  if (!vocabulary.includes(`'${key}'`))
    failures.push(`PERMISSIONS does not hold '${key}', the API's own key.`);
}
if (roles.includes("'digital-id.manage'"))
  failures.push(
    "A role lists 'digital-id.manage' by name. The API grants it to administrators alone.",
  );
const matrix = source(join(APP, 'domain', 'access', 'permission-matrix.ts'));
if (matrix.includes('digital-id.manage'))
  failures.push(
    "'digital-id.manage' is classified read-only. It decides whether a resident's card works.",
  );
if (!matrix.includes("'digital-id.verify'"))
  failures.push(
    "'digital-id.verify' is no longer classified read-only, so the auditor would become a mutating role.",
  );
const routes = source(join(APP, 'app.routes.ts'));
const route = routes.slice(
  routes.indexOf("path: 'digital-ids'"),
  routes.indexOf("path: 'digital-ids'") + 500,
);
const nav = source(join(APP, 'core', 'navigation', 'navigation.ts'));
const entry = nav.slice(
  nav.indexOf("route: '/digital-ids'"),
  nav.indexOf("route: '/digital-ids'") + 400,
);
for (const [where, text] of [
  ['route', route],
  ['menu entry', entry],
]) {
  if (!/'digital-id\.verify'/.test(text) || !/'digital-id\.manage'/.test(text)) {
    failures.push(`The digital IDs ${where} no longer asks for both of the server's keys.`);
  }
}

report();

function report() {
  if (failures.length > 0) {
    console.error('\nDigital ID check failed (DL-171):\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }
  console.log(
    'Digital ID check passed (no camera, nothing kept or logged, the code emptied before it is sent, ' +
      'the photo only after the warning, every act confirmed after its effects, the server’s keys).',
  );
}
