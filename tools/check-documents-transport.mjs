#!/usr/bin/env node
/**
 * check:documents-transport — the four TAB 09 guardrails, as rules a comment cannot hold.
 *
 *   1. No document version is ever deleted or overwritten by any code path.
 *   2. No document is fetched by a URL the client constructed. The grant comes from the server.
 *   3. Never widen a bucket to public to make a preview work.
 *   4. Never render a full document number where the masked one is specified.
 *
 * Plus the one TAB 09 adds about the console specifically: a downloaded file is never written to
 * browser storage. A medical abstract in `localStorage` outlives the session, the grant, and the
 * permission that allowed it.
 *
 * ## Why a check and not a review note
 *
 * Every one of these fails **silently and later**. A screen that builds its own document URL works
 * perfectly for the person who wrote it — they hold the permission — and leaks the day somebody
 * without it opens the same page. That is the shape of defect a build should refuse, because no
 * reviewer reads every template every time.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const failures = [];

function walk(dir, extensions) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/** Comments state the rules; they must not trip them. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const sources = walk(join(ROOT, 'src/app'), ['.ts', '.html']).filter(
  (f) => !f.endsWith('.spec.ts'),
);

for (const file of sources) {
  const path = relative(ROOT, file);
  const source = code(readFileSync(file, 'utf8'));

  // ── 1. nothing removes a version ─────────────────────────────────────────
  if (/\b(deleteVersion|removeVersion|purgeVersion|replaceVersion)\b/.test(source)) {
    failures.push(
      `${path} names a document-version delete or replace.\n` +
        `    Versions append. The superseded copy is the evidence of what the office actually read\n` +
        `    when it decided, and a request approved on a certificate replaced two months later has\n` +
        `    to stay explicable a year on (DL-77).`,
    );
  }

  /*
   * ── 2. the grant comes from the server ───────────────────────────────────
   *
   * Only paths that fetch BYTES are forbidden. Asking for a grant is a different act: the console
   * must build `.../documents/{version}/access` to request one, and that endpoint returns JSON
   * after an authorization decision and an audit entry. The first version of this rule flagged it,
   * which would have taught somebody to weaken the check rather than the code.
   *
   * So: a `documents/${…}` segment that is not followed by `/access` is a byte fetch this client
   * assembled, and the only sanctioned one is `documents/${grant.handle}` inside the transport.
   */
  const constructed = /documents\/\$\{(?!\s*grant\.handle)[^}]*\}(?!\/access|[^'"`]*\/access)/.test(
    source,
  );

  if (constructed && !path.endsWith('data/http/file-transport.ts')) {
    failures.push(
      `${path} builds a document URL from an identifier.\n` +
        `    The grant is the only way in: it is opaque, single-use and issued to one account. A\n` +
        `    screen holding a URL it assembled is one edit away from fetching a file it may not read.`,
    );
  }

  // ── 3. no public bucket, no durable object URL ───────────────────────────
  if (/\b(publicUrl|toPublicUrl|s3\.amazonaws|storage\.googleapis|\.blob\.core\.windows)\b/.test(source)) {
    failures.push(
      `${path} refers to a public object URL.\n` +
        `    Objects reach a caller through an authorization-gated endpoint or a short-lived signed\n` +
        `    URL issued after a server-side decision. Never by widening a bucket to make a preview work.`,
    );
  }

  // ── 4. a downloaded file never persists in the browser ───────────────────
  if (/\b(localStorage|sessionStorage|indexedDB|caches)\b/.test(source)) {
    const nearFiles = /\b(blob|Blob|download|document|grant)\b/i.test(source);

    if (nearFiles) {
      failures.push(
        `${path} touches browser storage in a file-handling module.\n` +
          `    A downloaded medical abstract in localStorage outlives the session, the grant, and the\n` +
          `    permission that allowed it (TAB 09 step 9).`,
      );
    }
  }
}

// ── 5. the masked number is what the domain publishes ──────────────────────
//
// The API masks before it sends and never keeps the full number, so the console cannot render one
// even by accident. What it CAN do is invent a field that looks like it holds one, which is how a
// later change starts populating it.
const domain = walk(join(ROOT, 'src/app/domain'), ['.ts']).filter((f) => !f.endsWith('.spec.ts'));

for (const file of domain) {
  const source = code(readFileSync(file, 'utf8'));

  if (/\b(fullDocumentNumber|unmaskedNumber|documentNumberFull)\b/.test(source)) {
    failures.push(
      `${relative(ROOT, file)} declares a field for an unmasked document number.\n` +
        `    Only the last four characters are ever held or displayed. A field for the whole number\n` +
        `    is a field somebody eventually fills.`,
    );
  }
}

if (failures.length > 0) {
  console.error('\nDocument transport check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(`Document transport check passed (${sources.length} files).`);
