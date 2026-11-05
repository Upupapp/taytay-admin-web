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
 * Anything else fails. Against the Laravel API this was a ratchet — eight bodies were known to be
 * sent unmapped, carried in `unmapped-writes.json` — and every one of them belonged to an adapter
 * that now makes no request, so the count reached zero by removal and the baseline file is gone.
 */

import { readFileSync } from 'node:fs';
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

const WRITE_VERBS = { post: 'post', patch: 'patch', delete: 'delete' };

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
  const start = /this\s*\.\s*api\s*\.\s*(post|patch|delete)\s*[<(]/g;
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
const rawSites = [...src.matchAll(/this\s*\.\s*api\s*\.\s*(post|patch|delete)\b/g)].length;

if (calls.length !== rawSites) {
  failures.push(`${rawSites} write call sites and ${calls.length} were walked. The walker is broken, not the code.`);
}

for (const call of calls) {
  const [pathArgument, body] = topLevelArgs(call.args);
  const where = `http-repositories.ts:${call.line}`;

  // A DELETE with no body sends nothing to map.
  if (body === undefined) continue;

  checked++;

  if (/^toWire\w*\(/.test(body)) continue;

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

  const path = pathOf(pathArgument ?? '');
  const operation = path === null ? undefined : operations.get(`${call.verb} ${normalise(path.replace(/\/$/, ''))}`);

  if (operation === undefined) {
    failures.push(`${where}: ${call.verb.toUpperCase()} ${pathArgument} is no operation in the vendored spec, so its body cannot be checked.`);
    continue;
  }

  const declared = declaredKeys(operation);
  const undeclared = declared === null ? unique : unique.filter((k) => !declared.has(k));

  if (undeclared.length > 0) {
    failures.push(
      `${where}: ${call.verb.toUpperCase()} ${path} sends ${undeclared.join(', ')}, which its request body ` +
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
