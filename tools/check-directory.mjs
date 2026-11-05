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
 *   3. In each section a delete is reachable only through its confirmation: the repository's
 *      `remove` is called in `confirmRemove` alone, and the modal lists the effects before the
 *      confirming button.
 *   4. The effects say the things somebody would regret not being told: deleting an office is
 *      refused while anything names it and nothing brings it back; hiding a page takes it out of
 *      this list too; deleting a hotline offers making it inactive instead.
 *
 * ## Not a programme
 *
 *   5. Nothing in the directory's domain, mappers, mock, seed or screens names `Program`,
 *      `PROGRAM_REPOSITORY` or an eligibility guideline, and the programmes module names no Tulong
 *      type (`DL-164`).
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
 *   8. The hotline adapter computes `mayBeIncomplete` from `HOTLINE_LIST_CAP`, and the section renders
 *      the capped sentence.
 *
 * ## Nothing logged or stored, and the server's keys
 *
 *   9. No `console`, web storage or cookie in the module.
 *  10. `office.manage`, `service.manage` and `hotline.manage` are in `PERMISSIONS`, named by no role,
 *      not classified read-only, and asked for by the route and the menu entry.
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
if (!/\[subtitle\]="copy\.subtitle"/.test(code(read(FEATURE, 'directory-page.html')))) {
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

/* ── 3. a delete only through its confirmation ───────────────────────────── */

for (const section of SECTIONS) {
  const source = code(read(FEATURE, `${section}.ts`));
  const template = code(read(FEATURE, `${section}.html`));
  const calls = [...source.matchAll(/this\s*\.\s*repository\s*\.\s*remove\s*\(/g)].length;
  if (calls !== 1 || !/this\s*\.\s*repository\s*\.\s*remove\s*\(/.test(methodBody(source, 'confirmRemove'))) {
    failures.push(`${section}.ts deletes somewhere other than confirmRemove, after the confirmation.`);
  }
  const modal = template.indexOf('<app-modal');
  const effects = template.indexOf('@for (effect of removeEffects', modal);
  const confirm = template.indexOf('(click)="confirmRemove()"', modal);
  if (modal === -1 || effects === -1 || confirm === -1 || effects > confirm) {
    failures.push(`${section}.html: the delete confirmation no longer lists what deleting does before its button.`);
  }
}

/* ── 4. the consequences somebody would regret not being told ─────────────── */

const office = code(read(DOMAIN, 'directory-office.ts'));
const officeRemove = /remove:\s*\[([\s\S]*?)\],/.exec(office.slice(office.indexOf('OFFICE_EFFECTS')))?.[1] ?? '';
if (!/refuses while anything still names/.test(officeRemove) || !/Nothing brings it back/.test(officeRemove)) {
  failures.push('OFFICE_EFFECTS.remove no longer says the server refuses while the office is named, or that nothing brings it back.');
}
const service = code(read(DOMAIN, 'tulong-service.ts'));
const hide = /hide:\s*\[([\s\S]*?)\],/.exec(service.slice(service.indexOf('SERVICE_EFFECTS')))?.[1] ?? '';
if (!/leaves this list/.test(hide)) {
  failures.push('SERVICE_EFFECTS.hide no longer says a hidden page leaves this list as well.');
}
const hotline = code(read(DOMAIN, 'hotline.ts'));
const hotlineRemove = /remove:\s*\[([\s\S]*?)\],/.exec(hotline.slice(hotline.indexOf('HOTLINE_EFFECTS')))?.[1] ?? '';
if (!/make it inactive instead/.test(hotlineRemove)) {
  failures.push('HOTLINE_EFFECTS.remove no longer offers making the line inactive instead.');
}

/* ── 5. not a programme ──────────────────────────────────────────────────── */

const PROGRAMME = /\b(Program|ProgramRepository|PROGRAM_REPOSITORY|EligibilityGuideline|ProgramResponsibility)\b/;
for (const file of moduleFiles) {
  const found = PROGRAMME.exec(code(readFileSync(file, 'utf8')));
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

/* ── 8. a capped list says so ────────────────────────────────────────────── */

const adapters = code(readFileSync(ADAPTERS, 'utf8'));
const hotlines = block(adapters, adapters.indexOf('export class HttpHotlineRepository'));
if (!/mayBeIncomplete:\s*items\.length\s*>=\s*HOTLINE_LIST_CAP/.test(hotlines)) {
  failures.push('HttpHotlineRepository no longer says a list as long as the cap may be incomplete.');
}
if (
  !/@if \(mayBeIncomplete\s*\(\s*\)\)[\s\S]{0,160}copy\s*\.\s*capped/.test(code(read(FEATURE, 'hotlines-section.html')))
) {
  failures.push('The hotlines section no longer says a capped list may be missing lines.');
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

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nDirectory check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Directory check passed (${moduleFiles.length} files: residents told, effects before every button, ` +
      'deletes only through a confirmation, not a programme, no image address, every file refused first, ' +
      'a capped list said so, the keys the administrator’s).',
  );
}
