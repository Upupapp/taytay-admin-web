#!/usr/bin/env node
/**
 * check:unserved — a module the API cannot serve leaves the menu, and nothing can quietly keep it.
 *
 * ## The failure this exists for
 *
 * In the `http` configuration eighteen ports are bound to adapters that make no request and fail
 * with a sentence (`DL-165`). Until `DL-167` their navigation entries stayed, so an officer clicked
 * "Cases" and met an error — or, on a screen that hid its error well, an empty table read as "the
 * office has no cases" (`DL-112`). Now the data layer declares what it cannot serve
 * (`UNSERVED_PORTS`), the menu withholds every entry that reads one of those ports, and each such
 * route sends the user to one page that names them all.
 *
 * ## Only the primary port gates the menu (`DL-175`)
 *
 * `DL-167` withheld a screen when *any* port it read was unserved, so the resident registry — served
 * by the Node API — stayed out of the menu because the saved-view chips above it were not, and the
 * record because its home-visit panel was not. A secondary panel no longer withholds its module. It
 * asks `ServedPorts.serves('<port>')`, makes no call to that repository, and shows
 * `<app-not-connected port="<port>" />` where it would have been: the screen opens, and the gap is
 * named in place rather than read as "none" (`DL-112`). The route and the menu entry carry only
 * the primary ports — the ones without which there is no screen.
 *
 * That only holds while these lists agree — the bindings, the declaration, what each screen reads,
 * what it guards and what it degrades — and none of them is something a compiler can compare. So:
 *
 *   1. The ports bound to an `Unserved…` adapter in `data-access.providers.ts` are exactly the ports
 *      `UNSERVED_HTTP_PORTS` declares, each class stands for the port it is bound to, the http set
 *      binds `UNSERVED_PORTS` to that list, and the mock set binds it to `[]`.
 *   2. `DATA_PORTS` names every repository token in the domain, and nothing else.
 *   3. Every routed screen accounts for every port it reads — directly, through a file of its own
 *      feature it imports, or through a shared component it names — exactly once:
 *        reads = guarded ∪ degraded, with guarded ∩ degraded empty.
 *      `guarded` is its route's `servedGuard(…)`. A port is `degraded` only when a file of the
 *      screen's closure calls `serves('<port>')` literally AND that component's own template (its
 *      `templateUrl`, or its inline template) shows `<app-not-connected port="<port>">` (or
 *      `[port]="'<port>'"`). It fails on a call with no notice (a panel that vanishes silently), a
 *      notice with no call (one not tied to whether the port is served), a degraded port the
 *      screen does not read, a port both guarded and degraded (its notice could never be seen), and
 *      a screen that reads ports and guards none — a module whose every panel is optional is one
 *      whose menu entry can lead to nothing.
 *   4. Every navigation entry reads exactly the ports its route guards — rule 8's mirror, extended
 *      from permissions to ports. Since rule 3 that is the primary set.
 *   5. No port read by `core/` is unserved: core runs on every screen, so no route could withhold it.
 *
 * Rule 3 reads source text, so it is a floor: a port reached through a service it does not follow
 * is not seen. It over-reports rather than under-reports where a shared file exports two classes,
 * which withholds a module that might have worked — the safe direction. Comments are stripped
 * before `serves(…)` and the notice are looked for, so a sentence about them is not mistaken for
 * either.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const read = (...segments) => readFileSync(join(...segments), 'utf8');
const shown = (file) => relative(ROOT, file).split(sep).join('/');

const failures = [];
const notes = [];

/** `ASSISTANCE_REQUEST_REPOSITORY` ↔ `assistance-request`: the pairing is by spelling. */
const keyOf = (token) =>
  token
    .replace(/_REPOSITORY$/, '')
    .toLowerCase()
    .replace(/_/g, '-');
const tokenOf = (key) => `${key.toUpperCase().replace(/-/g, '_')}_REPOSITORY`;

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const listed = (set) => [...set].sort().join(', ') || '(none)';

/* ── 2. the vocabulary names every port, and only ports ──────────────────── */

const dataPorts = read(APP, 'domain', 'ports', 'data-ports.ts');
const vocabularyBlock = /export const DATA_PORTS = \[([\s\S]*?)\] as const;/.exec(dataPorts);
const vocabulary = new Set(
  vocabularyBlock === null ? [] : [...vocabularyBlock[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]),
);

const tokens = new Set(
  [
    ...read(APP, 'domain', 'ports', 'repositories.ts').matchAll(
      /^export const ([A-Z_]+_REPOSITORY)\b/gm,
    ),
  ].map((m) => keyOf(m[1])),
);

if (vocabulary.size === 0 || tokens.size === 0) {
  failures.push('DATA_PORTS or the repository tokens could not be read, so nothing was compared.');
}

for (const key of tokens) {
  if (!vocabulary.has(key)) {
    failures.push(
      `${tokenOf(key)} has no key in DATA_PORTS, so no adapter set can say whether it serves it.`,
    );
  }
}
for (const key of vocabulary) {
  if (!tokens.has(key)) {
    failures.push(`DATA_PORTS names '${key}', and the domain declares no ${tokenOf(key)}.`);
  }
}

/* ── 1. the declaration is the bindings ──────────────────────────────────── */

const providers = read(APP, 'data', 'data-access.providers.ts');
const mockProviders = read(APP, 'data', 'data-access.providers.mock.ts');
const unservedSource = read(APP, 'data', 'http', 'unserved-repositories.ts');

const boundUnserved = new Map(
  [...providers.matchAll(/provide:\s*([A-Z_]+_REPOSITORY),\s*useClass:\s*(Unserved\w+)/g)].map(
    ([, token, cls]) => [cls, keyOf(token)],
  ),
);

const classPorts = new Map(
  [
    ...unservedSource.matchAll(
      /export class (Unserved\w+) implements \w+ \{\s*static readonly port: DataPort = '([a-z-]+)';/g,
    ),
  ].map(([, cls, port]) => [cls, port]),
);

for (const [cls, key] of boundUnserved) {
  if (!classPorts.has(cls)) {
    failures.push(
      `${cls} is bound in data-access.providers.ts and declares no static port, so nothing can withhold it.`,
    );
  } else if (classPorts.get(cls) !== key) {
    failures.push(
      `${cls} says it stands for '${classPorts.get(cls)}' and is bound to ${tokenOf(key)}.`,
    );
  }
}

const declarationBlock = /export const UNSERVED_HTTP_PORTS[^=]*=\s*\[([\s\S]*?)\];/.exec(
  unservedSource,
);
const declaredClasses =
  declarationBlock === null
    ? []
    : [...declarationBlock[1].matchAll(/(Unserved\w+)\.port/g)].map((m) => m[1]);
const declared = new Set(declaredClasses.map((cls) => classPorts.get(cls) ?? `?${cls}`));
const bound = new Set(boundUnserved.values());

if (declarationBlock === null) {
  failures.push('UNSERVED_HTTP_PORTS could not be read from unserved-repositories.ts.');
} else if (!sameSet(declared, bound)) {
  failures.push(
    `UNSERVED_HTTP_PORTS declares ${listed(declared)}; the http set binds an unserved adapter to ${listed(bound)}.\n` +
      `    A port bound unserved and not declared keeps its menu entry, and every officer who follows it\n` +
      `    meets a refusal (DL-167).`,
  );
}

if (!/provide:\s*UNSERVED_PORTS,\s*useValue:\s*UNSERVED_HTTP_PORTS\b/.test(providers)) {
  failures.push('data-access.providers.ts does not bind UNSERVED_PORTS to UNSERVED_HTTP_PORTS.');
}
if (!/provide:\s*UNSERVED_PORTS,\s*useValue:\s*\[\]/.test(mockProviders)) {
  failures.push(
    'data-access.providers.mock.ts does not bind UNSERVED_PORTS to [] — the mock serves every port.',
  );
}

/* ── which ports a file reads ────────────────────────────────────────────── */

const injected = (text) =>
  new Set([...text.matchAll(/inject\(\s*([A-Z_]+_REPOSITORY)\s*\)/g)].map((m) => keyOf(m[1])));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

/** Shared classes and the ports their file reads. A file exporting two classes lends both its ports. */
const sharedReads = new Map();
for (const file of walk(join(APP, 'shared'))) {
  const text = readFileSync(file, 'utf8');
  const ports = injected(text);
  if (ports.size === 0) continue;
  for (const [, name] of text.matchAll(/export class (\w+)/g)) sharedReads.set(name, ports);
}

/**
 * What one screen reads — its file, the files of its own feature it imports, and shared classes it
 * names — and the files of that closure, which are where a panel can degrade in place.
 */
function screenReads(entry) {
  const ports = new Set();
  const seen = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    const text = readFileSync(file, 'utf8');
    for (const port of injected(text)) ports.add(port);
    for (const [name, lent] of sharedReads) {
      if (new RegExp(`\\b${name}\\b`).test(text)) for (const port of lent) ports.add(port);
    }
    for (const [, specifier] of text.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const target = resolve(dirname(file), `${specifier}.ts`);
      if (target.startsWith(join(APP, 'features'))) queue.push(target);
    }
  }

  return { ports, files: [...seen] };
}

/* ── which ports a screen degrades in place ──────────────────────────────── */

/** Source text with its comments removed, so a sentence about `serves('x')` is not a call to it. */
const withoutComments = (text) =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** A component's template: its `templateUrl` when it names one, otherwise its own (inline) text. */
function templateOf(file, text) {
  const url = /templateUrl:\s*'([^']+)'/.exec(text)?.[1];
  if (url === undefined) return { file, text };
  const path = resolve(dirname(file), url);
  return { file: path, text: existsSync(path) ? readFileSync(path, 'utf8') : '' };
}

/**
 * The panels one file degrades in place: each literal `serves('<port>')` it calls, and the
 * `<app-not-connected>` notices its own template shows. Only a port in both counts.
 */
function degradationsIn(file) {
  const text = readFileSync(file, 'utf8');
  const asked = new Set(
    [...withoutComments(text).matchAll(/\bserves\(\s*'([a-z-]+)'\s*\)/g)].map((m) => m[1]),
  );
  const template = templateOf(file, text);
  const noticed = new Set(
    [
      ...withoutComments(template.text).matchAll(
        /<app-not-connected\b[^>]*?(?:\bport="([a-z-]+)"|\[port\]="'([a-z-]+)'")/g,
      ),
    ].map((m) => m[1] ?? m[2]),
  );
  return { asked, noticed, template: template.file };
}

/* ── 3. every routed screen guards what it reads ─────────────────────────── */

/** Every `{…}` in a source file, with strings and comments skipped. */
function objectsIn(text) {
  const objects = [];
  const stack = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i);
      if (i === -1) break;
    } else if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++;
    } else if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      objects.push({ start: stack.pop(), end: i + 1 });
    }
  }

  return objects;
}

/** An object's text with every object nested inside it blanked out, so `path:` is its own. */
function ownText(text, object, objects) {
  let own = text.slice(object.start, object.end);
  for (const inner of objects) {
    if (inner === object || inner.start <= object.start || inner.end >= object.end) continue;
    const from = inner.start - object.start;
    own =
      own.slice(0, from) +
      ' '.repeat(inner.end - inner.start) +
      own.slice(from + inner.end - inner.start);
  }
  return own;
}

const routesFile = join(APP, 'app.routes.ts');
const routesText = readFileSync(routesFile, 'utf8');
const allObjects = objectsIn(routesText);
const routeObjects = allObjects.filter((o) =>
  /\bpath:\s*'/.test(ownText(routesText, o, allObjects)),
);
const guardedRoutes = new Map();
let screens = 0;
let degradingScreens = 0;
let degradedPanels = 0;

for (const object of routeObjects) {
  const own = ownText(routesText, object, routeObjects);
  const specifier = /loadComponent:\s*\(\)\s*=>\s*import\('([^']+)'\)/.exec(own)?.[1];
  if (specifier === undefined) continue;

  const fullPath = routeObjects
    .filter((outer) => outer.start <= object.start && outer.end >= object.end)
    .sort((a, b) => a.start - b.start)
    .map((outer) => /\bpath:\s*'([^']*)'/.exec(ownText(routesText, outer, routeObjects))?.[1] ?? '')
    .filter((segment) => segment !== '')
    .join('/');

  const file = specifier.startsWith('@features/')
    ? join(APP, 'features', `${specifier.slice('@features/'.length)}.ts`)
    : resolve(APP, `${specifier}.ts`);

  if (!existsSync(file)) {
    failures.push(
      `app.routes.ts loads '${specifier}', which this check could not find at ${shown(file)}.`,
    );
    continue;
  }

  const guardCalls = [...own.matchAll(/servedGuard\(([^)]*)\)/g)];
  const guarded = new Set(
    guardCalls.flatMap(([, args]) => [...args.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])),
  );
  const { ports: reads, files } = screenReads(file);
  screens++;

  const degraded = new Set();
  for (const member of files) {
    const { asked, noticed, template } = degradationsIn(member);
    for (const port of asked) {
      if (noticed.has(port)) {
        degraded.add(port);
      } else {
        failures.push(
          `${shown(member)} asks serves('${port}') and ${shown(template)} shows no ` +
            `<app-not-connected port="${port}" />.\n` +
            `    A panel that leaves without saying so reads as a record with nothing in it (DL-112).`,
        );
      }
    }
    for (const port of noticed) {
      if (!asked.has(port)) {
        failures.push(
          `${shown(template)} shows <app-not-connected port="${port}" /> and ${shown(member)} never ` +
            `asks serves('${port}'), so the notice is not tied to whether the port is served.`,
        );
      }
    }
  }

  if (guardCalls.length > 1) {
    failures.push(
      `/${fullPath} carries ${guardCalls.length} servedGuard calls; write one, listing every port.`,
    );
  }
  for (const port of guarded) {
    if (!vocabulary.has(port))
      failures.push(`/${fullPath} guards '${port}', which DATA_PORTS does not name.`);
  }
  for (const port of degraded) {
    if (guarded.has(port)) {
      failures.push(
        `/${fullPath} both guards '${port}' and degrades it in place. A port is the screen's ` +
          `primary or one of its panels, not both: guarded, its notice can never be seen.`,
      );
    }
    if (!reads.has(port)) {
      failures.push(
        `/${fullPath} degrades '${port}' in place and reads no ${tokenOf(port)}: a notice for a ` +
          `panel the screen does not have.`,
      );
    }
  }
  if (reads.size > 0 && guarded.size === 0) {
    failures.push(
      `/${fullPath} (${shown(file)}) reads ${listed(reads)} and guards none of it. A module whose ` +
        `every panel is optional is one whose menu entry can lead to nothing: guard its primary port.`,
    );
  }

  const accounted = new Set([...guarded, ...degraded]);
  if (!sameSet(reads, accounted)) {
    const loose = [...reads].filter((port) => !accounted.has(port)).sort();
    failures.push(
      `/${fullPath} (${shown(file)}) reads ${listed(reads)}; its route guards ${listed(guarded)} ` +
        `and it degrades ${listed(degraded)} in place.\n` +
        (loose.length > 0
          ? `    ${loose.map((p) => `'${p}'`).join(', ')}: neither. List it in servedGuard(…) on ` +
            `that route if the screen cannot work without it,\n` +
            `    or ask serves('…') and show <app-not-connected> where its panel would be — ` +
            `or an unserved port keeps a screen that can only fail.`
          : `    It guards or degrades a port it does not read.`),
    );
  }

  if (degraded.size > 0) {
    degradingScreens++;
    degradedPanels += degraded.size;
  }
  guardedRoutes.set(`/${fullPath}`, guarded);
}

if (screens === 0)
  failures.push('No routed screen was read from app.routes.ts, so nothing was compared.');

/* Every withheld address leads to one page; it has to exist, or the redirect lands on not-found. */
const unservedRoute = /export const UNSERVED_ROUTE = '\/([a-z-]+)'/.exec(
  read(APP, 'core', 'access', 'served-ports.ts'),
)?.[1];
if (unservedRoute === undefined || !guardedRoutes.has(`/${unservedRoute}`)) {
  failures.push(
    `UNSERVED_ROUTE is '/${unservedRoute ?? '?'}' and no routed screen answers it. Every withheld ` +
      `module would redirect to the not-found page — an absence explained as a wrong address.`,
  );
}

/* ── 4. every navigation entry reads what its route guards ───────────────── */

const navigationText = read(APP, 'core', 'navigation', 'navigation.ts');
const navEntries = [
  ...navigationText.matchAll(/route:\s*'([^']+)'[\s\S]*?reads:\s*\[([^\]]*)\]/g),
].map(([, route, reads]) => ({
  route,
  reads: new Set([...reads.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])),
}));
const navRoutes = [...navigationText.matchAll(/route:\s*'([^']+)'/g)].length;

if (navEntries.length === 0 || navEntries.length !== navRoutes) {
  failures.push(
    `navigation.ts has ${navRoutes} entries and ${navEntries.length} were read with a reads list. ` +
      `Give every entry a literal reads: [...] after its route.`,
  );
}

for (const { route, reads } of navEntries) {
  const guarded = guardedRoutes.get(route);
  if (guarded === undefined) {
    failures.push(`The navigation offers ${route}, and no routed screen answers it.`);
  } else if (!sameSet(reads, guarded)) {
    failures.push(
      `The ${route} navigation entry reads ${listed(reads)}; its route guards ${listed(guarded)}.\n` +
        `    The menu would offer a link its route then withholds — rule 8, for ports.`,
    );
  }
}

/* ── 5. what core reads is never unserved ────────────────────────────────── */

const coreReads = new Set(
  walk(join(APP, 'core')).flatMap((file) => [...injected(readFileSync(file, 'utf8'))]),
);
for (const port of coreReads) {
  if (declared.has(port)) {
    failures.push(
      `core/ reads '${port}' on every screen, and the http set declares it unserved. No route can withhold it.`,
    );
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

notes.push(`${vocabulary.size} ports named; ${bound.size} unserved in the http set, all declared`);
notes.push(
  `${screens} routed screens, each guarding its primary ports; ${navEntries.length} menu entries mirroring them`,
);
notes.push(
  `${degradingScreens} ${degradingScreens === 1 ? 'screen degrades' : 'screens degrade'} ${degradedPanels} ` +
    `secondary panel${degradedPanels === 1 ? '' : 's'} in place`,
);

for (const note of notes) console.log(`  ${note}`);

if (failures.length > 0) {
  console.error(`\nUnserved-module check FAILED (${failures.length}):\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log('Unserved-module check passed.');
