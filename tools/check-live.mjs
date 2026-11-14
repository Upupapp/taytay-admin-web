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
 *
 * Each rule was validated against a planted regression before being trusted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (!/provide:\s*CHANGE_FEED,\s*useClass:\s*HttpChangeFeed\b/.test(source(FILES.providers))) {
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
      'http set only, nothing announced, idle stops it and nothing renews).',
  );
}
