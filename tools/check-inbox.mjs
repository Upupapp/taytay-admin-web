#!/usr/bin/env node
/**
 * check:inbox — the office inbox keeps its promises about what residents wrote (`DL-168`).
 *
 * A message in this inbox is a resident writing to their government: about a death in the family, a
 * roof the typhoon took, a child's vaccine. The screens are built so that those words are read by
 * somebody who opened the conversation to answer it, and nowhere else. A comment cannot hold that
 * line against the next convenient change, so this does:
 *
 * ## What was written stays in the conversation
 *
 *   1. No preview. The model and the mapper carry nothing of `last_message_preview`, and the list's
 *      template binds no message body — the subject is the list's, the words are the conversation's.
 *   2. Nothing in the module logs, stores or notifies: no `console`, no web storage, no cookie, no
 *      `NotificationStore`. A toast that quotes a resident puts their words on every screen nearby.
 *
 * ## The images are the resident's
 *
 *   3. A message carries media ids and no address; the port hands out bytes; the http adapter reads
 *      them through `ApiClient.blob` — the bearer token in a header, never in a URL.
 *   4. An image is fetched only from the warning's own button: `openAttachment` is called in exactly
 *      one method, and the template reaches that method only inside the warning modal.
 *   5. Object URLs come from the page's own `ObjectUrls`, are revoked when hidden, and all of them on
 *      destroy — and `ObjectUrls` is the only file in the console that makes one.
 *
 * ## An empty inbox is asked about, and closing keeps no reason
 *
 *   6. The http adapter answers `no-office` by asking `GET me`, and the list renders that answer as
 *      an explanation, never as the empty table.
 *   7. Closing takes an id and nothing else, posts `{}`, and its confirmation collects no words: the
 *      server keeps no reason, and the effects shown before the button say so.
 *   8. `office-inbox.manage` is the server's key, mutating, guards both inbox routes and the menu
 *      entry, and is not held by the auditor or the barangay link.
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

const DOMAIN = join(APP, 'domain', 'inbox', 'office-thread.ts');
const FEATURE = join(APP, 'features', 'inbox');
const LIST_TEMPLATE = join(FEATURE, 'inbox-page.html');
const THREAD = join(FEATURE, 'thread-page.ts');
const THREAD_TEMPLATE = join(FEATURE, 'thread-page.html');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'office-thread.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-office-inbox.repository.ts');
const SEED = join(APP, 'data', 'mock', 'seed', 'office-threads.seed.ts');
const ADAPTERS = join(APP, 'data', 'http', 'http-repositories.ts');
const PORTS = join(APP, 'domain', 'ports', 'repositories.ts');
const OBJECT_URLS = join(APP, 'shared', 'media', 'object-urls.ts');

for (const file of [DOMAIN, LIST_TEMPLATE, THREAD, THREAD_TEMPLATE, MAPPER, MOCK, SEED, OBJECT_URLS]) {
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

/** The text from `start` to the brace that closes the first `{` after it, or `''`. */
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

const domain = code(read(DOMAIN));
const mapper = code(read(MAPPER));
const adapters = code(read(ADAPTERS));
const httpInbox = block(adapters, adapters.indexOf('export class HttpOfficeInboxRepository'));
const moduleFiles = [...walk(FEATURE), DOMAIN, MAPPER, MOCK, SEED];

if (httpInbox === '') failures.push('HttpOfficeInboxRepository was not found, so it was not checked.');

/* ── 1. no preview ───────────────────────────────────────────────────────── */

if (/preview/i.test(domain) || /last_message_preview/.test(mapper) || /preview/i.test(httpInbox)) {
  failures.push(
    'The inbox model, mapper or adapter reads a message preview. What a resident wrote is read by opening the conversation, not in a list.',
  );
}
const listTemplate = code(read(LIST_TEMPLATE));
// `noOffice.body` is the explanation's own sentences, not anything a resident wrote.
if (/\.\s*(body|preview|lastMessagePreview)\b/i.test(listTemplate.replace(/noOffice\.body/g, ''))) {
  failures.push(
    "The inbox list binds a message's words. The list shows subjects; the words are the conversation's.",
  );
}

/* ── 2. no log, no storage, no notification ──────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group)|NotificationStore|NOTIFICATION_REPOSITORY)\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) {
    failures.push(
      `${shown(file)} uses ${found[1]}. What a resident wrote is not logged, stored or put in a notification.`,
    );
  }
}

/* ── 3. ids, not addresses; bytes through ApiClient.blob ─────────────────── */

const ADDRESS_FIELD = /\b(\w*(?:url|uri|href|src|link)\w*)\??\s*:/i;
for (const name of ['OfficeThread', 'ThreadMessage']) {
  const start = domain.search(new RegExp(`export interface ${name}\\b`));
  const body = block(domain, start);
  const found = ADDRESS_FIELD.exec(body);
  if (body === '') failures.push(`${name} was not found in the inbox model.`);
  else if (found !== null) {
    failures.push(`${name} carries ${found[1]}. An image is a media id read as bytes, never an address.`);
  }
}
const ports = code(read(PORTS));
if (!/openAttachment\(message: ThreadMessage, media: MediaId\): Observable<Blob>;/.test(ports)) {
  failures.push('OfficeInboxRepository.openAttachment must hand out bytes (Blob) for one carried media id.');
}
const openAttachment = methodBody(httpInbox, 'openAttachment');
if (
  !/this\s*\.\s*api\s*\.\s*blob\s*\(\s*`\$\{API_ENDPOINTS\.media\}\/\$\{\w+\}\/content`\s*\)/.test(
    openAttachment,
  ) ||
  !/attachments\s*\.\s*includes\(/.test(openAttachment)
) {
  failures.push(
    'HttpOfficeInboxRepository.openAttachment must read GET media/{id}/content through ApiClient.blob, and only for a media id the message carries.',
  );
}
if (/\btoken\b|\?access_token|createObjectURL/i.test(httpInbox)) {
  failures.push('HttpOfficeInboxRepository names a token or makes an object URL. It hands bytes over and nothing else.');
}

/* ── 4. fetched only from the warning's own button ───────────────────────── */

const threadCode = code(read(THREAD));
const featureCode = walk(FEATURE)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, text: code(readFileSync(file, 'utf8')) }));
const openCalls = featureCode.flatMap(({ file, text }) =>
  [...text.matchAll(/\.\s*openAttachment\s*\(/g)].map(() => file),
);
const confirmBody = methodBody(threadCode, 'confirmOpen');
if (openCalls.length === 0) {
  failures.push('No screen calls openAttachment, so this check cannot vouch for when images are fetched.');
} else if (
  openCalls.some((file) => file !== THREAD) ||
  [...confirmBody.matchAll(/\.\s*openAttachment\s*\(/g)].length !== openCalls.length
) {
  failures.push('openAttachment is called outside ThreadPage.confirmOpen. An image is fetched only after the warning.');
}
const threadTemplate = code(read(THREAD_TEMPLATE));
const modals = [...threadTemplate.matchAll(/<app-modal[\s\S]*?<\/app-modal>/g)].map((m) => m[0]);
const warning = modals.find((modal) => /warningHeading/.test(modal)) ?? '';
const confirmCalls = [...threadTemplate.matchAll(/confirmOpen\(\)/g)].length;
if (warning === '' || confirmCalls === 0 || [...warning.matchAll(/confirmOpen\(\)/g)].length !== confirmCalls) {
  failures.push('confirmOpen() is reachable from outside the warning modal. The warning comes before the image, every time.');
}
if (/ngOnInit|afterNextRender/.test(threadCode)) {
  failures.push('The conversation page does work on load that could open an image without the warning.');
}

/* ── 5. object URLs from the page's own holder, revoked ──────────────────── */

for (const file of walk(APP).filter((f) => f !== OBJECT_URLS)) {
  if (/URL\s*\.\s*createObjectURL/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(`${shown(file)} makes an object URL itself. Only ObjectUrls does, so one place revokes them all.`);
  }
}
const holder = code(read(OBJECT_URLS));
if (
  !/URL\s*\.\s*createObjectURL/.test(methodBody(holder, 'make')) ||
  !/URL\s*\.\s*revokeObjectURL/.test(methodBody(holder, 'revoke')) ||
  !/URL\s*\.\s*revokeObjectURL/.test(methodBody(holder, 'revokeAll'))
) {
  failures.push('ObjectUrls must make object URLs in make() and revoke them in revoke() and revokeAll().');
}
if (
  !/new\s+ObjectUrls\(\)/.test(threadCode) ||
  !/this\s*\.\s*objectUrls\s*\.\s*make\(/.test(confirmBody) ||
  !/this\s*\.\s*objectUrls\s*\.\s*revoke\(/.test(methodBody(threadCode, 'hideImage')) ||
  !/this\s*\.\s*objectUrls\s*\.\s*revokeAll\(\)/.test(methodBody(threadCode, 'discardImages')) ||
  !/destroyRef\s*\.\s*onDestroy\(\s*\(\)\s*=>\s*this\s*\.\s*discardImages\(\)\s*\)/.test(threadCode)
) {
  failures.push(
    "The conversation page does not make its images' addresses with its own ObjectUrls, revoke one when hidden, and revoke them all on destroy.",
  );
}
if (/\[src\]="(?!image\.value")/.test(threadTemplate)) {
  failures.push('An image in the conversation is bound to something other than the object URL the page made.');
}

/* ── 6. an empty first page is asked about ───────────────────────────────── */

const list = methodBody(httpInbox, 'list');
if (!/API_ENDPOINTS\.me\b/.test(list) || !/'no-office'/.test(list)) {
  failures.push(
    "HttpOfficeInboxRepository.list no longer asks GET me before calling an empty page empty. The server answers an account with no office with an empty list.",
  );
}
if (!/noOffice\.heading/.test(listTemplate) || !/firstPage\(\)\s*===\s*null/.test(listTemplate)) {
  failures.push('The inbox list no longer renders the no-office answer as an explanation in place of the table.');
}

/* ── 7. closing keeps no reason, and says so ─────────────────────────────── */

if (!/\n\s+close\(id: OfficeThreadId\): Observable<OfficeThread>;/.test(ports)) {
  failures.push('OfficeInboxRepository.close takes something besides the id. The server keeps no reason, so none is collected.');
}
if (!/this\s*\.\s*api\s*\.\s*post\(\s*`\$\{API_ENDPOINTS\.threads\}\/\$\{id\}\/close`\s*,\s*\{\}\s*\)/.test(httpInbox)) {
  failures.push('HttpOfficeInboxRepository.close must post an empty body to threads/{id}/close.');
}
const closeModal = modals.find((modal) => /closeHeading/.test(modal)) ?? '';
if (closeModal === '' || /<(textarea|input|select)\b/.test(closeModal) || !/closeEffects/.test(closeModal)) {
  failures.push('The close confirmation must list what closing does and collect no words.');
}
const effects = domain.slice(domain.indexOf('THREAD_CLOSE_EFFECTS'));
if (!/keeps no reason/.test(effects)) {
  failures.push('THREAD_CLOSE_EFFECTS no longer says the server keeps no reason.');
}

/* ── 8. the server's key, mutating, on both routes and the menu ──────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(
  permission.indexOf('export const PERMISSIONS'),
  permission.indexOf('] as const;'),
);
if (!vocabulary.includes("'office-inbox.manage'")) {
  failures.push("PERMISSIONS does not hold 'office-inbox.manage', the API's own key.");
}
const roles = permission.slice(permission.indexOf('export const ROLE_DEFINITIONS'));
for (const role of ['auditor', 'barangay-link']) {
  const start = roles.search(new RegExp(`\\n\\s+'?${role}'?:\\s*\\{`));
  if (/'office-inbox\.manage'/.test(block(roles, start))) {
    failures.push(`The ${role} holds 'office-inbox.manage'. The server gives it to staff at an office and administrators.`);
  }
}
if (/office-inbox/.test(code(read(APP, 'domain', 'access', 'permission-matrix.ts')))) {
  failures.push("'office-inbox.manage' is classified read-only. It replies to residents and closes conversations.");
}
const routes = read(APP, 'app.routes.ts');
const guarded = [
  ...routes.matchAll(
    /canActivate:\s*\[servedGuard\('office-inbox',\s*'office'\),\s*permissionGuard\('office-inbox\.manage'\)\]/g,
  ),
].length;
if (guarded !== 2) {
  failures.push(
    `${guarded} of the 2 inbox routes ask for servedGuard('office-inbox', 'office') and permissionGuard('office-inbox.manage').`,
  );
}
if (!/route:\s*'\/inbox',[\s\S]{0,120}permissions:\s*\['office-inbox\.manage'\]/.test(read(APP, 'core', 'navigation', 'navigation.ts'))) {
  failures.push("The menu's Office inbox entry does not ask for 'office-inbox.manage'.");
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nInbox check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Inbox check passed (${moduleFiles.length} files: no preview, nothing logged or notified, images only after the warning ` +
      'and revoked on leave, an empty inbox asked about, no reason collected for a close).',
  );
}
