#!/usr/bin/env node
/**
 * check:accounts — users and roles shows the minimum and says what a change does first (`DL-168`).
 *
 * The list is every account in the residents' app, so most rows are residents who never asked to
 * appear on a staff screen; and a role change can revoke somebody's digital ID or hand them this
 * console. Both are easy to erode one convenient field or one moved button at a time, so:
 *
 * ## The minimum
 *
 *   1. `AppAccount` carries no mobile number, barangay, birth date, address or verification status;
 *      the mapper reads none of them; no template in the module binds one (CLAUDE.md §6.1).
 *   2. Nothing in the module logs or stores: no `console`, no web storage, no cookie.
 *
 * ## A change says what it does, before it is made, and asks for no reason it cannot keep
 *
 *   3. In the account panel, each change's effects come before the button that makes it, and each
 *      button is reachable only after a choice.
 *   4. `changeRole` takes an id and a role, `assignOffice` an id and an office; the adapter sends
 *      `{ role }` and `{ office_id }`; the panel has no free-text field; the effects say the server
 *      keeps no reason. The server audits both changes and stores no reason.
 *   5. A demotion's effects say the digital ID is revoked, and verifying by role says it skips the ID
 *      review — the two consequences somebody would most regret not having been told.
 *   6. The reader's own role is not offered: the panel checks `own()` before the form, the method
 *      refuses it too, and the page passes it.
 *
 * ## The server's keys
 *
 *   7. `user.view`, `user.change-role` and `user.assign-office` are in `PERMISSIONS`, named by no role
 *      (the administrator holds them by holding every key), the two changes are mutating, and the
 *      route and the menu entry ask for `user.view`.
 * ## The office role (`DL-173`): the one change that asks why
 *   8. In `AccountOfficeRole`, the reader's own account is asked about before the form and refused
 *      by `save` too; the effects come between the choice and the reason box, and the reason box
 *      before the one button; the port takes the change and the adapter sends it through
 *      `toWireOfficeRoleChange` to `office-role`; `system-administrator` is not offered; and the
 *      effects say the server keeps the reason. `scopeBarangayId` is the one barangay `AppAccount`
 *      may carry: the barangay a barangay link may see, which the server decides — not where the
 *      person lives, which rule 1 still keeps out.
 *
 * ## A checked name (`DL-198`): corrected against an ID seen, never one's own
 *   9. `AccountNameCorrection` asks about the reader's own account before the field, and `save`
 *      refuses it too; it is offered for a verified account (`hasCheckedName`) to a reader who holds
 *      `verification.review`; the effects come before the statement that an ID was seen, and both
 *      before the one button, which waits for the statement; there is no reason box, and the effects
 *      say the server keeps none and keeps the earlier name; the port takes a `NameCorrection` and
 *      the adapter posts it to `name-corrections` with the name shown and `id_checked: true`.
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

const DOMAIN = join(APP, 'domain', 'accounts', 'app-account.ts');
const FEATURE = join(APP, 'features', 'accounts');
const PANEL = join(FEATURE, 'account-panel.ts');
const PANEL_TEMPLATE = join(FEATURE, 'account-panel.html');
const ROLE_PANEL = join(FEATURE, 'account-office-role.ts');
const ROLE_TEMPLATE = join(FEATURE, 'account-office-role.html');
const NAME_PANEL = join(FEATURE, 'account-name-correction.ts');
const NAME_TEMPLATE = join(FEATURE, 'account-name-correction.html');
const PAGE_TEMPLATE = join(FEATURE, 'accounts-page.html');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'app-account.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-app-account.repository.ts');
const SEED = join(APP, 'data', 'mock', 'seed', 'app-accounts.seed.ts');
const ADAPTERS = join(APP, 'data', 'http', 'http-repositories.ts');
const PORTS = join(APP, 'domain', 'ports', 'repositories.ts');

for (const file of [DOMAIN, PANEL, PANEL_TEMPLATE, ROLE_PANEL, ROLE_TEMPLATE, PAGE_TEMPLATE, MAPPER, MOCK, SEED]) {
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
const httpAccounts = block(adapters, adapters.indexOf('export class HttpAppAccountRepository'));
const panelCode = code(read(PANEL));
const panelTemplate = code(read(PANEL_TEMPLATE));
const pageTemplate = code(read(PAGE_TEMPLATE));
const moduleFiles = [...walk(FEATURE), DOMAIN, MAPPER, MOCK, SEED];

if (httpAccounts === '') failures.push('HttpAppAccountRepository was not found, so it was not checked.');

/* ── 1. the minimum ──────────────────────────────────────────────────────── */

const model = block(domain, domain.search(/export interface AppAccount\b/));
const PERSONAL = /\b(?!scopeBarangayId\b)(\w*(?:mobile|phone|barangay|birth|address|street|purok|verification|sex)\w*)\??\s*:/i;
const extra = PERSONAL.exec(model);
if (model === '') failures.push('AppAccount was not found in the accounts model.');
else if (extra !== null) {
  failures.push(`AppAccount carries ${extra[1]}. The list is every resident in the app; it shows the minimum.`);
}
const read_ = /field\(wire,\s*'(mobile|barangay_id|birthdate|address|street|purok|verification_status|sex)'\)/.exec(mapper);
if (read_ !== null) {
  failures.push(`toAppAccount reads ${read_[1]}. A screen deciding who is staff does not need it.`);
}
for (const file of walk(FEATURE).filter((f) => f.endsWith('.html'))) {
  const found = /\.\s*(mobile|barangayId|birthdate|birthDate|address|verificationStatus)\b/.exec(
    code(readFileSync(file, 'utf8')),
  );
  if (found !== null) failures.push(`${shown(file)} binds ${found[1]}. Users and roles shows the minimum.`);
}

/* ── 2. no log, no storage ───────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing about an account is logged or stored.`);
}

/* ── 3. effects before the button, the button only after a choice ────────── */

const roleChoice = panelTemplate.indexOf('@if (chosenRole(); as role)');
const roleEffects = panelTemplate.indexOf('roleEffects[role]', roleChoice);
const roleAlways = panelTemplate.indexOf('roleAlways', roleChoice);
const roleButton = panelTemplate.indexOf('(click)="changeRole()"');
if (
  roleChoice === -1 ||
  roleEffects === -1 ||
  roleAlways === -1 ||
  roleButton === -1 ||
  !(roleChoice < roleEffects && roleEffects < roleButton && roleAlways < roleButton) ||
  [...panelTemplate.matchAll(/changeRole\(\)/g)].length !== 1
) {
  failures.push("The role change's effects no longer come between the choice and the one button that makes it.");
}
const officeChoice = panelTemplate.indexOf('@if (officeChange(); as change)');
const officeEffects = panelTemplate.indexOf('officeEffects', officeChoice);
const officeButton = panelTemplate.indexOf('(click)="assignOffice()"');
if (
  officeChoice === -1 ||
  officeEffects === -1 ||
  officeButton === -1 ||
  !(officeChoice < officeEffects && officeEffects < officeButton) ||
  [...panelTemplate.matchAll(/assignOffice\(\)/g)].length !== 1
) {
  failures.push("The office change's effects no longer come between the choice and the one button that makes it.");
}

/* ── 4. no reason collected, none sent ───────────────────────────────────── */

const ports = code(read(PORTS));
if (
  !/\n\s+changeRole\(id: AppAccountId, role: AccountRole\): Observable<AppAccount>;/.test(ports) ||
  !/\n\s+assignOffice\(id: AppAccountId, office: OfficeId \| null\): Observable<AppAccount>;/.test(ports)
) {
  failures.push('AppAccountRepository takes more than the change. The server keeps no reason, so none is collected.');
}
if (
  !/this\s*\.\s*api\s*\.\s*patch\(\s*`\$\{API_ENDPOINTS\.adminUsers\}\/\$\{id\}\/role`\s*,\s*\{\s*role\s*\}\s*\)/.test(httpAccounts) ||
  !/this\s*\.\s*api\s*\.\s*patch\(\s*`\$\{API_ENDPOINTS\.adminUsers\}\/\$\{id\}\/office`\s*,\s*\{\s*office_id:\s*office\s*\}\s*\)/.test(httpAccounts)
) {
  failures.push('HttpAppAccountRepository must send { role } and { office_id } and nothing else.');
}
if (/<(textarea)\b|type="text"/.test(panelTemplate)) {
  failures.push('The account panel collects free text. The server keeps no reason for either change.');
}
const always = domain.slice(domain.indexOf('ROLE_CHANGE_ALWAYS'), domain.indexOf('OFFICE_ASSIGNMENT_EFFECTS'));
const office = domain.slice(domain.indexOf('export const OFFICE_ASSIGNMENT_EFFECTS'));
if (!/keeps no reason/.test(always) || [...office.matchAll(/keeps no reason/g)].length < 2) {
  failures.push('The effects no longer say the server keeps no reason for a role or an office change.');
}

/* ── 5. the consequences somebody would regret not being told ─────────────── */

const effects = domain.slice(domain.indexOf('export const ROLE_CHANGE_EFFECTS'), domain.indexOf('ROLE_CHANGE_ALWAYS'));
for (const role of ['registered', 'staff', 'admin']) {
  const entry = new RegExp(`\\n\\s+${role}:\\s*\\[([\\s\\S]*?)\\],`).exec(effects)?.[1] ?? '';
  if (!/digital ID[\s\S]*revoked/.test(entry)) {
    failures.push(`ROLE_CHANGE_EFFECTS.${role} no longer says the account's digital ID is revoked.`);
  }
}
if (!/without an ID review/.test(effects)) {
  failures.push('ROLE_CHANGE_EFFECTS.verified no longer says it marks the account verified without an ID review.');
}

/* ── 6. not one's own role ───────────────────────────────────────────────── */

const ownCheck = panelTemplate.indexOf('@if (own())');
const fieldset = panelTemplate.indexOf('<fieldset');
if (ownCheck === -1 || fieldset === -1 || ownCheck > fieldset) {
  failures.push("The account panel offers the role form before asking whether it is the reader's own account.");
}
if (!/this\s*\.\s*own\(\)/.test(methodBody(panelCode, 'changeRole'))) {
  failures.push("AccountPanel.changeRole no longer refuses the reader's own account.");
}
if (!/\[own\]="isOwn\(account\)"/.test(pageTemplate)) {
  failures.push('The accounts page no longer tells the panel which account is the reader’s own.');
}

/* ── 7. the server's keys ────────────────────────────────────────────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
// Everything after the vocabulary: the role definitions and the shared lists they spread, which a
// slice from ROLE_DEFINITIONS would miss (INTAKE_PERMISSIONS is declared above it).
const roles = permission.slice(permission.indexOf('] as const;'));
for (const key of ['user.view', 'user.change-role', 'user.assign-office']) {
  if (!vocabulary.includes(`'${key}'`)) failures.push(`PERMISSIONS does not hold '${key}', the API's own key.`);
  if (roles.includes(`'${key}'`)) {
    failures.push(`A role lists '${key}' by name. The API grants it to administrators alone.`);
  }
}
const readOnly = code(read(APP, 'domain', 'access', 'permission-matrix.ts'));
if (/user\.(change-role|assign-office)/.test(readOnly)) {
  failures.push("'user.change-role' or 'user.assign-office' is classified read-only. Each changes who may use this console.");
}
if (
  !/path:\s*'users',[\s\S]{0,400}?canActivate:\s*\[servedGuard\('app-account',\s*'office'\),\s*permissionGuard\('user\.view'\)\]/.test(
    read(APP, 'app.routes.ts'),
  )
) {
  failures.push("The /users route does not ask for servedGuard('app-account', 'office') and permissionGuard('user.view').");
}
if (!/route:\s*'\/users',[\s\S]{0,120}permissions:\s*\['user\.view'\]/.test(read(APP, 'core', 'navigation', 'navigation.ts'))) {
  failures.push("The menu's Users and roles entry does not ask for 'user.view'.");
}

/* ── 8. the office role: effects first, a reason kept, never one's own ──── */

const rolePanelCode = code(read(ROLE_PANEL));
const roleTemplate = code(read(ROLE_TEMPLATE));

const roleOwn = roleTemplate.indexOf('@else if (own())');
const roleFieldset = roleTemplate.indexOf('<fieldset');
if (roleOwn === -1 || roleFieldset === -1 || roleOwn > roleFieldset) {
  failures.push("The office role form is offered before asking whether it is the reader's own account.");
}
if (!/this\s*\.\s*own\(\)/.test(methodBody(rolePanelCode, 'save'))) {
  failures.push("AccountOfficeRole.save no longer refuses the reader's own account.");
}

const officeRoleChoice = roleTemplate.indexOf('@if (chosen(); as choice)');
const roleEffectsAt = roleTemplate.indexOf('effects.', officeRoleChoice);
const roleAlwaysAt = roleTemplate.indexOf('of always', officeRoleChoice);
const roleReason = roleTemplate.indexOf('<textarea', officeRoleChoice);
const officeRoleButton = roleTemplate.indexOf('(click)="save()"');
if (
  officeRoleChoice === -1 ||
  roleEffectsAt === -1 ||
  roleAlwaysAt === -1 ||
  roleReason === -1 ||
  officeRoleButton === -1 ||
  !(officeRoleChoice < roleEffectsAt && roleEffectsAt < roleReason && roleAlwaysAt < roleReason && roleReason < officeRoleButton) ||
  [...roleTemplate.matchAll(/save\(\)/g)].length !== 1
) {
  failures.push("The office role's effects and reason no longer come between the choice and the one button that makes it.");
}

if (!/\n\s+assignOfficeRole\(id: AppAccountId, change: OfficeRoleChange\): Observable<AppAccount>;/.test(ports)) {
  failures.push('AppAccountRepository.assignOfficeRole no longer takes the change, reason included.');
}
if (
  !/this\s*\.\s*api\s*\.\s*patch\(\s*`\$\{API_ENDPOINTS\.adminUsers\}\/\$\{id\}\/office-role`\s*,\s*toWireOfficeRoleChange\(change\)\s*\)/.test(
    httpAccounts,
  )
) {
  failures.push('HttpAppAccountRepository must send the office role through toWireOfficeRoleChange to office-role.');
}

const assignableAt = domain.indexOf('export const ASSIGNABLE_OFFICE_ROLES');
const assignable = assignableAt === -1 ? '' : domain.slice(assignableAt, domain.indexOf('];', assignableAt));
if (assignable === '' || assignable.includes("'system-administrator'")) {
  failures.push('ASSIGNABLE_OFFICE_ROLES offers the system administrator, which is the administrator account role.');
}
if (!/keeps your reason/.test(domain.slice(domain.indexOf('export const OFFICE_ROLE_ALWAYS')))) {
  failures.push('OFFICE_ROLE_ALWAYS no longer says the server keeps the reason it asks for.');
}

/* ── 9. a checked name: corrected against an ID seen, never one's own ────── */

const namePanelCode = existsSync(NAME_PANEL) ? code(read(NAME_PANEL)) : '';
const nameTemplate = existsSync(NAME_TEMPLATE) ? code(read(NAME_TEMPLATE)) : '';
if (namePanelCode === '' || nameTemplate === '') {
  failures.push('AccountNameCorrection is missing, so a verified name has no route to change (DL-198).');
} else {
  const nameOwn = nameTemplate.indexOf('@if (own())');
  const nameField = nameTemplate.indexOf('id="account-name-correction-name"');
  if (nameOwn === -1 || nameField === -1 || nameOwn > nameField) {
    failures.push("The name correction's field is offered before asking whether it is the reader's own account.");
  }
  if (!/this\s*\.\s*own\s*\(\s*\)/.test(methodBody(namePanelCode, 'save'))) {
    failures.push("AccountNameCorrection.save no longer refuses the reader's own account.");
  }
  if (
    !/applies\s*=\s*computed\(\s*\(\)\s*=>\s*hasCheckedName\s*\(/.test(namePanelCode) ||
    !/canCorrect\s*=\s*this\s*\.\s*permissions\s*\.\s*can\s*\(\s*'verification\.review'\s*\)/.test(namePanelCode)
  ) {
    failures.push('The name correction is not confined to a verified account and a reader who reviews IDs.');
  }
  const nameEffects = nameTemplate.indexOf('of effects');
  const nameStatement = nameTemplate.indexOf('type="checkbox"');
  const nameButton = nameTemplate.indexOf('(click)="save()"');
  if (
    nameField === -1 ||
    nameEffects === -1 ||
    nameStatement === -1 ||
    nameButton === -1 ||
    !(nameField < nameEffects && nameEffects < nameStatement && nameStatement < nameButton) ||
    [...nameTemplate.matchAll(/save\(\)/g)].length !== 1
  ) {
    failures.push("The name correction's effects and statement no longer come before the one button that makes it.");
  }
  if (
    !/\[disabled\]="!ready\(\)"/.test(nameTemplate) ||
    !/ready\s*=\s*computed\([\s\S]*?this\s*\.\s*seen\s*\(\s*\)[\s\S]*?\);/.test(namePanelCode)
  ) {
    failures.push('The name correction button no longer waits for the statement that an ID was seen.');
  }
  if (/<textarea/.test(nameTemplate)) {
    failures.push('The name correction asks for a reason the server does not keep (DL-168, DL-198).');
  }
}
const nameEffectsAt = domain.indexOf('export const NAME_CORRECTION_EFFECTS');
const nameEffectsText = nameEffectsAt === -1 ? '' : domain.slice(nameEffectsAt, domain.indexOf('];', nameEffectsAt));
if (!/earlier name is kept/.test(nameEffectsText) || !/keeps no reason/.test(nameEffectsText)) {
  failures.push('NAME_CORRECTION_EFFECTS no longer says the earlier name is kept and no reason is.');
}
if (!/\n\s+correctName\(id: AppAccountId, correction: NameCorrection\): Observable<AppAccount>;/.test(ports)) {
  failures.push('AppAccountRepository.correctName no longer takes a NameCorrection, the name shown included.');
}
if (
  !/this\s*\.\s*api\s*\.\s*post\(\s*`\$\{API_ENDPOINTS\.adminUsers\}\/\$\{id\}\/name-corrections`\s*,\s*\{[\s\S]*?previous_name:\s*correction\s*\.\s*previousName,\s*id_checked:\s*true,?\s*\}/.test(
    httpAccounts,
  )
) {
  failures.push('HttpAppAccountRepository must post the correction to name-corrections with the name shown and id_checked.');
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nAccounts check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Accounts check passed (${moduleFiles.length} files: the minimum shown, effects before every button, ` +
      'no reason collected but for the office role, which keeps it; not one’s own role; the keys the administrator’s; ' +
      'a checked name corrected only against an ID seen).',
  );
}
