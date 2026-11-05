#!/usr/bin/env node
/**
 * Emit — or check — what this console actually reads off the wire.
 *
 * This is the **consumer half of a contract test**. It produces
 * `docs/integration/consumer-expectations.json`: for every endpoint a mapper
 * consumes, the wire fields the console requires and the ones it merely uses.
 *
 * The Laravel backend vendored that file and replayed it against its router.
 * The Node backend has no replay, so the comparison now runs here instead
 * (`DL-165`): every field a mapper reads must be a property of that
 * operation's response in the vendored `openapi.json`, and every field the
 * console **requires** must be one the spec marks required. A mapper that
 * reads a field the API does not send renders a blank; one that requires a
 * field the API may omit drops the record, and the screen shows one fewer
 * row with no error anywhere.
 *
 * ## It is derived, never written
 *
 * The expectations come from parsing the mappers — the `field(wire, '…')` calls
 * and the null-guards that decide whether a record survives. A hand-written
 * expectations file would be a *third* description of the API, alongside the
 * mapper and the backend, and this integration has yet to find two descriptions
 * of one thing that agreed. `--check` fails when the committed file no longer
 * matches the mappers, so the two cannot drift apart quietly.
 *
 * ## Required versus optional, and why the line sits there
 *
 * A **required** field is one whose absence makes the mapper return `null` — the
 * record is dropped, and the screen shows one fewer resident with no error
 * anywhere. That is the failure mode worth a CI gate: L-15 was exactly this
 * shape, where `barangay_id` arrived as a number, every mapper rejected it, and
 * the list would simply have been empty.
 *
 * An **optional** field is read but tolerated as absent. Its disappearance
 * degrades a screen rather than emptying it, so it is reported, not enforced.
 *
 * ## What it deliberately does not do
 *
 * It records no types and no values — only field names and whether the console
 * can survive without them. Types are the vendored contract's job
 * (`check:contract-drift`), and a recorded value would put a resident's data in
 * a file that leaves this repository.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAPPERS = join(ROOT, 'src/app/data/http/mappers');
const OUTPUT = join(ROOT, 'docs/integration/consumer-expectations.json');

/**
 * The body of a top-level exported function, from its signature to the `}` in
 * column zero that closes it. Nested helpers in the same file map *nested*
 * objects — an observation inside a visit — and their fields are not fields of
 * the endpoint's payload.
 */
function topLevelFunctionBody(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) return null;
  const end = source.indexOf('\n}\n', start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

/** Every `field(wire, 'x')` read directly off the payload root. */
function directReads(body) {
  return [...body.matchAll(/\bfield\(wire, '([a-z0-9_]+)'\)/g)].map((m) => m[1]);
}

/**
 * The fields whose absence drops the record.
 *
 * Resolved rather than guessed: collect the identifiers named in every
 * `if (… === null …) { return null; }` guard, then look up the `const` that
 * declared each one and read the field name out of it. An identifier that is
 * guarded but not declared from a direct `field(wire, …)` read — one built from
 * a nested object, say — simply has no field to require, and is skipped.
 */
function requiredFields(body) {
  const declared = new Map();
  for (const m of body.matchAll(/const (\w+) = [^;]*?\bfield\(wire, '([a-z0-9_]+)'\)/g)) {
    if (!declared.has(m[1])) declared.set(m[1], m[2]);
  }

  const required = new Set();
  for (const guard of body.matchAll(/if \(([^)]*?=== null[^)]*?)\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*return null;/g)) {
    for (const ref of guard[1].matchAll(/(\w+) === null/g)) {
      const wireField = declared.get(ref[1]);
      if (wireField) required.add(wireField);
    }
  }
  return required;
}

const interactions = [];

for (const file of readdirSync(MAPPERS).filter((f) => f.endsWith('.mapper.ts'))) {
  const source = readFileSync(join(MAPPERS, file), 'utf8');

  // `@consumes GET admin/residents` immediately above the function it documents.
  const blocks = [...source.matchAll(/((?:\s\*\s@consumes [^\n]+\n)+)\s\*\/\nexport function (\w+)\(/g)];

  for (const [, tagBlock, fn] of blocks) {
    const body = topLevelFunctionBody(source, fn);
    if (body === null) continue;

    const required = requiredFields(body);
    const reads = [...new Set(directReads(body))].sort();

    for (const tag of tagBlock.matchAll(/@consumes (\w+) (\S+)/g)) {
      interactions.push({
        method: tag[1],
        path: tag[2],
        consumer: `${file}#${fn}`,
        required: reads.filter((f) => required.has(f)),
        optional: reads.filter((f) => !required.has(f)),
      });
    }
  }
}

interactions.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));

/*
 * ── Held to the vendored spec ─────────────────────────────────────────────
 *
 * The object a mapper reads is the `data` of the operation's 200 answer — the item itself, or one
 * element of a list. Its declared properties are what the console may read; its `required` list is
 * what the console may depend on.
 */
const spec = JSON.parse(readFileSync(join(ROOT, 'src/app/data/http/contract/openapi.json'), 'utf8'));

const resolve = (schema) => {
  const ref = schema?.$ref;
  if (typeof ref !== 'string') return schema;
  return resolve(ref.replace(/^#\//, '').split('/').reduce((node, key) => node?.[key], spec));
};

const normalise = (path) => path.replace(/\{[^}]+\}/g, '{}');

/**
 * `allOf` is one object written in parts — `VerificationRequestStaff` is the citizen view plus
 * `notes` (`DL-167`). Its properties, and its required list, are the union of the parts': allOf
 * demands every part, so a field one part requires the whole requires. Without this the staff view
 * read as "no response object", and the comparison had nothing to hold the mapper to.
 */
function flatten(schema) {
  const resolved = resolve(schema);
  if (!Array.isArray(resolved?.allOf)) return resolved;
  const parts = resolved.allOf.map(flatten);
  return {
    type: 'object',
    properties: Object.assign({}, ...parts.map((part) => part?.properties ?? {}), resolved.properties ?? {}),
    required: [...new Set([...parts.flatMap((part) => part?.required ?? []), ...(resolved.required ?? [])])],
  };
}

function payloadOf(method, path) {
  for (const [candidate, item] of Object.entries(spec.paths ?? {})) {
    if (normalise(candidate.replace(/^\/api\/v1\//, '')) !== normalise(path)) continue;

    const answer = resolve(item[method.toLowerCase()]?.responses?.['200']?.content?.['application/json']?.schema);
    const data = resolve(answer?.properties?.data);
    return [data?.type].flat().includes('array') ? flatten(data.items) : flatten(data);
  }
  return undefined;
}

const contractFailures = [];

if (interactions.length === 0) {
  contractFailures.push('No `@consumes` tag was read from any mapper, so nothing was compared.');
}

for (const interaction of interactions) {
  const payload = payloadOf(interaction.method, interaction.path);
  const where = `${interaction.consumer} (${interaction.method} ${interaction.path})`;

  if (payload?.properties === undefined) {
    contractFailures.push(`${where}: the vendored spec declares no response object for this operation.`);
    continue;
  }

  const declared = new Set(Object.keys(payload.properties));
  const guaranteed = new Set(payload.required ?? []);

  for (const field of [...interaction.required, ...interaction.optional]) {
    if (!declared.has(field)) {
      contractFailures.push(`${where}: reads '${field}', which the API does not send. It renders as blank.`);
    }
  }

  for (const field of interaction.required) {
    if (declared.has(field) && !guaranteed.has(field)) {
      contractFailures.push(
        `${where}: drops the record without '${field}', which the API may omit. One fewer row, no error.`,
      );
    }
  }
}

if (contractFailures.length > 0) {
  console.error('\nConsumer expectations disagree with the vendored spec:\n');
  for (const failure of contractFailures) console.error(`  ${failure}\n`);
  process.exit(1);
}

const document = {
  $comment:
    'Generated by tools/emit-consumer-expectations.mjs — do not edit. ' +
    'Derived from the field reads and null-guards in src/app/data/http/mappers/. ' +
    '"required" means the console drops the record when the field is absent.',
  consumer: 'Upupapp/taytay-admin-web',
  interactions,
};

const rendered = JSON.stringify(document, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let committed = '';
  try {
    committed = readFileSync(OUTPUT, 'utf8');
  } catch {
    console.error('\nConsumer expectations have never been emitted. Run: npm run contract:emit\n');
    process.exit(1);
  }

  if (committed !== rendered) {
    console.error(
      '\nConsumer expectations are stale — a mapper changed what it reads and the committed\n' +
        'file still describes the old shape. The backend verifies against that file, so a stale\n' +
        'copy means it is proving the wrong thing.\n\n' +
        '  Run: npm run contract:emit\n',
    );
    process.exit(1);
  }

  const total = interactions.reduce((n, i) => n + i.required.length, 0);
  console.log(`Consumer expectations current (${interactions.length} interactions, ${total} required fields).`);
} else {
  writeFileSync(OUTPUT, rendered);
  console.log(`Wrote ${interactions.length} interactions to docs/integration/consumer-expectations.json`);
}
