#!/usr/bin/env node
/**
 * check:wire-adoption — what this console SENDS is mapped, not merely typed, and is what the
 * operation accepts.
 *
 * ## The defect class this catches
 *
 * `check:mapper-adoption` holds the read side: a generic like `this.api.item<ResidentView>(…)` is an
 * **assertion, not a check** — it tells TypeScript the `snake_case` payload *is* a `ResidentView`,
 * and nothing converts anything at run time.
 *
 * The write side has the same hole. `this.api.post<Resident, ResidentDraft>(…)` sends the domain
 * object **verbatim**, so the request carries `birthDate` where the API validates `birth_date`, and
 * every field is rejected at once with a 422. It is not merely casing: a domain draft nests what the
 * API wants flat, which no generic converter could bridge — which is why CLAUDE.md forbids one.
 *
 * ## What counts as mapped
 *
 * A write whose body is either
 *
 *   1. a call to a `toWire…()` function — the explicit mapper, or
 *   2. an inline literal every one of whose keys is wire-shaped **and declared by the operation's
 *      `requestBody` in the vendored spec** (`DL-165`). Several of the Node API's body schemas are
 *      strict, so an undeclared key is a 422; the others drop it, which is worse, because the field
 *      somebody filled in is discarded and the write reports success. An operation that declares no
 *      body accepts only `{}`.
 *
 * A `toWire…()` mapper is not taken on trust (`DL-170`): it must declare its answer as a `…Wire`
 * interface beside it, and every key of that interface must be one the operation declares — the
 * same test an inline literal meets. A mapper this check cannot read is one it may not call mapped.
 *
 * ## And it is sent the way the operation reads it
 *
 * Since `DL-170` some bodies are forms, because they carry a file. `post`/`patch` send JSON and
 * `postForm`/`patchForm` send `multipart/form-data`, and each must go to an operation whose
 * request body is declared in that media type: JSON at a form route is refused before the file is
 * even looked for, and a form at a JSON route arrives as fields nobody parses.
 *
 * Anything else fails. Against the Laravel API this was a ratchet — eight bodies were known to be
 * sent unmapped, carried in `unmapped-writes.json` — and every one of them belonged to an adapter
 * that now makes no request, so the count reached zero by removal and the baseline file is gone.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HTTP = join(ROOT, 'src', 'app', 'data', 'http');
const SOURCE = join(HTTP, 'http-repositories.ts');

const src = readFileSync(SOURCE, 'utf8');
const spec = JSON.parse(readFileSync(join(HTTP, 'contract', 'openapi.json'), 'utf8'));
const contract = readFileSync(join(HTTP, 'api.contract.ts'), 'utf8');
const failures = [];

/** `birthDate` is not wire-shaped; `reason`, `status` and `birth_date` are. */
const wireShaped = (key) => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(key);

/** Each write helper on ApiClient: the HTTP verb it sends and the media type its body travels in. */
const WRITE_HELPERS = {
  post: { verb: 'post', media: 'application/json' },
  patch: { verb: 'patch', media: 'application/json' },
  delete: { verb: 'delete', media: 'application/json' },
  postForm: { verb: 'post', media: 'multipart/form-data' },
  patchForm: { verb: 'patch', media: 'multipart/form-data' },
  /**
   * A JSON body answered with bytes (`DL-178`): the grant's handle. A body like any other, so it is
   * held to its operation's schema and must travel through a `toWire…` mapper.
   */
  postBlob: { verb: 'post', media: 'application/json' },
};
const READ_HELPERS = new Set(['cursorPage', 'cursorPageWithMeta', 'everyPage', 'list', 'item', 'optionalItem', 'blob']);
const WRITE_VERBS = Object.fromEntries(Object.values(WRITE_HELPERS).map(({ verb }) => [verb, verb]));

/*
 * The helper names are asserted against ApiClient's surface: a write helper this table did not know
 * would have its calls skipped rather than judged — the hole `DL-162` names, which the form
 * helpers would otherwise have been.
 */
{
  const client = readFileSync(join(HTTP, 'api.client.ts'), 'utf8');
  for (const [, helper] of client.matchAll(/^  ([a-zA-Z]\w*)\s*[<(]/gm)) {
    if (WRITE_HELPERS[helper] === undefined && !READ_HELPERS.has(helper)) {
      failures.push(`ApiClient.${helper} is neither a known read nor a known write, so its bodies would not be checked.`);
    }
  }
}

const resolve = (schema) => {
  const ref = schema?.$ref;
  if (typeof ref !== 'string') return schema;
  return resolve(ref.replace(/^#\//, '').split('/').reduce((node, key) => node?.[key], spec));
};

const normalise = (path) => path.replace(/\{[^}]+\}/g, '{}');

const operations = new Map();
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const verb of Object.values(WRITE_VERBS)) {
    if (item[verb] !== undefined) operations.set(`${verb} ${normalise(path.replace(/^\/api\/v1\//, ''))}`, item[verb]);
  }
}

const table = /export const API_ENDPOINTS = \{([\s\S]*?)\n\} as const;/.exec(contract)?.[1] ?? '';
const lookup = Object.fromEntries(
  [...table.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(/(\w+):\s*'([^']+)'/g)].map(
    ([, name, path]) => [name, path],
  ),
);

/** The keys a body schema declares, or `null` when the operation takes no body at all. */
function declaredKeys(operation) {
  const content = operation?.requestBody?.content;
  if (content === undefined) return null;

  const keys = new Set();
  for (const media of Object.values(content)) {
    const schema = resolve(media.schema);
    for (const branch of [schema, ...(schema?.allOf ?? []), ...(schema?.anyOf ?? []), ...(schema?.oneOf ?? [])]) {
      for (const key of Object.keys(resolve(branch)?.properties ?? {})) keys.add(key);
    }
  }
  return keys;
}

/**
 * Walk from a `this.api.<verb>` to its matching close paren, counting depth. The generic is
 * optional — a write written without one was once invisible to this walker, which required `<`.
 */
function callsIn(text) {
  const out = [];
  // Whitespace around the dot, for the reason `check:routes` records (`DL-143`).
  const start = /this\s*\.\s*api\s*\.\s*(postForm|patchForm|postBlob|post|patch|delete)\s*[<(]/g;
  let m;

  while ((m = start.exec(text)) !== null) {
    let i = m.index + m[0].length - 1;

    if (text[i] === '<') {
      let angle = 1;
      i++;
      while (i < text.length && angle > 0) {
        if (text[i] === '<') angle++;
        else if (text[i] === '>') angle--;
        i++;
      }
      while (i < text.length && text[i] !== '(') i++;
    }

    let depth = 0;
    const open = i;

    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    out.push({ verb: m[1], args: text.slice(open + 1, i), line: text.slice(0, m.index).split('\n').length });
  }

  return out;
}

/** Split an argument list on top-level commas only. */
function topLevelArgs(args) {
  const parts = [];
  let depth = 0;
  let tick = false;
  let current = '';

  for (const ch of args) {
    if (ch === '`') tick = !tick;

    if (!tick) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim() !== '') parts.push(current.trim());

  return parts;
}

function pathOf(argument) {
  const template = /^`\$\{API_ENDPOINTS\.(\w+)\}([^`]*)`$/.exec(argument);
  const bare = /^API_ENDPOINTS\.(\w+)$/.exec(argument);

  if (template !== null && lookup[template[1]] !== undefined) {
    return lookup[template[1]] + template[2].replace(/\$\{[^}]+\}/g, '{}').split('?')[0];
  }
  return bare !== null ? (lookup[bare[1]] ?? null) : null;
}

const calls = callsIn(src);
let checked = 0;

/*
 * Every write call site must have been walked. Relative rather than the old floor of forty: a
 * walker that misses a call reports a spotless adapter, and two writes cannot clear a number set
 * for seventy-two.
 */
const rawSites = [...src.matchAll(/this\s*\.\s*api\s*\.\s*(postForm|patchForm|postBlob|post|patch|delete)\b/g)].length;

if (calls.length !== rawSites) {
  failures.push(`${rawSites} write call sites and ${calls.length} were walked. The walker is broken, not the code.`);
}

/*
 * The `…Wire` interface a `toWire…` mapper answers with, and its top-level keys — or `null` when the
 * mapper, its declared answer, or that interface cannot be found under data/http/mappers.
 */
const MAPPERS = join(HTTP, 'mappers');
const mapperSources = readdirSync(MAPPERS)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .map((file) => readFileSync(join(MAPPERS, file), 'utf8'));

function wireKeysOf(mapper) {
  for (const source of mapperSources) {
    const signature = new RegExp(`export function ${mapper}\\s*\\([^)]*\\)\\s*:\\s*(\\w+Wire)\\s*\\{`).exec(source);
    if (signature === null) continue;

    const opening = new RegExp(`export interface ${signature[1]}\\s*\\{`).exec(source);
    if (opening === null) return null;

    const keys = [];
    let depth = 1;
    let line = '';
    for (const ch of source.slice(opening.index + opening[0].length)) {
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
      if (ch === '\n') {
        const key = depth === 1 ? /^\s*(?:readonly\s+)?([A-Za-z_]\w*)\??\s*:/.exec(line) : null;
        if (key !== null) keys.push(key[1]);
        line = '';
      } else {
        line += ch;
      }
    }
    return { type: signature[1], keys };
  }
  return null;
}

/** The media types the operation's request body is declared in. */
const mediaTypesOf = (operation) => Object.keys(operation?.requestBody?.content ?? {});

for (const call of calls) {
  const [pathArgument, body] = topLevelArgs(call.args);
  const where = `http-repositories.ts:${call.line}`;
  const helper = WRITE_HELPERS[call.verb];

  // A DELETE with no body sends nothing to map.
  if (body === undefined) continue;

  checked++;

  const path = pathOf(pathArgument ?? '');
  const operation = path === null ? undefined : operations.get(`${helper.verb} ${normalise(path.replace(/\/$/, ''))}`);

  if (operation === undefined) {
    failures.push(`${where}: ${helper.verb.toUpperCase()} ${pathArgument} is no operation in the vendored spec, so its body cannot be checked.`);
    continue;
  }

  const declaredMedia = mediaTypesOf(operation);
  if (declaredMedia.length > 0 && !declaredMedia.includes(helper.media)) {
    failures.push(
      `${where}: ${call.verb} sends ${helper.media} to ${helper.verb.toUpperCase()} ${path}, whose body is ` +
        `declared as ${declaredMedia.join(', ')}.\n    The server reads a body in the media type it declares; anything else arrives as nothing.`,
    );
    continue;
  }
  if (declaredMedia.length === 0 && helper.media !== 'application/json') {
    failures.push(`${where}: ${call.verb} sends a form to ${helper.verb.toUpperCase()} ${path}, which takes no body.`);
    continue;
  }

  const mapper = /^(toWire\w*)\(/.exec(body);
  if (mapper !== null) {
    const wire = wireKeysOf(mapper[1]);
    if (wire === null) {
      failures.push(
        `${where}: sends ${mapper[1]}(…), and no \`export function ${mapper[1]}(…): …Wire\` with that interface ` +
          `beside it was found under data/http/mappers. A mapper this check cannot read is not one it may call mapped.`,
      );
      continue;
    }
    const declared = declaredKeys(operation) ?? new Set();
    const undeclared = wire.keys.filter((key) => !wireShaped(key) || !declared.has(key));
    if (wire.keys.length === 0 || undeclared.length > 0) {
      failures.push(
        `${where}: ${helper.verb.toUpperCase()} ${path} sends ${wire.type}, whose ` +
          (wire.keys.length === 0 ? 'keys could not be read.' : `${undeclared.join(', ')} its request body does not declare.`),
      );
    }
    continue;
  }

  if (!body.startsWith('{')) {
    failures.push(
      `${where}: sends ${body} verbatim.\n` +
        `    The API validates snake_case and this sends a domain object as it stands. Map it with an\n` +
        `    explicit toWire… function — never a generic converter.`,
    );
    continue;
  }

  const keys = [
    ...[...body.matchAll(/(?:^|[{,]\s*)([A-Za-z_]\w*)\s*:/g)].map((k) => k[1]),
    ...[...body.matchAll(/(?:^|[{,]\s*)([A-Za-z_]\w*)\s*(?=[,}])/g)].map((k) => k[1]),
  ];
  const unique = [...new Set(keys)];
  const notWire = unique.filter((k) => !wireShaped(k));

  if (notWire.length > 0) {
    failures.push(`${where}: inline literal sends ${notWire.join(', ')}, which is not wire-shaped.`);
    continue;
  }

  const declared = declaredKeys(operation);
  const undeclared = declared === null ? unique : unique.filter((k) => !declared.has(k));

  if (undeclared.length > 0) {
    failures.push(
      `${where}: ${helper.verb.toUpperCase()} ${path} sends ${undeclared.join(', ')}, which its request body ` +
        (declared === null ? 'does not exist to declare.' : 'does not declare.') +
        `\n    A strict schema refuses it with a 422; a lenient one drops it and reports success.`,
    );
  }
}

if (failures.length > 0) {
  console.error('\nWire-adoption check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(`Wire-adoption check passed (${checked}/${checked} write bodies mapped and declared by their operation).`);
