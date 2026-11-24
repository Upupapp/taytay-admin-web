#!/usr/bin/env node
/**
 * check:directory — the residents' app directory says what an act does, before it is done, and
 * never mistakes a Tulong page for a programme (`DL-170`).
 *
 * Every act on this screen changes what every resident of the municipality reads in the app: an
 * office leaves the directory, an emergency number changes, a page disappears from the catalogue.
 * Each of these is easy to erode one convenient shortcut at a time, so:
 *
 * ## Residents see it, and are said to
 *
 *   1. The page's title block says "Residents see this in the Taytay app".
 *
 * ## What an act does, before it is done
 *
 *   2. In each form (office, Tulong page, hotline) the effects come before the submit button, and the
 *      Tulong picture's effects before the upload button.
 *   3. Nothing is deleted (`DL-225`). In each section an archive or a restore is reachable only
 *      through its confirmation: the repository's `archive` and `restore` are each called once, in
 *      `confirmMove` alone; `confirmMove` is reached only from the shared `<app-archive-dialog>`'s
 *      `(confirmed)`, which is handed the domain's effects (the dialog itself shows them before its
 *      button, `check:archive`); no section calls a `remove`, and none draws a destructive
 *      `.btn--danger*` button — archiving is undone by a restore.
 *   4. The effects say the things somebody would regret not being told: archiving an office is
 *      refused while anything still uses it, and an archived record can be restored; restoring a
 *      Tulong page is refused while its office is archived; hiding a page keeps it in this list;
 *      restoring a hotline can be refused for a second command center, and archiving the command
 *      center says first that the app will have none.
 *
 * ## Not a programme
 *
 *   5. Nothing in the directory's domain, mappers, mock, seed or screens names `Program`,
 *      `PROGRAM_REPOSITORY` or an eligibility guideline, and the programmes module names no Tulong
 *      type (`DL-164`). One read is allowed, and only as written: the services section's
 *      `inject(PROGRAM_REPOSITORY).listActive()`, the picker for the programme a page applies to
 *      (`DL-228`, the API's ADR 0004 decision 2) — a reference to a programme, never one.
 *
 * ## Images
 *
 *   6. No directory model carries an image address, no mapper reads `hero_url`, and no directory
 *      template draws an `<img>`: a picture is said as present or absent, and previewed only by the
 *      shared field from bytes the reader chose.
 *   7. The only file input in any feature is the shared `ImageFileField`, which refuses through
 *      `imageRefusalFor` before it emits; `APP_IMAGE_POLICY` is the API's five megabytes and three
 *      types.
 *
 * ## The list is not presented as the whole when it may not be
 *
 *   8. Each list is read whole from the administrator's own endpoint, or refused: the offices, the
 *      Tulong pages — hidden ones included, which the residents' `GET services` left out — and the
 *      hotlines come from `admin/…` through `list`, never from a public cursor page; and nothing
 *      says a list "may be incomplete" any more, because since `ca71f23` the API refuses a list past
 *      its cap (`LIST_TOO_LONG`) instead of cutting it short — a capped warning would now be false.
 *
 * ## Nothing logged or stored, and the server's keys
 *
 *   9. No `console`, web storage or cookie in the module.
 *  10. `office.manage`, `service.manage` and `hotline.manage` are in `PERMISSIONS`, named by no role,
 *      not classified read-only, and asked for by the route and the menu entry.
 *
 * ## What a hotline is for (`DL-217`)
 *
 *  11. `HOTLINE_KINDS` is exactly the vendored spec's `HotlineKind`, each kind in words; the mapper
 *      reads a kind only through `isHotlineKind` and never stands `other` in for one it does not
 *      know; a new line's kind is sent, not left to the server's default, and a change of kind is
 *      sent; the form offers every kind from the list, explains the command center beside it, warns
 *      before its button when another line holds the role (a warning, never a disabled button), and
 *      puts the server's 409 `CONFLICT` beside the kind (`aria-invalid`, `aria-describedby`), which
 *      the adapter and the mock raise as the domain's refusal — on a save and on a restore, and on
 *      that code alone, because a hotline's other 409s are the archive's (`DL-225`); the list shows the kind as words; and the section
 *      says plainly when no line is marked as the command center.
 *
 *      Since `DL-220` an **absent** kind is not set rather than unreadable — the console tolerates an
 *      API older than kinds — and the rule holds that from both sides: the mapper reads absence as
 *      `null` and an unknown value as unreadable, never as `other`; the list says "Type not set" in
 *      words and how many lines have none; and the form offers "not set" only while it is, and sends
 *      no kind for a line nobody gave one.
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

const FEATURE = join(APP, 'features', 'directory');
const DOMAIN = join(APP, 'domain', 'directory');
const POLICY = join(APP, 'domain', 'media', 'image-policy.ts');
const FIELD = join(APP, 'shared', 'media', 'image-file-field.ts');
const MAPPERS = ['directory-office.mapper.ts', 'tulong-service.mapper.ts', 'hotline.mapper.ts'].map(
  (file) => join(APP, 'data', 'http', 'mappers', file),
);
const MOCK = join(APP, 'data', 'mock', 'mock-directory.repositories.ts');
const SEED = join(APP, 'data', 'mock', 'seed', 'directory.seed.ts');
const ADAPTERS = join(APP, 'data', 'http', 'http-repositories.ts');

const FORMS = ['office-form.html', 'service-form.html', 'hotline-form.html'].map((f) => join(FEATURE, f));
const SECTIONS = ['offices-section', 'services-section', 'hotlines-section'];

for (const file of [FEATURE, DOMAIN, POLICY, FIELD, ...MAPPERS, MOCK, SEED, ...FORMS]) {
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
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?(?:async )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const moduleFiles = [...walk(FEATURE), ...walk(DOMAIN), ...MAPPERS, MOCK, SEED];

/* ── 1. residents see it ─────────────────────────────────────────────────── */

const copy = read(FEATURE, 'directory.copy.ts');
const pageCopy = copy.slice(copy.indexOf('page: {'), copy.indexOf('list: {'));
if (!/subtitle:\s*\n?\s*'Residents see this in the Taytay app/.test(pageCopy)) {
  failures.push('The directory page no longer opens by saying residents see it in the Taytay app.');
}
// The page's description is not drawn (DL-246); this sentence is, as the header's lead.
if (!/\[lead\]="copy\.subtitle"/.test(code(read(FEATURE, 'directory-page.html')))) {
  failures.push('The directory page header no longer shows the sentence saying residents see it.');
}

/* ── 2. effects before every button ──────────────────────────────────────── */

for (const form of FORMS) {
  const template = code(readFileSync(form, 'utf8'));
  const effects = template.indexOf('@for (effect of effects()');
  const submit = template.indexOf('type="submit"');
  if (effects === -1 || submit === -1 || effects > submit || [...template.matchAll(/type="submit"/g)].length !== 1) {
    failures.push(`${shown(form)}: the effects no longer come before the one button that saves.`);
  }
}
{
  const template = code(read(FEATURE, 'service-form.html'));
  const effects = template.indexOf('@for (effect of imageEffects()');
  const upload = template.indexOf('(click)="uploadImage()"');
  if (effects === -1 || upload === -1 || effects > upload) {
    failures.push("service-form.html: the picture's effects no longer come before the button that uploads it.");
  }
}

/* ── 3. archive and restore only through their confirmation (DL-225) ─────── */

for (const section of SECTIONS) {
  const source = code(read(FEATURE, `${section}.ts`));
  const template = code(read(FEATURE, `${section}.html`));
  const move = methodBody(source, 'confirmMove');
  for (const act of ['archive', 'restore']) {
    const call = new RegExp(`this\\s*\\.\\s*repository\\s*\\.\\s*${act}\\s*\\(`, 'g');
    const calls = [...source.matchAll(call)].length;
    if (calls !== 1 || !new RegExp(call.source).test(move)) {
      failures.push(`${section}.ts: ${act} is called somewhere other than confirmMove, after the confirmation.`);
    }
  }
  if (/this\s*\.\s*repository\s*\.\s*remove\s*\(/.test(source)) {
    failures.push(`${section}.ts removes a record. Nothing in the directory is deleted: it is archived (DL-225).`);
  }
  const dialogAt = template.indexOf('<app-archive-dialog');
  const dialog = dialogAt === -1 ? '' : template.slice(dialogAt, template.indexOf('/>', dialogAt));
  if (
    !/\(confirmed\)="confirmMove\(\$event\)"/.test(dialog) ||
    !/\[effects\]="[^"]*archiveEffects[^"]*restoreEffects[^"]*"/.test(dialog) ||
    [...template.matchAll(/confirmMove\(/g)].length !== 1
  ) {
    failures.push(
      `${section}.html: an archive or a restore no longer goes through the archive dialog with its effects.`,
    );
  }
  if (/btn--danger/.test(template)) {
    failures.push(
      `${section}.html draws a destructive button. Archiving is reversible: a row's Archive and Restore ` +
        'are plain .btn, the dialog confirms with .btn--primary (DL-225).',
    );
  }
}

/* ── 4. the consequences somebody would regret not being told ─────────────── */

const effectsIn = (text, name, key) =>
  new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\],`).exec(text.slice(text.indexOf(name)))?.[1] ?? '';
const office = code(read(DOMAIN, 'directory-office.ts'));
if (
  !/refuses while anything still uses it/.test(effectsIn(office, 'OFFICE_EFFECTS', 'archive')) ||
  !/can be restored/.test(effectsIn(office, 'OFFICE_EFFECTS', 'archive'))
) {
  failures.push('OFFICE_EFFECTS.archive no longer says the server refuses while the office is used, or that it can be restored.');
}
const service = code(read(DOMAIN, 'tulong-service.ts'));
if (!/stays in this list/.test(effectsIn(service, 'SERVICE_EFFECTS', 'hide'))) {
  failures.push('SERVICE_EFFECTS.hide no longer says a hidden page stays in this list.');
}
if (!/office is archived/.test(effectsIn(service, 'SERVICE_EFFECTS', 'restore'))) {
  failures.push("SERVICE_EFFECTS.restore no longer says a restore is refused while the page's office is archived.");
}
const hotline = code(read(DOMAIN, 'hotline.ts'));
if (!/can be restored/.test(effectsIn(hotline, 'HOTLINE_EFFECTS', 'archive'))) {
  failures.push('HOTLINE_EFFECTS.archive no longer says the line can be restored.');
}
if (!/command center/.test(effectsIn(hotline, 'HOTLINE_EFFECTS', 'restore'))) {
  failures.push('HOTLINE_EFFECTS.restore no longer says a restore can be refused for a second command center.');
}
if (!/COMMAND_CENTER_EFFECTS\s*\.\s*leaves\s*,\s*\.\.\.\s*HOTLINE_EFFECTS\s*\.\s*archive/.test(code(read(FEATURE, 'hotlines-section.ts')))) {
  failures.push('Archiving the command center no longer says first that the app will have none (DL-217).');
}

/* ── 5. not a programme ──────────────────────────────────────────────────── */

const PROGRAMME = /\b(Program|ProgramRepository|PROGRAM_REPOSITORY|EligibilityGuideline|ProgramResponsibility)\b/;
/** The one read `DL-228` allows: the services section's picker of active programmes. */
const PROGRAMME_PICKER = { file: join(APP, 'features', 'directory', 'services-section.ts'), read: 'inject(PROGRAM_REPOSITORY).listActive()' };
for (const file of moduleFiles) {
  let text = code(readFileSync(file, 'utf8'));
  if (file === PROGRAMME_PICKER.file) {
    // The import of the token, and the one read; any other mention still fails.
    text = text.split(PROGRAMME_PICKER.read).join('').replace(/^\s*PROGRAM_REPOSITORY,\s*$/m, '');
  }
  const found = PROGRAMME.exec(text);
  if (found !== null) {
    failures.push(`${shown(file)} names ${found[1]}. A Tulong page is information for residents, not a programme (DL-164).`);
  }
}
for (const dir of [join(APP, 'features', 'programs'), join(APP, 'domain', 'programs')]) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (/\bTulongService\w*\b/.test(code(readFileSync(file, 'utf8')))) {
      failures.push(`${shown(file)} names a Tulong type. A programme is not an information page (DL-164).`);
    }
  }
}

/* ── 6. no image address ─────────────────────────────────────────────────── */

for (const file of walk(DOMAIN)) {
  const found = /\b(\w*(?:[Uu]rl|[Hh]ref|[Ss]rc))\??\s*:/.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} carries ${found[1]}. A picture is said as present or absent.`);
}
for (const file of MAPPERS) {
  if (/field\(wire,\s*'(hero_url|image_url)'\)/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(`${shown(file)} reads an image address. A template bound to it would load from the API's host.`);
  }
}
for (const file of walk(FEATURE).filter((f) => f.endsWith('.html'))) {
  if (/<img\b/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(`${shown(file)} draws an image. Only the shared image field previews what the reader chose.`);
  }
}

/* ── 7. every file through the policy ────────────────────────────────────── */

for (const file of walk(join(APP, 'features'))) {
  if (/type="file"/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(`${shown(file)} has its own file input. Images are chosen through ImageFileField, which refuses first.`);
  }
}
const field = code(readFileSync(FIELD, 'utf8'));
const choose = methodBody(field, 'choose');
const refusal = choose.indexOf('imageRefusalFor(');
const emitted = choose.indexOf('this.chosen.emit(file)');
if (refusal === -1 || emitted === -1 || refusal > emitted || !/if \(refusal !== null\)[\s\S]*?return;/.test(choose)) {
  failures.push('ImageFileField no longer refuses a file through imageRefusalFor before handing it on.');
}
const policy = code(readFileSync(POLICY, 'utf8'));
if (
  !/maxBytes:\s*5\s*\*\s*1024\s*\*\s*1024/.test(policy) ||
  !/mimeTypes:\s*\['image\/jpeg',\s*'image\/png',\s*'image\/webp'\]/.test(policy)
) {
  failures.push("APP_IMAGE_POLICY is no longer the API's five megabytes of JPEG, PNG or WebP.");
}

/* ── 8. a whole list from the administrator's own endpoint, or none ───────── */

const adapters = code(readFileSync(ADAPTERS, 'utf8'));
const hotlines = block(adapters, adapters.indexOf('export class HttpHotlineRepository'));
const WHOLE = {
  HttpDirectoryOfficeRepository: 'adminOffices',
  HttpTulongServiceRepository: 'adminServices',
  HttpHotlineRepository: 'adminHotlines',
};
for (const [adapter, endpoint] of Object.entries(WHOLE)) {
  const body = block(adapters, adapters.indexOf(`export class ${adapter}`));
  const list = /\n\s+list\([^)]*\)[^{]*\{([\s\S]*?)\n\s{2}\}/.exec(body)?.[1] ?? '';
  if (
    !new RegExp(`this\\s*\\.\\s*api\\s*\\.\\s*list\\(\\s*API_ENDPOINTS\\s*\\.\\s*${endpoint}\\b`).test(list) ||
    /cursorPage|API_ENDPOINTS\s*\.\s*(?:offices|services)\b/.test(body)
  ) {
    failures.push(
      `${adapter} no longer reads its list whole from API_ENDPOINTS.${endpoint}. A public page leaves ` +
        'archived records out and, for Tulong pages, hidden ones too (DL-225).',
    );
  }
}
for (const file of [...moduleFiles, ADAPTERS, join(APP, 'domain', 'ports', 'repositories.ts')]) {
  if (/\bmayBeIncomplete\b/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(
      `${shown(file)} says a list may be incomplete. Since ca71f23 the API refuses a list past its cap ` +
        '(LIST_TOO_LONG) rather than cutting it short, so a list it answers is whole.',
    );
  }
}

/* ── 9. no log, no storage ───────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group))\b/;
for (const file of [...moduleFiles, FIELD, POLICY]) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing in the directory is logged or stored.`);
}

/* ── 10. the server's keys ───────────────────────────────────────────────── */

const KEYS = ['office.manage', 'service.manage', 'hotline.manage'];
const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
// Everything after the vocabulary: the role definitions and the shared lists they spread, which a
// slice from ROLE_DEFINITIONS would miss (INTAKE_PERMISSIONS is declared above it).
const roles = permission.slice(permission.indexOf('] as const;'));
const readOnly = code(read(APP, 'domain', 'access', 'permission-matrix.ts'));
for (const key of KEYS) {
  if (!vocabulary.includes(`'${key}'`)) failures.push(`PERMISSIONS does not hold '${key}', the API's own key.`);
  if (roles.includes(`'${key}'`)) failures.push(`A role lists '${key}' by name. The API grants it to administrators alone.`);
  if (readOnly.includes(key)) failures.push(`'${key}' is classified read-only. It changes what every resident reads.`);
}
const keyList = KEYS.map((key) => `'${key.replace('.', '\\.')}'`).join(',\\s*');
if (
  !new RegExp(`path:\\s*'directory',[\\s\\S]{0,500}?permissionGuard\\(${keyList}\\)`).test(read(APP, 'app.routes.ts'))
) {
  failures.push('The /directory route does not ask for the three directory keys.');
}
if (
  !new RegExp(`route:\\s*'/directory',[\\s\\S]{0,200}?permissions:\\s*\\[${keyList}\\]`).test(
    read(APP, 'core', 'navigation', 'navigation.ts'),
  )
) {
  failures.push("The menu's App directory entry does not ask for the three directory keys.");
}
const page = code(read(FEATURE, 'directory-page.ts'));
for (const key of KEYS) {
  if (!page.includes(`permission: '${key}'`)) {
    failures.push(`The directory page no longer offers a section only to a holder of '${key}'.`);
  }
}

/* ── 11. what a hotline is for (DL-217) ─────────────────────────────────── */

const hotlineDomain = code(read(DOMAIN, 'hotline.ts'));
const spec = JSON.parse(read(APP, 'data', 'http', 'contract', 'openapi.json'));
const specKinds = spec.components?.schemas?.HotlineKind?.enum ?? [];
const kindList = /export const HOTLINE_KINDS = \[([\s\S]*?)\] as const;/.exec(hotlineDomain)?.[1] ?? '';
const domainKinds = [...kindList.matchAll(/'([^']+)'/g)].map((match) => match[1]);
if (specKinds.length === 0 || domainKinds.join() !== specKinds.join()) {
  failures.push(
    `HOTLINE_KINDS (${domainKinds.join(', ')}) is not the spec's HotlineKind (${specKinds.join(', ')}). A kind the API sends and the console does not know makes the list unreadable; one it does not send is refused.`,
  );
}
const labels = block(hotlineDomain, hotlineDomain.indexOf('export const HOTLINE_KIND_LABELS'));
for (const kind of specKinds) {
  if (!new RegExp(`'?${kind}'?:\\s*'[^']+'`).test(labels)) failures.push(`HOTLINE_KIND_LABELS has no words for ${kind}.`);
}

const hotlineMapper = code(read(APP, 'data', 'http', 'mappers', 'hotline.mapper.ts'));
if (
  !/const kind = kindOf\(field\(wire, 'kind'\)\)/.test(hotlineMapper) ||
  !/return isHotlineKind\(value\) \? value : undefined;/.test(hotlineMapper) ||
  !/kind === undefined \|\|/.test(hotlineMapper) ||
  /'other'/.test(hotlineMapper)
) {
  failures.push("The hotline mapper no longer reads a kind strictly. An unknown kind read as 'other' hides a command center.");
}
if (!/if \(value === undefined \|\| value === null \|\| value === ''\) \{\s*return null;\s*\}/.test(hotlineMapper)) {
  failures.push('The hotline mapper no longer reads an absent kind as not set (DL-220): an older API would empty the list.');
}
const created = block(hotlines, hotlines.indexOf('create(draft'));
const updated = block(hotlines, hotlines.indexOf('update(id'));
if (!/kind:\s*draft\.kind/.test(created) || !/kind:\s*changes\.kind/.test(updated)) {
  failures.push("HttpHotlineRepository no longer sends a line's kind: a new line's is chosen, never the server's default.");
}
const restored = block(hotlines, hotlines.indexOf('restore(id'));
if (
  [created, updated, restored].some((body) => !/catchError\(withCommandCenterRefusal\)/.test(body)) ||
  !/read\s*\.\s*status === 409 && read\s*\.\s*code === 'CONFLICT'\)\s*\{\s*return throwError\(\(\) => new HotlineCommandCenterTakenError\(\s*read\s*\.\s*message\s*\)\)/.test(adapters)
) {
  failures.push("HttpHotlineRepository no longer hands a second command center back as the domain's refusal, in the server's words.");
}
if (!/HotlineCommandCenterTakenError\(/.test(code(readFileSync(MOCK, 'utf8')))) {
  failures.push('The mock no longer refuses a second active command center as the server does.');
}

const formTemplate = code(read(FEATURE, 'hotline-form.html'));
const formClass = code(read(FEATURE, 'hotline-form.ts'));
const kindSelect = formTemplate.slice(formTemplate.indexOf('<select'), formTemplate.indexOf('</select>'));
if (
  !/id="hotline-kind"/.test(kindSelect) ||
  !/@for \(option of kinds; track option\)/.test(kindSelect) ||
  !/\{\{\s*kindLabels\[option\]\s*\}\}/.test(kindSelect) ||
  !/kinds = HOTLINE_KINDS/.test(formClass)
) {
  failures.push('The hotline form no longer offers every kind, in words, from HOTLINE_KINDS.');
}
if (
  !/\[attr\s*\.\s*aria-describedby\]="kindDescribedBy\(\)"/.test(kindSelect) ||
  !/\[attr\s*\.\s*aria-invalid\]="kindRefused\(\) === '' \? null : 'true'"/.test(kindSelect) ||
  !/class="field__error" id="hotline-kind-error"/.test(formTemplate) ||
  !/'hotline-kind-error'/.test(
    formClass.slice(formClass.indexOf('protected readonly kindDescribedBy')).slice(0, 400),
  )
) {
  failures.push("The kind no longer names its error: the server's refusal of a second command center goes beside it.");
}
if (!/isCommandCenterTaken\(failure\)\)\s*\{\s*this\s*\.\s*kindRefused\s*\.\s*set\(/.test(formClass)) {
  failures.push("The hotline form no longer puts the server's refusal of a second command center on the kind.");
}
const directoryCopy = read(FEATURE, 'directory.copy.ts').replace(/'\s*\+\s*'/g, '');
if (
  !/kindHint:[\s\S]{0,200}Command center is the one line the app shows when it tells residents to call for an emergency; only one active line can be it/.test(directoryCopy) ||
  !/\{\{\s*copy\s*\.\s*kindHint\s*\}\}/.test(formTemplate)
) {
  failures.push('The hotline form no longer explains the command center beside the kind.');
}
const takenAt = formTemplate.search(/@if \(takenWarning\(\)\s*\.\s*length > 0\)/);
const submitAt = formTemplate.indexOf('type="submit"');
if (
  takenAt === -1 ||
  !(takenAt < submitAt) ||
  !/commandCenterHolder\(/.test(
    formClass.slice(formClass.indexOf('protected readonly commandCenterTaken')).slice(0, 300),
  ) ||
  !/only one active line can be\. The server will refuse this until/.test(hotlineDomain.replace(/['`]\s*\+\s*['`]/g, ''))
) {
  failures.push('The hotline form no longer warns, before its button, that another line holds the command center.');
}
const submitTag = formTemplate.slice(submitAt, formTemplate.indexOf('>', submitAt));
if (/command|taken|kind/i.test(submitTag)) {
  failures.push("The hotline form's button is held by the command center. It warns; the server decides.");
}

const sectionTemplate = code(read(FEATURE, 'hotlines-section.html'));
const sectionClass = code(read(FEATURE, 'hotlines-section.ts'));
if (
  !/key:\s*'kind',[\s\S]{0,80}value:\s*\(hotline\)\s*=>\s*hotlineKindLabel\(hotline\s*\.\s*kind\)/.test(sectionClass) ||
  !/export const HOTLINE_KIND_NOT_SET = 'Type not set';/.test(hotlineDomain) ||
  !/return kind === null \? HOTLINE_KIND_NOT_SET : HOTLINE_KIND_LABELS\[kind\];/.test(hotlineDomain)
) {
  failures.push("The hotline list no longer shows each line's kind as words, or a kind not set as “Type not set” (DL-220).");
}
if (
  !/linesWithoutKind\(\s*this\s*\.\s*rows\(\)\s*\)/.test(sectionClass) ||
  !/copy\s*\.\s*kindsNotSet\(withoutKind\(\)\)/.test(sectionTemplate)
) {
  failures.push('The hotlines section no longer says how many lines have no type set (DL-220).');
}
if (
  !/@if \(kind\(\) === null\) \{\s*<option value="" selected disabled>\{\{\s*copy\s*\.\s*kindNotSet\s*\}\}<\/option>/.test(formTemplate) ||
  !/if \(draft\s*\.\s*kind !== null && draft\s*\.\s*kind !== hotline\s*\.\s*kind\) changes\s*\.\s*kind = draft\s*\.\s*kind;/.test(formClass) ||
  /\?\?\s*'other'/.test(formClass)
) {
  failures.push('The hotline form no longer keeps a kind not set as not set: it offers it, and sends no kind nobody chose (DL-220).');
}
if (
  !/@if \(commandCenter\(\); as center\)[\s\S]{0,200}\}\s*@else\s*\{\s*<p[^>]*>[\s\S]{0,120}copy\s*\.\s*noCommandCenterTitle/.test(sectionTemplate) ||
  !/noCommandCenterTitle:\s*'No line is marked as the command center\.'/.test(directoryCopy) ||
  !/activeCommandCenter\(\s*this\s*\.\s*rows\(\)\s*\)/.test(sectionClass)
) {
  failures.push('The hotlines section no longer says plainly when no line is marked as the command center.');
}
if (!/\[commandCenter\]="commandCenter\(\)"/.test(sectionTemplate)) {
  failures.push('The hotline form is no longer told which line is the command center, so it cannot warn.');
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nDirectory check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Directory check passed (${moduleFiles.length} files: residents told, effects before every button, ` +
      'nothing deleted — archived and restored only through a confirmation with its effects, no ' +
      'destructive button — not a programme, no image address, every file refused first, each list ' +
      'whole from its admin endpoint, the keys the administrator’s; every kind the API’s, in words, read ' +
      'strictly, the one command center explained and warned about before the button, its refusal ' +
      'beside the kind, and none said plainly).',
  );
}
