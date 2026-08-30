#!/usr/bin/env node
/**
 * Vendors the response **envelope** each published route answers with.
 *
 * ## The fourth question
 *
 * Three ratchets already ask three things about a request. `check:routes` asks whether it reaches a
 * real endpoint at that verb; `check:wire-adoption` asks whether its body would be understood;
 * `check:port-adoption` asks whether anybody makes it at all. **None of them asks whether the
 * answer would be understood**, and that gap let `listDocumentRequests` call `collection<T>` on an
 * endpoint answering `{ "requests": [...] }` — so `data` was an object, the helper handed back a
 * non-array, and every screen reading it would have shown an empty list.
 *
 * ## Why a vendored artefact rather than a runtime check
 *
 * The envelope is a property of the **server**, and this console has no server to ask. It is
 * derived here the way the route list is: read out of the backend once, written down with the
 * commit it came from, and compared against locally. A snapshot that cannot say where it came from
 * is one nobody can tell is stale — so this writes its provenance beside it.
 *
 * ## How the extraction works, and why it is trustworthy
 *
 * Every controller answers through `ApiResponse::item`, `::created` (an item with a 201) or
 * `::page`. There is **no `ApiResponse::collection`** — which is itself the finding, because the
 * console's `collection<T>` helper expects a bare array in `data` and nothing in this API produces
 * one except a `page`.
 *
 * Each `Route::verb('path', [Controller::class, 'method'])` is resolved to that method's body by
 * brace-matching, and the body is scanned for the envelope it returns. The extraction was measured
 * before it was trusted: **286 of 288 routes resolve to exactly one envelope, and none resolves to
 * two.** The two that do not are a raw CSV stream and a preference write, both of which return
 * something other than an envelope and are recorded as `none` rather than guessed at.
 *
 * Run: `node tools/vendor-response-envelopes.mjs --backend <path>`
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = join(ROOT, 'src/app/data/http/contract');

const flagIndex = process.argv.indexOf('--backend');
const BACKEND =
  flagIndex >= 0 ? process.argv[flagIndex + 1] : join(ROOT, '..', 'taytay-backend');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.php')) out.push(full);
  }
  return out;
}

const phpFiles = walk(join(BACKEND, 'modules'));

/* ── routes → Controller@method ───────────────────────────────────────────── */

const routes = [];
for (const file of phpFiles.filter((f) => /\/routes?\//i.test(f))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(
    /Route::(get|post|patch|put|delete)\s*\(\s*'([^']+)'\s*,\s*\[\s*(\w+)::class\s*,\s*'(\w+)'\s*\]/g,
  )) {
    routes.push({ verb: m[1].toUpperCase(), path: m[2], key: `${m[3]}@${m[4]}` });
  }
}

/* ── Controller@method → body, by brace matching ──────────────────────────── */

const bodies = new Map();
for (const file of phpFiles.filter((f) => f.includes('/Controllers/'))) {
  const text = readFileSync(file, 'utf8');
  const declared = /final class (\w+)|class (\w+)/.exec(text);
  const name = declared?.[1] ?? declared?.[2];
  if (name === undefined) continue;

  for (const m of text.matchAll(/public function (\w+)\s*\([^)]*\)\s*:\s*[\w\\|]+\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.set(`${name}@${m[1]}`, text.slice(open, i));
  }
}

/* ── body → envelope ──────────────────────────────────────────────────────── */

const envelopes = {};
let ambiguous = 0;
let none = 0;

for (const route of routes) {
  const body = bodies.get(route.key);
  const key = `${route.verb} ${route.path}`;

  if (body === undefined) {
    envelopes[key] = 'unresolved';
    none++;
    continue;
  }

  const kinds = new Set(
    [...body.matchAll(/ApiResponse\s*::\s*(item|page|created|noContent|accepted)\s*\(/g)].map(
      (m) => m[1],
    ),
  );
  // `created` is an item envelope with a 201; `noContent` and `accepted` carry no data at all.
  if (kinds.has('created')) {
    kinds.delete('created');
    kinds.add('item');
  }
  kinds.delete('noContent');
  kinds.delete('accepted');

  if (kinds.size === 1) {
    envelopes[key] = [...kinds][0];
  } else if (kinds.size > 1) {
    envelopes[key] = 'ambiguous';
    ambiguous++;
  } else {
    envelopes[key] = 'none';
    none++;
  }
}

const commit = execFileSync('git', ['-C', BACKEND, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sorted = Object.fromEntries(Object.entries(envelopes).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(
  join(CONTRACT, 'response-envelopes.json'),
  `${JSON.stringify(
    {
      $comment:
        'The response envelope each published route answers with, derived from ApiResponse:: in ' +
        'the controller behind it. `item` = data is an object; `page` = data is an array plus ' +
        'meta.pagination; `none` = no envelope (a stream, or a write returning nothing). ' +
        'THERE IS NO `collection` — this API has no such envelope, so a console `collection<T>` ' +
        'read is wrong wherever it appears. Regenerate with ' +
        '`node tools/vendor-response-envelopes.mjs`; never edit by hand to make a check pass.',
      repository: 'Upupapp/taytay-backend',
      commit,
      commitShort: commit.slice(0, 7),
      routeCount: Object.keys(sorted).length,
      envelopes: sorted,
    },
    null,
    2,
  )}\n`,
);

const counts = {};
for (const value of Object.values(sorted)) counts[value] = (counts[value] ?? 0) + 1;

console.log(`Vendored ${Object.keys(sorted).length} route envelopes from ${commit.slice(0, 7)}.`);
for (const [kind, n] of Object.entries(counts).sort()) console.log(`  ${kind}: ${n}`);
if (ambiguous > 0) {
  console.log(`\n  ${ambiguous} route(s) return more than one envelope and are recorded 'ambiguous'.`);
}
