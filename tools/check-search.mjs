#!/usr/bin/env node
/**
 * Global search and saved-view audit.
 *
 * TAB 20's acceptance criteria are that search results reveal only
 * role-appropriate data, that common records are findable in a few keystrokes,
 * and that filters stay understandable and removable. The first is the one that
 * cannot be walked back, so most of this file is about it:
 *
 *   1. **Search reads only what it may show** (`DL-109`). The searchable and
 *      displayable fields are the same closed set. Matching on a case note
 *      while showing no snippet still discloses it.
 *   2. **A hit carries no free text.** No `snippet`, no `context`, no
 *      `matchedText` — nothing that can hold a sentence somebody wrote about a
 *      family.
 *   3. **Nothing is persisted to the device** (`DL-110`). Recent searches live
 *      in memory for the tab, because there is no way to tell a safe query from
 *      an unsafe one.
 *   4. **Per-type permission and scope**, with the skipped types **named**
 *      rather than silently dropped (`DL-112`).
 *   5. **A shared saved view costs a separate grant** (`DL-111`).
 *
 * Exit 0 = clean, 1 = at least one violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const walk = (dir, exts) => {
  const out = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, exts));
    else if (exts.has(extname(entry))) out.push(rel);
  }
  return out;
};

const domainFiles = walk('src/app/domain/search', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/search', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);

if (domainFiles.length === 0) {
  problems.push('No search domain files found. The model has moved or been removed.');
}
if (viewFiles.length === 0) {
  problems.push('No search screen found. The feature has moved or been removed.');
}

const result = read('src/app/domain/search/search-result.ts');
const safety = read('src/app/domain/search/search-safety.ts');
const adapter = read('src/app/data/mock/mock-search.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');
const savedView = read('src/app/domain/views/saved-view.ts');
const savedViewAdapter = read('src/app/data/mock/mock-saved-view.repository.ts');

/** Joins adjacent string literals before searching prose. */
const prose = (text) => text.replace(/'\s*\+\s*'/g, '');

/** The declaration a rule is about, so a match elsewhere in the file cannot pass it. */
const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

const isComment = (line) => {
  const trimmed = line.trimStart();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
};

/* ── 1. A hit carries no free text ───────────────────────────────────────── */

const hitBlock = block(result, /export interface SearchHit\s*\{[\s\S]*?\n\}/, 'SearchHit');
const FREE_TEXT = ['snippet', 'context', 'matchedText', 'excerpt', 'body', 'notes', 'summary'];
for (const field of FREE_TEXT) {
  if (new RegExp(`readonly ${field}[?]?:`).test(hitBlock)) {
    problems.push(
      `SearchHit gained ${field}. Search is reached from every screen and crosses six record ` +
        'types; a free-text field here is the widest disclosure surface in the application ' +
        '(DL-109).',
    );
  }
}
for (const required of ['title', 'reference', 'barangayLabel', 'statusLabel']) {
  if (!new RegExp(`readonly ${required}`).test(hitBlock)) {
    problems.push(`SearchHit no longer carries ${required}.`);
  }
}
notes.push('hits: name, reference, barangay, status — and nothing else');

/* ── 2. Search reads only what it may show ───────────────────────────────── */

const neverBlock = block(
  safety,
  /export const NEVER_SEARCHED: readonly string\[\] = \[[\s\S]*?\n\];/,
  'NEVER_SEARCHED',
);
for (const required of ['body', 'reasonForRequest', 'philsysLastFour', 'findings', 'remarks']) {
  if (!neverBlock.includes(`'${required}'`)) {
    problems.push(
      `NEVER_SEARCHED no longer lists '${required}'. Matching on free text discloses it even ` +
        'with no snippet rendered (DL-109).',
    );
  }
}

// The adapter must not read any of them. Scoped to code, not comments — the
// module doc names every field it refuses, and a line scan over prose would
// flag the explanation as the violation.
const forbidden = [...neverBlock.matchAll(/'([a-zA-Z]+)'/g)].map((match) => match[1]);
for (const [index, line] of adapter.split(/\r?\n/).entries()) {
  if (isComment(line)) continue;
  for (const field of forbidden) {
    if (new RegExp(`\\.${field}\\b`).test(line)) {
      problems.push(
        `src/app/data/mock/mock-search.repository.ts:${index + 1} reads .${field}. Type a ` +
          'condition, get back one resident, and the office has said what is in that person’s ' +
          'file (DL-109).',
      );
    }
  }
}

// And no way to ask for more.
const searchPortBlock = block(
  port,
  /export interface SearchRepository\s*\{[\s\S]*?\n\}/,
  'SearchRepository',
);
if (/fields|includeNotes|deep|full|raw/i.test(searchPortBlock)) {
  problems.push(
    'SearchRepository takes a parameter that could widen what is read. One term, nothing else ' +
      '(DL-109).',
  );
}
notes.push(`fields: ${forbidden.length} refused on both sides, none read by the adapter`);

/* ── 3. Nothing is persisted to the device ───────────────────────────────── */

const STORAGE = /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/;
for (const file of [...domainFiles, ...viewFiles, 'src/app/data/mock/mock-search.repository.ts']) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (STORAGE.test(line)) {
      problems.push(
        `${file}:${index + 1} writes a search to the device. A resident's name typed into a box ` +
          'and left on a shared office machine is a disclosure nobody decided to make, and there ' +
          'is no way to tell a safe query from an unsafe one (DL-110).',
      );
    }
  }
}
if (!/never saved to this device/.test(prose(safety))) {
  problems.push('The recent-search notice no longer says nothing is saved to the device.');
}
const rendersRecentNotice = viewFiles.some(
  (file) => file.endsWith('.html') && /copy\.recentNotice/.test(read(file)),
);
if (!rendersRecentNotice) {
  problems.push(
    'No screen states that recent searches are not saved. On a shared machine there is no other ' +
      'way for an officer to know.',
  );
}
notes.push('recent: in memory for the tab, said so on screen, never written down');

/* ── 4. Per-type permission, scope, and named omissions ──────────────────── */

if (!/SEARCH_ENTITY_PERMISSIONS/.test(adapter)) {
  problems.push('The search adapter no longer applies a permission per record type.');
}
const searchBody = /\n  search\(term: string\)[\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (searchBody === '') {
  problems.push('MockSearchRepository.search has gone.');
} else {
  if (!/withheldTypes\.push/.test(searchBody)) {
    problems.push(
      'Search silently drops the types it cannot read. "You cannot see cases" and "no cases ' +
        'matched" are different answers, and a user told the wrong one concludes the record does ' +
        'not exist (DL-112).',
    );
  }
  if (!/userHasPermission\(user, SEARCH_ENTITY_PERMISSIONS\[type\]\)/.test(searchBody)) {
    problems.push('Search no longer checks the permission for each record type.');
  }
}

// Scope per producer, checked in each producer body rather than file-wide: the
// identifier survives in an import even when nothing calls it.
for (const producer of ['residentHits', 'householdHits', 'caseHits', 'requestHits']) {
  const body =
    new RegExp('private ' + producer + '\\([\\s\\S]*?\\n  \\}').exec(adapter)?.[0] ?? '';
  if (body === '') {
    problems.push(`MockSearchRepository.${producer} has gone.`);
  } else if (!/isWithinBarangayScope\(/.test(body)) {
    problems.push(
      `MockSearchRepository.${producer} no longer applies barangay scope. Search crosses every ` +
        'barangay by default, which is exactly what scope exists to stop.',
    );
  }
}

// A resident's name goes through the registry's own disclosure rules.
if (!/discloseResident\(/.test(adapter)) {
  problems.push(
    'Search no longer discloses a resident through the registry rules. A protection case’s name ' +
      'would surface here while their profile withholds it (DL-38).',
  );
}
const residentBody =
  /private residentHits\([\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (residentBody !== '' && !/this\.disclose\(/.test(residentBody)) {
  problems.push('The resident producer matches on an undisclosed name.');
}
const rendersWithheld = viewFiles.some(
  (file) => file.endsWith('.html') && /withheld\(\)/.test(read(file)),
);
if (!rendersWithheld) {
  problems.push('No screen names the record types that were not searched (DL-112).');
}
notes.push('access: per-type permission, per-producer scope, omissions named on screen');

/* ── 5. A shared saved view costs a separate grant ───────────────────────── */

if (!/export const SHARE_VIEW_PERMISSION/.test(savedView)) {
  problems.push(
    'SHARE_VIEW_PERMISSION has gone. A shared view appears for every colleague, names a ' +
      'population, and outlives whoever wrote it (DL-111).',
  );
}
const createBody = /\n  create\(draft: SavedViewDraft\)[\s\S]*?\n  \}/.exec(savedViewAdapter)?.[0] ?? '';
if (createBody === '') {
  problems.push('MockSavedViewRepository.create has gone.');
} else if (!/draft\.isShared/.test(createBody) || !/SHARE_VIEW_PERMISSION/.test(createBody)) {
  problems.push(
    'Creating a shared view no longer costs SHARE_VIEW_PERMISSION. Anyone could publish a named ' +
      'population to the whole office (DL-111).',
  );
}
const removeBody = /\n  remove\(id: SavedViewId\)[\s\S]*?\n  \}/.exec(savedViewAdapter)?.[0] ?? '';
if (removeBody === '') {
  problems.push('MockSavedViewRepository.remove has gone.');
} else if (!/SHARE_VIEW_PERMISSION/.test(removeBody)) {
  problems.push('Removing a shared view no longer costs the same grant as creating one.');
}
notes.push('saved views: personal free, office-wide behind view.share');

/* ── 6. The term stays in the URL, and short terms are refused ───────────── */

if (!/export const MIN_SEARCH_LENGTH/.test(result)) {
  problems.push(
    'MIN_SEARCH_LENGTH has gone. Two characters against a municipal registry is a directory dump ' +
      'with a filter box on top.',
  );
}
const searchPage = 'src/app/features/search/search-page.ts';
if (existsSync(join(root, searchPage))) {
  const text = read(searchPage);
  if (!/queryParamMap/.test(text)) {
    problems.push(
      'The search term no longer lives in the URL. A search should be a link somebody can send a ' +
        'colleague, and the back button should behave (DL-36).',
    );
  }
}
notes.push('term: held in the URL, short queries refused');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nSearch check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Search check passed.');
