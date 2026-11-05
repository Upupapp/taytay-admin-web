#!/usr/bin/env node
/**
 * check:home — the residents' app home screen says what an act does before it is done, and never
 * collects a description of a banner's image that the API would drop (`DL-170`).
 *
 * ## Residents see it, and are said to
 *
 *   1. The page's title block says "Residents see this in the Taytay app".
 *
 * ## What an act does, before it is done
 *
 *   2. In the banner and link forms the effects come before the one submit button.
 *   3. A banner or a link is deleted only in `confirmRemove`, after a modal whose effects come before
 *      its button.
 *   4. The effects still say what somebody would regret not being told: an image is stored before
 *      the banner and stays if the banner is refused; a replaced or deleted banner's image stays
 *      stored; deleting a banner offers hiding it instead; every link is shown.
 *
 * ## No description the API drops (`DL-125`)
 *
 *   5. Neither `HomeBanner` nor `BannerDraft` has an alt text, description or caption; the mapper
 *      reads none; no banner body sends one; the banner form has no free-text box for one; and the
 *      banners section and the banner form both say the API keeps none.
 *
 * ## Images through the data layer
 *
 *   6. The mapper reads no `image_url`; every `<img>` in the module binds a template variable, never a
 *      field of a record; each component that shows one holds `ObjectUrls` and gives them back on
 *      destroy.
 *
 * ## Nothing logged or stored, and the server's key
 *
 *   7. No `console`, web storage or cookie in the module.
 *   8. `home.manage` is in `PERMISSIONS`, named by no role, not read-only, and asked for by the route
 *      and the menu entry.
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

const FEATURE = join(APP, 'features', 'home-screen');
const DOMAIN = join(APP, 'domain', 'home', 'home-screen.ts');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'home.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-home-screen.repository.ts');
const SEED = join(APP, 'data', 'mock', 'seed', 'home.seed.ts');
const ADAPTERS = join(APP, 'data', 'http', 'http-repositories.ts');

for (const file of [FEATURE, DOMAIN, MAPPER, MOCK, SEED]) {
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

const moduleFiles = [...walk(FEATURE), DOMAIN, MAPPER, MOCK, SEED];
const domain = code(read(DOMAIN));

/* ── 1. residents see it ─────────────────────────────────────────────────── */

const copy = read(FEATURE, 'home-screen.copy.ts');
if (!/subtitle:\s*\n?\s*'Residents see this in the Taytay app/.test(copy.slice(0, copy.indexOf('common:')))) {
  failures.push('The home screen page no longer opens by saying residents see it in the Taytay app.');
}
if (!/\[subtitle\]="copy\.subtitle"/.test(code(read(FEATURE, 'home-screen-page.html')))) {
  failures.push('The home screen page header no longer shows the sentence saying residents see it.');
}

/* ── 2. effects before each form's button ────────────────────────────────── */

for (const form of ['banner-form.html', 'link-form.html']) {
  const template = code(read(FEATURE, form));
  const effects = template.indexOf('@for (effect of effects()');
  const submit = template.indexOf('type="submit"');
  if (effects === -1 || submit === -1 || effects > submit || [...template.matchAll(/type="submit"/g)].length !== 1) {
    failures.push(`${form}: the effects no longer come before the one button that saves.`);
  }
}

/* ── 3. a delete only through its confirmation ───────────────────────────── */

for (const [section, remove] of [
  ['banners-section', 'removeBanner'],
  ['links-section', 'removeLink'],
]) {
  const source = code(read(FEATURE, `${section}.ts`));
  const template = code(read(FEATURE, `${section}.html`));
  const pattern = new RegExp(`this\\s*\\.\\s*repository\\s*\\.\\s*${remove}\\s*\\(`, 'g');
  const calls = [...source.matchAll(pattern)].length;
  if (calls !== 1 || !new RegExp(pattern.source).test(methodBody(source, 'confirmRemove'))) {
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

const effectsOf = (key) => new RegExp(`\\n\\s+${key}:\\s*\\[([\\s\\S]*?)\\],`).exec(domain)?.[1] ?? '';
if (!/If the banner is then refused[\s\S]*stays stored/.test(effectsOf('imageUpload'))) {
  failures.push('HOME_EFFECTS.imageUpload no longer says an image stays stored if the banner is refused.');
}
if (!/stays stored/.test(effectsOf('imageReplaced')) || !/stays stored/.test(effectsOf('bannerRemove'))) {
  failures.push("HOME_EFFECTS no longer says a replaced or deleted banner's image stays stored.");
}
if (!/hide it instead/.test(effectsOf('bannerRemove'))) {
  failures.push('HOME_EFFECTS.bannerRemove no longer offers hiding the banner instead.');
}
if (!/no hidden[\s\S]*link/.test(effectsOf('linkCreate'))) {
  failures.push('HOME_EFFECTS.linkCreate no longer says every link is shown.');
}

/* ── 5. no description the API drops ─────────────────────────────────────── */

const DESCRIBED = /\b(\w*(?:alt|[Aa]lt[A-Z]\w*|description|caption|[Dd]escription|[Cc]aption))\??\s*:/;
for (const type of ['HomeBanner', 'BannerDraft']) {
  const model = block(domain, domain.search(new RegExp(`export interface ${type}\\b`)));
  const found = DESCRIBED.exec(model);
  if (model === '') failures.push(`${type} was not found in the home screen model.`);
  else if (found !== null) {
    failures.push(`${type} carries ${found[1]}. The API keeps no description of a banner's image (DL-125).`);
  }
}
if (/field\(wire,\s*'(alt\w*|description|caption)'\)/.test(code(read(MAPPER)))) {
  failures.push('The banner mapper reads a description the API does not send.');
}
const adapters = code(readFileSync(ADAPTERS, 'utf8'));
const homeAdapter = block(adapters, adapters.indexOf('export class HttpHomeScreenRepository'));
if (homeAdapter === '') failures.push('HttpHomeScreenRepository was not found, so it was not checked.');
if (/\b(alt\w*|description|caption)\s*:/.test(homeAdapter)) {
  failures.push('HttpHomeScreenRepository sends a description the API would drop.');
}
const bannerForm = code(read(FEATURE, 'banner-form.html'));
if (/<textarea\b/.test(bannerForm) || /description|alt text/i.test(bannerForm.replace(/noDescription/g, ''))) {
  failures.push('The banner form collects a description the API would drop. Say it keeps none instead.');
}
if (!/keeps none/.test(code(read(DOMAIN)).slice(code(read(DOMAIN)).indexOf('BANNER_NO_DESCRIPTION')))) {
  failures.push('BANNER_NO_DESCRIPTION no longer says the API keeps none.');
}
for (const file of ['banners-section.html', 'banner-form.html']) {
  if (!/\{\{\s*noDescription\s*\}\}/.test(code(read(FEATURE, file)))) {
    failures.push(`${file} no longer says the app has no description of a banner's image.`);
  }
}

/* ── 6. images through the data layer ────────────────────────────────────── */

if (/field\(wire,\s*'image_url'\)/.test(code(read(MAPPER)))) {
  failures.push("The banner mapper reads image_url. A template bound to it would load from the API's host.");
}
for (const file of walk(FEATURE).filter((f) => f.endsWith('.html'))) {
  const template = code(readFileSync(file, 'utf8'));
  for (const [tag] of template.matchAll(/<img\b[^>]*>/g)) {
    const source = /\[src\]="([^"]+)"/.exec(tag)?.[1];
    if (source === undefined || /[.(]/.test(source)) {
      failures.push(`${shown(file)} draws an image from ${source ?? 'a fixed address'}. Bytes come through the data layer.`);
    }
  }
  if (/<img\b/.test(template)) {
    const component = code(readFileSync(file.replace(/\.html$/, '.ts'), 'utf8'));
    if (!/new ObjectUrls\(\)/.test(component) || !/onDestroy\([\s\S]{0,80}revokeAll\(\)/.test(component)) {
      failures.push(`${shown(file)} shows an image without an ObjectUrls holder given back on destroy.`);
    }
  }
}

/* ── 7. no log, no storage ───────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing on the home screen is logged or stored.`);
}

/* ── 8. the server's key ─────────────────────────────────────────────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
// Everything after the vocabulary: the role definitions and the shared lists they spread.
const roles = permission.slice(permission.indexOf('] as const;'));
if (!vocabulary.includes("'home.manage'")) failures.push("PERMISSIONS does not hold 'home.manage', the API's own key.");
if (roles.includes("'home.manage'")) failures.push("A role lists 'home.manage' by name. The API grants it to administrators alone.");
if (code(read(APP, 'domain', 'access', 'permission-matrix.ts')).includes('home.manage')) {
  failures.push("'home.manage' is classified read-only. It changes the first screen every resident sees.");
}
if (
  !/path:\s*'home-screen',[\s\S]{0,300}?canActivate:\s*\[servedGuard\('home-screen'\),\s*permissionGuard\('home\.manage'\)\]/.test(
    read(APP, 'app.routes.ts'),
  )
) {
  failures.push("The /home-screen route does not ask for servedGuard('home-screen') and permissionGuard('home.manage').");
}
if (!/route:\s*'\/home-screen',[\s\S]{0,120}permissions:\s*\['home\.manage'\]/.test(read(APP, 'core', 'navigation', 'navigation.ts'))) {
  failures.push("The menu's Home screen entry does not ask for 'home.manage'.");
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nHome screen check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Home screen check passed (${moduleFiles.length} files: residents told, effects before every button, ` +
      'deletes only through a confirmation, no description the API drops, images through the data layer, ' +
      'the key the administrator’s).',
  );
}
