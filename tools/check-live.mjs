#!/usr/bin/env node
/**
 * check:live — live updates stay hints, read through the screens' own repositories, scheduled in
 * one place, and never announced (`DL-222`).
 *
 * Every screen may now update by itself. That is one service (`core/live/live-updates.ts`) holding
 * one stream of topic names, and screens re-reading through the reads they already make. Each rule
 * below keeps one way of quietly becoming something else from compiling into the build:
 *
 *   1. **No second transport.** No `EventSource` (it cannot send a header, so it would carry the
 *      token in the URL) and no `WebSocket`, anywhere in `src/`.
 *   2. **One scheduler.** `setInterval` nowhere; rxjs `interval`, `repeat` and a repeating
 *      `timer(due, period)` only in `core/live`; and the page-visibility API only there. A screen
 *      that polls on its own is how "every second" comes back, one feature at a time. A one-shot
 *      `timer(due)` — the person picker's debounce — is not repetition and stays allowed.
 *   3. **Hints carry topic names and nothing else.** The change-feed mapper reads only `topics` off
 *      the payload, spreads nothing, and builds events of `kind` and `topics` alone; the port's
 *      `ChangeFeedEvent` declares no other field.
 *   4. **One caller of `ApiClient.stream`**: `HttpChangeFeed`, once. The stream takes a path and
 *      nothing else — no query string, so never a token in a URL — and its failures raise no notice
 *      (`QUIET_FAILURE`).
 *   5. **The feed is the http set's alone**: `CHANGE_FEED` bound to `HttpChangeFeed` there, absent
 *      from the mock set, injected optionally.
 *   6. **Nothing is announced.** The topbar indicator and the list-changed notice carry no live
 *      region and no live role, the indicator is a toggle with `aria-pressed` and a fixed name, and
 *      it is mounted in the topbar (WCAG 2.2.2).
 *   7. **Idle stops the talking, and nothing in `core/live` renews a credential** (`DL-166`): the
 *      30-minute idle limit stands, activity is read from passive listeners, and `core/live` names
 *      neither the token holder nor the session refresher.
 *   8. **Every page that reads is live, or says why not.** A routed page — or a section a page is
 *      made of (`*-section.ts`) — that injects a repository re-reads through `liveViewState`,
 *      `liveRead` or `LiveUpdates.changes`, or through a feature helper that does (`cursorList`),
 *      or it is named in `NOT_LIVE` below with its kind (a form, a search, a report run, static)
 *      and why. An entry for a page that is live, gone, or reads nothing fails, so the list never
 *      outlives its reasons. No re-read asks for nothing (`changes([])`), and none marks, touches
 *      or acknowledges anything: a re-read is a read (`DL-118`).
 *
 * Each rule was validated against a planted regression before being trusted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boundAdapter } from './adapter-sources.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const APP = join(SRC, 'app');
const LIVE_DIR = join(APP, 'core', 'live');
const shown = (file) => relative(ROOT, file).split(sep).join('/');
const failures = [];

const FILES = {
  port: join(LIVE_DIR, 'change-feed.ts'),
  service: join(LIVE_DIR, 'live-updates.ts'),
  mapper: join(APP, 'data', 'http', 'mappers', 'change-feed.mapper.ts'),
  parser: join(APP, 'data', 'http', 'sse-parser.ts'),
  client: join(APP, 'data', 'http', 'api.client.ts'),
  adapters: join(APP, 'data', 'http', 'http-repositories.ts'),
  contract: join(APP, 'data', 'http', 'api.contract.ts'),
  providers: join(APP, 'data', 'data-access.providers.ts'),
  mockProviders: join(APP, 'data', 'data-access.providers.mock.ts'),
  indicator: join(APP, 'layout', 'topbar', 'live-indicator.ts'),
  topbar: join(APP, 'layout', 'topbar', 'app-topbar.ts'),
  notice: join(APP, 'shared', 'ui', 'list-changed-notice', 'list-changed-notice.ts'),
  helper: join(APP, 'shared', 'state', 'live-view-state.ts'),
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
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
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

const files = walk(SRC).map((path) => ({ path, text: source(path) }));
const inLive = (path) => path.startsWith(LIVE_DIR + sep);

/** The argument text of the call whose `(` is at `open`, or null when it never closes. */
function argumentsAt(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

/** Commas at the top level of an argument list: two arguments have one. */
function topLevelCommas(args) {
  let depth = 0;
  let commas = 0;
  for (const ch of args) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) commas++;
  }
  return commas;
}

const rxjsImports = (text) =>
  [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'rxjs'/g)]
    .flatMap((match) => match[1].split(','))
    .map((name) =>
      name
        .replace(/\btype\b/, '')
        .trim()
        .split(/\s+as\s+/),
    )
    .filter(([name]) => name !== '')
    .map(([name, alias]) => ({ name, local: alias ?? name }));

/* ── 1. no second transport ─────────────────────────────────────────────── */

for (const { path, text } of files) {
  for (const name of ['EventSource', 'WebSocket']) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      failures.push(
        `${shown(path)} uses ${name}. Live updates travel over ApiClient.stream, through the ` +
          'interceptors: an EventSource cannot send the bearer header, so it would put the token in ' +
          'the URL (rule 5), and a WebSocket is a second protocol nobody serves (DL-222).',
      );
    }
  }
}

/* ── 2. one scheduler ───────────────────────────────────────────────────── */

for (const { path, text } of files) {
  if (/\bsetInterval\s*\(/.test(text)) {
    failures.push(
      `${shown(path)} calls setInterval. Nothing in the console repeats on a clock: live updates ` +
        'schedule one-shot timers in core/live, and only while somebody is using the console (DL-222).',
    );
  }

  if (inLive(path)) continue;

  for (const { name, local } of rxjsImports(text)) {
    if (name === 'interval' || name === 'repeat') {
      failures.push(
        `${shown(path)} imports rxjs ${name}, which repeats a read on a clock. A screen re-reads when ` +
          "LiveUpdates.changes() says so; polling is core/live's fallback alone (DL-222).",
      );
    }
    if (name === 'timer') {
      for (const call of text.matchAll(new RegExp(`(?<![.\\w])${local}\\s*\\(`, 'g'))) {
        const args = argumentsAt(text, call.index + call[0].length - 1);
        if (args === null || topLevelCommas(args) > 0) {
          failures.push(
            `${shown(path)} calls ${local}(due, period), a repeating timer. Only a one-shot timer — a ` +
              'debounce — belongs outside core/live (DL-222).',
          );
        }
      }
    }
  }

  if (/\bvisibilitychange\b|\bvisibilityState\b|\bdocument\s*\.\s*hidden\b/.test(text)) {
    failures.push(
      `${shown(path)} watches page visibility. Re-reading when a tab comes back into view is ` +
        "LiveUpdates' job, once for every screen, so a screen does not grow its own (DL-222).",
    );
  }
}

/* ── 3. hints carry topic names and nothing else ────────────────────────── */

const mapper = source(FILES.mapper);

if (/\.\.\./.test(mapper)) {
  failures.push(
    `${shown(FILES.mapper)} spreads a value. An event is built field by field from \`topics\`, so ` +
      'nothing the server adds can ride along into a screen (DL-222).',
  );
}

const payloadReads = [...mapper.matchAll(/\bpayload\s*(?:\?\.|\.|\[)\s*(\w*)/g)];
if (payloadReads.length === 0) {
  failures.push(
    `${shown(FILES.mapper)} reads no field off \`payload\`; this check cannot see what it keeps.`,
  );
}
for (const [, field] of payloadReads) {
  if (field !== 'topics') {
    failures.push(
      `${shown(FILES.mapper)} reads \`${field || '[…]'}\` off the hint's payload. Hints carry topic ` +
        'names only — no id, count or value (DL-222) — and the mapper keeps only `topics`.',
    );
  }
}
if (/['"]topics['"]\s*in\s*payload/.test(mapper) === false) {
  failures.push(
    `${shown(FILES.mapper)} no longer asks whether the payload has \`topics\` before reading it.`,
  );
}

let eventLiterals = 0;
for (const match of mapper.matchAll(/\{\s*kind\s*:[^{}]*\}/g)) {
  eventLiterals++;
  // Each key follows the literal's `{` or a `,`, whether written `key: value` or as shorthand.
  const keys = [...match[0].matchAll(/[{,]\s*(\w+)\s*(?=[:,}])/g)].map((m) => m[1]);
  const unexpected = keys.filter((key) => key !== 'kind' && key !== 'topics');
  if (unexpected.length > 0) {
    failures.push(
      `${shown(FILES.mapper)} builds an event with ${unexpected.join(', ')}. A ChangeFeedEvent is a ` +
        'kind and, for ready and change, its topics — nothing else (DL-222).',
    );
  }
}
if (eventLiterals === 0) {
  failures.push(`${shown(FILES.mapper)} builds no event this check can read, so none was checked.`);
}

const port = source(FILES.port);
// The whole union, to the blank line after it: its members hold `;` of their own.
const eventType = /export type ChangeFeedEvent\s*=([\s\S]*?)\n\s*\n/.exec(port)?.[1] ?? '';
if (eventType === '') {
  failures.push(
    `${shown(FILES.port)} no longer declares ChangeFeedEvent, so its fields were not checked.`,
  );
}
for (const [, field] of eventType.matchAll(/readonly\s+(\w+)\s*\??:/g)) {
  if (field !== 'kind' && field !== 'topics') {
    failures.push(
      `ChangeFeedEvent declares \`${field}\`. A hint is a kind and topic names; a screen learns ` +
        'anything else by reading again through its own repository (DL-222).',
    );
  }
}

/* ── 4. one caller of ApiClient.stream ──────────────────────────────────── */

let streamCalls = 0;
for (const { path, text } of files) {
  for (const call of text.matchAll(/\.\s*stream\s*[<(]/g)) {
    if (path !== FILES.adapters) {
      failures.push(
        `${shown(path)} calls stream(). Only HttpChangeFeed opens the change feed; a screen asks ` +
          'LiveUpdates.changes() instead, so the console holds one stream, not one per screen (DL-222).',
      );
      continue;
    }
    const owner = [...text.slice(0, call.index).matchAll(/export class (\w+)/g)].at(-1)?.[1];
    if (owner !== 'HttpChangeFeed') {
      failures.push(
        `http-repositories.ts calls stream() in ${owner ?? 'no class'}; only HttpChangeFeed may.`,
      );
    }
    streamCalls++;
  }
}
if (streamCalls !== 1) {
  failures.push(
    `stream() is called ${streamCalls} times in the adapters; HttpChangeFeed calls it once.`,
  );
}

const client = source(FILES.client);
const streamMethod = /\n {2}stream\s*\(([^)]*)\)[^{]*\{([\s\S]*?)\n {2}\}/.exec(client);
if (streamMethod === null) {
  failures.push('ApiClient.stream could not be read, so its shape was not checked.');
} else {
  if (streamMethod[1].split(',').filter((p) => p.trim() !== '').length !== 1) {
    failures.push(
      'ApiClient.stream takes more than a path. A stream is addressed, never filtered: no query ' +
        'string, so nothing — least of all a token — can reach the URL (rule 5, DL-222).',
    );
  }
  // A `?` inside a string or template is a query string; one outside is a ternary or `??`.
  if (
    /\bparams\s*:/.test(streamMethod[2]) ||
    /(['"`])[^'"`\n]*\?[^'"`\n]*\1/.test(streamMethod[2])
  ) {
    failures.push(
      'ApiClient.stream builds a query string or params. The stream is addressed by its path alone.',
    );
  }
  if (!/QUIET_FAILURE/.test(streamMethod[2])) {
    failures.push(
      'ApiClient.stream no longer marks its request QUIET_FAILURE, so every dropped stream would raise ' +
        'an error notice (DL-222).',
    );
  }
  if (!/'text\/event-stream'/.test(streamMethod[2])) {
    failures.push('ApiClient.stream no longer asks for text/event-stream.');
  }
}

const contract = source(FILES.contract);
const changesPath = /\n {2}changes:\s*'([^']*)'/.exec(contract)?.[1];
if (changesPath === undefined) {
  failures.push('API_ENDPOINTS.changes is missing, so the stream address was not checked.');
} else if (/[?#&=]/.test(changesPath)) {
  failures.push(
    `API_ENDPOINTS.changes is '${changesPath}': a stream address carries no query string.`,
  );
}

/* ── 5. the feed is the http set's alone ────────────────────────────────── */

// Either binding form (`DL-224`): `useClass`, or `lazyPort((m) => m.X)`.
if (boundAdapter(source(FILES.providers), 'CHANGE_FEED') !== 'HttpChangeFeed') {
  failures.push('data-access.providers.ts no longer binds CHANGE_FEED to HttpChangeFeed.');
}
if (/\bCHANGE_FEED\b/.test(source(FILES.mockProviders))) {
  failures.push(
    'data-access.providers.mock.ts binds CHANGE_FEED. The mock set has no server to push anything; ' +
      'a mock feed would make the console look live where nothing is (DL-222).',
  );
}

const service = source(FILES.service);
if (!/inject\(\s*CHANGE_FEED\s*,\s*\{\s*optional:\s*true\s*\}\s*\)/.test(service)) {
  failures.push(
    'LiveUpdates no longer injects CHANGE_FEED optionally, so the mock set would fail to start.',
  );
}

/* ── 6. nothing is announced ────────────────────────────────────────────── */

const ANNOUNCING = /aria-live|role\s*=\s*["'](?:status|alert|log|marquee|timer)["']|LiveAnnouncer/;
for (const file of [FILES.indicator, FILES.notice, FILES.service, FILES.helper]) {
  if (ANNOUNCING.test(source(file))) {
    failures.push(
      `${shown(file)} announces. An update that arrives by itself must not interrupt anybody ` +
        "(WCAG 2.2.2), and the console's live regions are capped (check:hardening, DL-222).",
    );
  }
}

const indicator = source(FILES.indicator);
if (!/\[attr\.aria-pressed\]/.test(indicator)) {
  failures.push('The live indicator is no longer a toggle with aria-pressed (WCAG 2.2.2, DL-222).');
}
const label = /\[attr\.aria-label\]="([^"]*)"/.exec(indicator)?.[1];
if (label === undefined || !/^copy\.\w+$/.test(label.trim())) {
  failures.push(
    "The live indicator's accessible name is no longer one fixed phrase. A toggle that renames " +
      'itself with its state reads as a different control each time it is pressed (DL-207, DL-222).',
  );
}
if (!/<app-live-indicator\b/.test(source(FILES.topbar))) {
  failures.push(
    'The live indicator is not mounted in the topbar. Updates that move by themselves need the one ' +
      'control that stops them on every page (WCAG 2.2.2, DL-222).',
  );
}

/* ── 7. idle stops the talking; nothing here renews a credential ─────────── */

if (!/IDLE_AFTER_MS\s*=\s*30\s*\*\s*60_?000\b/.test(service)) {
  failures.push(
    'LiveUpdates no longer stops after 30 minutes without activity. An unattended console must stop ' +
      'talking to the API, or live updates become a background token renewal (DL-166, DL-222).',
  );
}
if (!/passive:\s*true/.test(service)) {
  failures.push('LiveUpdates no longer reads activity from passive listeners.');
}
for (const file of walk(LIVE_DIR)) {
  if (/AuthTokenHolder|SESSION_REFRESHER|SessionRefresher/.test(source(file))) {
    failures.push(
      `${shown(file)} names the token holder or the session refresher. A token is renewed only by a ` +
        'request on its way out (DL-166); live updates schedule reads, never renewals (DL-222).',
    );
  }
}

/* ── 8. every page that reads is live, or says why not ───────────────────── */

/**
 * The pages that read a repository and are deliberately not live, each with its kind and why. Not
 * an allow-list to grow: a new page that reads is live unless it is one of these four kinds.
 */
const NOT_LIVE = {
  'residents/resident-form-page': [
    'form',
    'registers or corrects a resident; a re-read would overwrite what is typed',
  ],
  'households/household-form-page': [
    'form',
    'records a household; its fields are the person’s until saved',
  ],
  'families/family-form-page': [
    'form',
    'records a family; its fields are the person’s until saved',
  ],
  'cases/case-open-page': [
    'form',
    'opens a case; the person and requests it reads are choices in the form',
  ],
  'requests/intake-page': [
    'form',
    'the four-step intake; every read seeds what the encoder is filling in',
  ],
  'programs/program-form-page': [
    'form',
    'creates or revises a programme; a re-read would overwrite the draft',
  ],
  'releases/release-prepare-page': [
    'form',
    'prepares a release; the request it reads is what the form is about',
  ],
  'visits/visit-schedule-page': [
    'form',
    'schedules a visit; the case it reads seeds the address being edited',
  ],
  'events/event-composer-page': [
    'form',
    'composes or corrects an event; a re-read would overwrite the draft',
  ],
  'app-settings/app-settings-page': [
    'form',
    'the app settings editor; a re-read would overwrite a pending change',
  ],
  'home-screen/banners-section': ['form', 'part of the home-screen editor, which is a form'],
  'home-screen/links-section': ['form', 'part of the home-screen editor, which is a form'],
  'home-screen/preview-section': ['form', 'previews the home-screen editor’s own draft'],
  'search/search-page': ['search', 'runs when somebody searches, never by itself'],
  'reports/report-view-page': [
    'report run',
    'a report is run deliberately, and its export says when it was',
  ],
  'reports/report-hub-page': ['static', 'the report catalogue is data shipped with the console'],
};
const NOT_LIVE_KINDS = new Set(['form', 'search', 'report run', 'static']);

/** Feature helpers that make a page that calls them, with its topics, live. */
const LIVE_HELPERS = { cursorList: join(APP, 'features', 'directory', 'cursor-list.ts') };

const FEATURES = join(APP, 'features');
const routedPages = [
  ...new Set(
    [...source(join(APP, 'app.routes.ts')).matchAll(/import\(\s*'@features\/([^']+)'\s*\)/g)].map(
      (match) => match[1],
    ),
  ),
];
const sections = walk(FEATURES)
  .filter((path) => path.endsWith('-section.ts'))
  .map((path) => relative(FEATURES, path).split(sep).join('/').replace(/\.ts$/, ''));
const pages = [...new Set([...routedPages, ...sections])];

if (routedPages.length < 40) {
  failures.push(
    `app.routes.ts yielded ${routedPages.length} routed pages, so this check cannot see the routes ` +
      'and no page was checked for being live.',
  );
}

const READS = /\binject\(\s*[A-Z][A-Z0-9_]*_REPOSITORY\b/;
const HOLDS_LIVE = /\binject\(\s*LiveUpdates\s*\)/;
const CHANGES = /\.\s*changes\s*\(/;

/**
 * Live means a read is re-run by hints: a `liveViewState` or `liveRead` handed
 * `LiveUpdates.changes(...)`, or `changes(...)` subscribed to directly. A `changes` call left
 * lying about, or a `liveViewState` with no hints, re-reads nothing.
 */
function isLive(text) {
  if (!HOLDS_LIVE.test(text)) return false;
  // A call may name its type: `liveViewState<CursorPage<FieldVisit>>(…)`.
  for (const call of text.matchAll(/\b(?:liveViewState|liveRead)\s*(?:<[^()]*?>)?\s*\(/g)) {
    const args = argumentsAt(text, call.index + call[0].length - 1);
    if (args !== null && CHANGES.test(args)) return true;
  }
  for (const call of text.matchAll(/\.\s*changes\s*\(/g)) {
    const open = call.index + call[0].length - 1;
    const args = argumentsAt(text, open);
    if (args === null) continue;
    const after = text.slice(open + args.length + 2);
    if (/^\s*\.\s*(?:pipe|subscribe)\s*\(/.test(after)) return true;
  }
  return false;
}

const liveHelpers = new Set();
for (const [name, file] of Object.entries(LIVE_HELPERS)) {
  if (existsSync(file) && isLive(source(file))) liveHelpers.add(name);
  else {
    failures.push(
      `${shown(file)} (${name}) no longer re-reads through LiveUpdates, so no page that uses it is ` +
        'live (DL-222).',
    );
  }
}

/** A call to a live helper that hands it topics, its second argument. */
function usesLiveHelper(text) {
  for (const name of liveHelpers) {
    for (const call of text.matchAll(new RegExp(`(?<![.\\w])${name}\\s*\\(`, 'g'))) {
      const args = argumentsAt(text, call.index + call[0].length - 1);
      if (args !== null && topLevelCommas(args) > 0) return true;
    }
  }
  return false;
}

for (const page of pages) {
  const file = join(FEATURES, `${page}.ts`);
  if (!existsSync(file)) {
    failures.push(`${page} is routed, but ${shown(file)} is missing, so it was not checked.`);
    continue;
  }
  const text = source(file);
  if (!READS.test(text)) continue;
  const live = isLive(text) || usesLiveHelper(text);
  if (NOT_LIVE[page] !== undefined) {
    if (live) {
      failures.push(
        `${page} is live but still listed in NOT_LIVE. Remove the entry, so the list says only ` +
          'what is true (DL-222).',
      );
    }
  } else if (!live) {
    failures.push(
      `${shown(file)} reads a repository and is not live. Read through liveViewState (liveRead for ` +
        'a side panel) with LiveUpdates.changes([...the topics it shows]); or, if it is a form, a ' +
        'search, a report run or static, name it in NOT_LIVE with why (DL-222).',
    );
  }
}

for (const [page, [kind, why]] of Object.entries(NOT_LIVE)) {
  if (!NOT_LIVE_KINDS.has(kind) || typeof why !== 'string' || why.trim() === '') {
    failures.push(
      `NOT_LIVE['${page}'] is "${kind}". A page is left un-live only as a form, a search, a report ` +
        'run or static, and says why (DL-222).',
    );
  }
  const file = join(FEATURES, `${page}.ts`);
  if (!pages.includes(page) || !existsSync(file)) {
    failures.push(`NOT_LIVE names ${page}, which is no routed page or section. Remove the entry.`);
  } else if (!READS.test(source(file))) {
    failures.push(`NOT_LIVE names ${page}, which reads no repository. Remove the entry.`);
  }
}

const MARKS = /\b(?:mark|touch|acknowledge)\w*\s*\(/;
for (const { path, text } of files) {
  if (!path.startsWith(FEATURES + sep)) continue;
  if (/\.\s*changes\s*\(\s*\[\s*\]\s*\)/.test(text)) {
    failures.push(
      `${shown(path)} asks LiveUpdates.changes([]). A re-read names the topics its read counts.`,
    );
  }
  for (const call of text.matchAll(
    /\b(liveViewState|liveRead|unlessPaged)\s*(?:<[^()]*?>)?\s*\(/g,
  )) {
    const args = argumentsAt(text, call.index + call[0].length - 1);
    if (args !== null && MARKS.test(args)) {
      failures.push(
        `${shown(path)} marks, touches or acknowledges something inside ${call[1]}(). A re-read is ` +
          'a read: it never writes, and marking read stays the person’s own act (DL-118, DL-222).',
      );
    }
  }
}

report();

function report() {
  if (failures.length > 0) {
    console.error('\nLive updates check failed (DL-222):\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }
  console.log(
    'Live updates check passed (one transport, one scheduler, topic names only, one stream caller, ' +
      'http set only, nothing announced, idle stops it and nothing renews, every page that reads ' +
      'is live or says why not).',
  );
}
