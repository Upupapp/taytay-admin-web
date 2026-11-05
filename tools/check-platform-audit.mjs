#!/usr/bin/env node
/**
 * check:platform-audit — the app's audit trail shows what a row holds and nothing beside it
 * (`DL-171`, `DL-114`).
 *
 *   1. A row has no field for a value, a reason or a person's details: `PlatformAuditEntry` holds
 *      exactly id, actor, action, subject type, subject id and time.
 *   2. The mapper reads exactly the six fields the API returns.
 *   3. The page reads one port: no account, staff, resident or governance repository is injected, so
 *      nothing is looked up beside a row.
 *   4. Not the governance trail: the module names neither `GOVERNANCE_REPOSITORY` nor `AuditRow`.
 *   5. An action this console has no words for is shown as given and said to be undescribed — never
 *      dropped — and the screen says the API keeps no earlier or later value.
 *   6. Nothing in the module touches web storage, cookies or the console.
 *   7. The route and the menu entry ask for `audit.view`, the server's key.
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

const FEATURE = join(APP, 'features', 'platform-audit');
const FILES = {
  page: join(FEATURE, 'platform-audit-page.ts'),
  template: join(FEATURE, 'platform-audit-page.html'),
  domain: join(APP, 'domain', 'platform-audit', 'platform-audit.ts'),
  mapper: join(APP, 'data', 'http', 'mappers', 'platform-audit.mapper.ts'),
  mock: join(APP, 'data', 'mock', 'mock-platform-audit.repository.ts'),
};
for (const file of Object.values(FILES)) {
  if (!existsSync(file)) failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
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

const same = (a, b) => a.length === b.length && a.every((item) => b.includes(item));

/* ── 1. the row's fields ────────────────────────────────────────────────── */

const domain = source(FILES.domain);
const row = block(domain, domain.indexOf('export interface PlatformAuditEntry '));
const fields = [...row.matchAll(/readonly\s+(\w+)\s*\??:/g)].map((match) => match[1]);
const ROW = ['id', 'actorId', 'action', 'subjectType', 'subjectId', 'at'];
if (!same(fields, ROW)) {
  failures.push(
    `PlatformAuditEntry holds ${fields.join(', ')}. A row holds who, what, which record and when — ` +
      'never a value, a reason or a person’s details (DL-114).',
  );
}

/* ── 2. the mapper reads six fields ─────────────────────────────────────── */

const mapper = source(FILES.mapper);
const read = [...mapper.matchAll(/field\(\s*wire\s*,\s*'([a-z_]+)'\s*\)/g)].map((match) => match[1]);
const WIRE = ['id', 'actor_id', 'action', 'subject_type', 'subject_id', 'created_at'];
if (!same([...new Set(read)], WIRE)) {
  failures.push(`toPlatformAuditEntry reads ${[...new Set(read)].join(', ')}; it reads exactly ${WIRE.join(', ')}.`);
}

/* ── 3. one port ────────────────────────────────────────────────────────── */

const page = source(FILES.page);
const injected = [...page.matchAll(/inject\(\s*([A-Z][A-Z_]+)\s*\)/g)].map((match) => match[1]);
const extra = injected.filter((token) => token !== 'PLATFORM_AUDIT_REPOSITORY');
if (extra.length > 0) {
  failures.push(`The audit page injects ${extra.join(', ')}. Nothing is looked up beside a row.`);
}
if (!injected.includes('PLATFORM_AUDIT_REPOSITORY')) failures.push('The audit page no longer reads PLATFORM_AUDIT_REPOSITORY.');

/* ── 4. not the governance trail ────────────────────────────────────────── */

const moduleFiles = [...walk(FEATURE), FILES.domain, FILES.mapper, FILES.mock];
for (const file of moduleFiles) {
  const found = /\b(GOVERNANCE_REPOSITORY|GovernanceRepository|AuditRow|AuditEntryDetail)\b/.exec(source(file));
  if (found !== null) failures.push(`${shown(file)} names ${found[1]}. The app's trail is not the governance trail.`);
}

/* ── 5. an unknown action shown, no values said ─────────────────────────── */

const describe = block(page, page.indexOf('protected describe('));
if (!/describeAuditAction\s*\(\s*entry\s*\.\s*action\s*\)\s*\?\?\s*this\s*\.\s*copy\s*\.\s*noWords/.test(describe)) {
  failures.push('An action this console has no words for is no longer said to be undescribed.');
}
const template = source(FILES.template);
if (!/\{\{\s*entry\s*\.\s*action\s*\}\}/.test(template)) failures.push("The audit page no longer shows each action's code as given.");
if (!/keeps no earlier or later value/.test(domain) || !/@for \(limit of limits/.test(template)) {
  failures.push('The audit page no longer says the API keeps no earlier or later value.');
}

/* ── 6. no storage, no log ──────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(source(file));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing read from the trail is kept or logged.`);
}

/* ── 7. the server's key ────────────────────────────────────────────────── */

const routes = source(join(APP, 'app.routes.ts'));
const route = routes.slice(routes.indexOf("path: 'app-audit'"), routes.indexOf("path: 'app-audit'") + 400);
const nav = source(join(APP, 'core', 'navigation', 'navigation.ts'));
const entry = nav.slice(nav.indexOf("route: '/app-audit'"), nav.indexOf("route: '/app-audit'") + 300);
for (const [where, text] of [['route', route], ['menu entry', entry]]) {
  if (!/permission(?:Guard\(|s: \[)'audit\.view'[)\]]/.test(text)) {
    failures.push(`The app audit ${where} no longer asks for 'audit.view' alone.`);
  }
}

report();

function report() {
  if (failures.length > 0) {
    console.error('\nApp audit trail check failed (DL-171):\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }
  console.log(
    'App audit trail check passed (six fields and no value, one port and no lookup, not the ' +
      'governance trail, every code shown, nothing kept or logged, the server’s key).',
  );
}
