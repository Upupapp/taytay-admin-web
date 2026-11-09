#!/usr/bin/env node
/**
 * check:balita — publishing goes outward and cannot be recalled from people who read it, so the
 * Balita screen says so before the button (`DL-171`), and it is the console's one news channel
 * (`DL-194`).
 *
 *   1. The page says residents read it in the Taytay app's Balita, and that it is the one news
 *      channel this console publishes to.
 *   2. One news channel. Until `DL-194` this rule kept Balita apart from the unserved newsfeed
 *      within the Balita module. The newsfeed was retired in Balita's favour, so the rule now holds
 *      the whole console: no newsfeed folder, port, token, data port, permission key, route or menu
 *      entry anywhere in `src/app` — a second news channel would publish posts no resident reads.
 *   3. Every publish button stands below the publishing effects; every "take it off" button below
 *      the unpublishing effects; the pin button below the pin effects.
 *   4. Every write leaves through `send`: the editor subscribes in `send` and `showCover` only.
 *   5. The effects say publishing cannot be recalled and sends no notification, and taking an
 *      article off leaves what was read with its readers and keeps the first publication date.
 *   6. The cover: never read from an address, no description collected — none in the model, the
 *      wire or the form — and the screen says the API keeps none.
 *   7. Drafts are held in memory: nothing in the module touches web storage, cookies or the console.
 *   8. `news.write` is the server's key: in `PERMISSIONS`, mutating, asked for by the route and the
 *      menu entry, and never a `newsfeed.*` key.
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

const FEATURE = join(APP, 'features', 'balita');
const FILES = {
  copy: join(FEATURE, 'balita.copy.ts'),
  page: join(FEATURE, 'balita-page.ts'),
  editor: join(FEATURE, 'balita-editor.ts'),
  editorTemplate: join(FEATURE, 'balita-editor.html'),
  domain: join(APP, 'domain', 'balita', 'balita-article.ts'),
  mapper: join(APP, 'data', 'http', 'mappers', 'balita.mapper.ts'),
  mock: join(APP, 'data', 'mock', 'mock-balita.repository.ts'),
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

function methodBody(text, name) {
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const moduleFiles = [...walk(FEATURE), FILES.domain, FILES.mapper, FILES.mock];

/* ── 1. residents read it; the one news channel ──────────────────────────── */

const copy = readFileSync(FILES.copy, 'utf8');
if (
  !/subtitle:\s*\n?\s*'Residents read these in the Taytay app’s Balita, the one news channel this console publishes to/.test(
    copy,
  )
) {
  failures.push(
    'The Balita page no longer says residents read it in the app, and that it is the one news channel this console publishes to.',
  );
}
if (!/\[subtitle\]="copy\.page\.subtitle"/.test(source(join(FEATURE, 'balita-page.html')))) {
  failures.push('The Balita page header no longer shows the sentence saying residents read it.');
}

/* ── 2. one news channel ─────────────────────────────────────────────────── */

/*
 * The whole console, not the Balita module alone: the newsfeed was retired in Balita's favour
 * (`DL-194`), so a newsfeed anywhere is a second channel, not a neighbour Balita must stay apart
 * from. Code only — comments may say what was retired and why. Specs are excluded, since a spec
 * asserting that the newsfeed is gone has to name it.
 */
const NEWSFEED = [
  // Its port, token, model, keys and files.
  /\b(NEWSFEED_REPOSITORY|NewsfeedRepository|Newsfeed[A-Z]\w*|newsfeed\.[a-z-]+|features\/newsfeed|domain\/newsfeed|mock-newsfeed)\b/,
  // Its route, its menu entry, and its name as a data port or as a guard's argument.
  /path:\s*'newsfeed\b|route:\s*'\/newsfeed\b|['"]newsfeed['"]/,
];
for (const file of walk(APP)) {
  const text = source(file);
  const found = NEWSFEED.map((pattern) => pattern.exec(text)).find((match) => match !== null) ?? null;
  if (found !== null) {
    failures.push(
      `${shown(file)} names ${found[0]}. The newsfeed was retired in favour of Balita, the one news ` +
        'channel residents read (DL-194): a second channel would publish posts no resident sees.',
    );
  }
}
for (const dir of [join(APP, 'features', 'newsfeed'), join(APP, 'domain', 'newsfeed')]) {
  if (existsSync(dir)) failures.push(`${shown(dir)} exists. The newsfeed was retired in favour of Balita (DL-194).`);
}

/* ── 3. each outward act below its effects ──────────────────────────────── */

const template = source(FILES.editorTemplate);
function actsBelow(click, effects, said) {
  let at = template.indexOf(click);
  if (at === -1) failures.push(`The editor has no ${said} button any more, so its warning was not checked.`);
  while (at !== -1) {
    const act = template.lastIndexOf('<div class="balita__act">', at);
    const between = act === -1 ? '' : template.slice(act, at);
    if (!between.includes(effects)) {
      failures.push(`A ${said} button no longer stands below its effects (${effects}).`);
    }
    at = template.indexOf(click, at + click.length);
  }
}
actsBelow(`(click)="create('published')"`, '@for (effect of effects.publish', 'publish');
actsBelow(`(click)="move('published')"`, '@for (effect of effects.publish', 'publish');
actsBelow(`(click)="move('draft')"`, '@for (effect of effects.unpublish', 'take-it-off');
actsBelow(`(click)="pin(`, "effects[current.pinned ? 'unpin' : 'pin']", 'pin');

/* ── 4. every write through send ────────────────────────────────────────── */

const editor = source(FILES.editor);
const subscriptions = [...editor.matchAll(/\.subscribe\s*\(/g)].length;
if (
  subscriptions !== 2 ||
  !/\.subscribe\s*\(/.test(methodBody(editor, 'send')) ||
  !/\.subscribe\s*\(/.test(methodBody(editor, 'showCover'))
) {
  failures.push('The editor sends a request from somewhere other than send (or opens a cover outside showCover).');
}

/* ── 5. what publishing and taking off do ───────────────────────────────── */

const domain = source(FILES.domain);
const effects = domain.slice(domain.indexOf('export const BALITA_EFFECTS'));
for (const [pattern, said] of [
  [/cannot be recalled from anybody who has read it/, 'a published article cannot be recalled'],
  [/sends no notification/, 'publishing sends no notification'],
  [/Anybody who has already read it[\s\S]{0,60}keeps them/, 'taking it off leaves what was read with its readers'],
  [/keeps its first publication date, so it does not return to the top/,'a republished article keeps its first date'],
]) {
  if (!pattern.test(effects)) failures.push(`BALITA_EFFECTS no longer says ${said}.`);
}

/* ── 6. the cover ───────────────────────────────────────────────────────── */

const mapper = source(FILES.mapper);
if (/cover_url/.test(mapper)) failures.push('The Balita mapper reads cover_url. The cover is read as bytes, never from an address.');
// The shapes that carry an article, and the form: none has a field for describing the cover.
const shapes = [
  ...['BalitaArticle', 'BalitaDraft', 'BalitaChanges'].map((name) => [
    FILES.domain,
    block(domain, domain.indexOf(`export interface ${name} `)),
  ]),
  ...['NewsWriteWire', 'NewsPatchWire'].map((name) => [
    FILES.mapper,
    block(mapper, mapper.indexOf(`export interface ${name} `)),
  ]),
];
for (const [file, text] of shapes) {
  const found = /\b(\w*(?:[aA]lt(?:[A-Z_]|[tT]ext)|[dD]escription|[cC]aption)\w*)\s*[?:]/.exec(text);
  if (found !== null) failures.push(`${shown(file)} has ${found[1]}. The API keeps no description of a cover; the screen says so instead.`);
}
if (/id="balita-[a-z-]*(alt|description|caption)/.test(template)) {
  failures.push('The editor asks for a description of the cover, which the API would drop.');
}
if (!/The API keeps no description of the cover/.test(domain) || !/@for \(effect of coverEffects/.test(template)) {
  failures.push('The editor no longer says the API keeps no description of the cover.');
}

/* ── 7. drafts in memory ─────────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(source(file));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Drafts are held in the page's memory, and nothing is logged.`);
}

/* ── 8. the server's key ────────────────────────────────────────────────── */

const permission = source(join(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
if (!vocabulary.includes("'news.write'")) failures.push("PERMISSIONS does not hold 'news.write', the API's own key.");
if (source(join(APP, 'domain', 'access', 'permission-matrix.ts')).includes('news.write')) {
  failures.push("'news.write' is classified read-only. A published article goes out in the municipality's name.");
}
const routes = source(join(APP, 'app.routes.ts'));
const route = routes.slice(routes.indexOf("path: 'balita'"), routes.indexOf("path: 'balita'") + 400);
const nav = source(join(APP, 'core', 'navigation', 'navigation.ts'));
const entry = nav.slice(nav.indexOf("route: '/balita'"), nav.indexOf("route: '/balita'") + 300);
for (const [where, text] of [['route', route], ['menu entry', entry]]) {
  if (!/permission(?:Guard\(|s: \[)'news\.write'/.test(text) || /newsfeed\./.test(text)) {
    failures.push(`The Balita ${where} no longer asks for 'news.write' alone.`);
  }
}

report();

function report() {
  if (failures.length > 0) {
    console.error('\nBalita check failed (DL-171):\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }
  console.log(
    'Balita check passed (residents told, one news channel, every outward act below its effects, ' +
      'every write through send, no cover address or description, drafts in memory, the server’s key).',
  );
}
