#!/usr/bin/env node
/**
 * Newsfeed guardrail.
 *
 * The newsfeed is the only module in this application that **speaks outward**.
 * Everything else is read by staff; a post is read by residents, and once it
 * has been, nothing can take that back. Four doctrines follow, and each is the
 * kind a comment cannot hold:
 *
 *   1. **An image is described before it is published** (`DL-125`). `altText`
 *      is required on the type, checked by `postProblems` at publish, and the
 *      field is beside the image rather than behind a toggle.
 *   2. **Publishing is one-way** (`DL-124`). No transition returns a published
 *      post to draft, and no screen offers an "unpublish" or a "retract".
 *   3. **Reach is counts** (`DL-126`). Nothing in the port, the adapters or the
 *      screens can answer *which* residents reacted, commented or read.
 *   4. **Hiding keeps the words; removal deletes them** (`DL-127`). `Comment.body`
 *      is nullable for exactly that reason, every moderation records who, when
 *      and why, and nothing offers to restore what was removed.
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

/** The body of a named function, so an assertion cannot pass on a surviving import. */
const fn = (text, name) => {
  const start = text.indexOf(`export function ${name}(`);
  if (start < 0) return '';
  let depth = 0;
  let seen = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      depth += 1;
      seen = true;
    } else if (ch === '}') {
      depth -= 1;
      if (seen && depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
};

/** One `name: { … }` entry out of an object literal. */
const entry = (text, name) => {
  const start = text.indexOf(`${name}: {`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
};

const post = read('src/app/domain/newsfeed/post.ts');
const comment = read('src/app/domain/newsfeed/comment.ts');
const ports = read('src/app/domain/ports/repositories.ts');
const mock = read('src/app/data/mock/mock-newsfeed.repository.ts');
const seed = read('src/app/data/mock/seed/newsfeed.seed.ts');
const copy = read('src/app/features/newsfeed/newsfeed.copy.ts');
const routes = read('src/app/app.routes.ts');

const featureFiles = walk('src/app/features/newsfeed', new Set(['.ts', '.html'])).filter(
  // A spec quotes the words it forbids in order to prove they are absent, and
  // it reaches the mock adapter through the TestBed on purpose. Scanning it
  // would make every rule below assert its own test out of existence.
  (file) => !file.endsWith('.spec.ts'),
);
const featureText = featureFiles.map((file) => read(file)).join('\n');
const templates = featureFiles.filter((file) => file.endsWith('.html'));

/**
 * The same text with its comments taken out.
 *
 * A rule about words a screen must never *offer* has to read what the screen
 * says, not the paragraph above it explaining why the word is absent — or the
 * first person to document the rule trips it, and weakens the rule to get
 * their build green.
 */
const spoken = featureText
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ── 1. An image is described before it goes out ──────────────────────────── */

const image = post.match(/export interface PostImage \{[\s\S]*?\n\}/)?.[0] ?? '';
if (image === '') {
  problems.push('`PostImage` has gone. The image and its description are one record, not two.');
} else {
  if (/altText\?:/.test(image)) {
    problems.push(
      '`PostImage.altText` is optional. An optional description is one that is usually absent, ' +
        'and a municipal advisory whose only content is a poster is unreachable to the residents ' +
        'most likely to need it read aloud (`DL-125`).',
    );
  }
  if (/altText:\s*string\s*\|\s*null/.test(image)) {
    problems.push(
      '`PostImage.altText` is nullable. Nullable means the composer can save an image with no ' +
        'description and the publisher never has to answer for it (`DL-125`).',
    );
  }
  if (!/altText:\s*string;/.test(image)) {
    problems.push('`PostImage.altText` is no longer a required string.');
  }
}

const problemsFn = fn(post, 'postProblems');
if (problemsFn === '') {
  problems.push('`postProblems` has gone. Publication rules stated only on a screen are advice.');
} else {
  if (!/image-without-alt-text/.test(problemsFn)) {
    problems.push(
      '`postProblems` no longer refuses an undescribed image. The rule has to be in the domain, ' +
        'or the HTTP adapter and any future screen are free to skip it (`DL-125`).',
    );
  }
  // Leniency while drafting is deliberate, and equally a rule: a half-written
  // post is somebody working, not an accessibility failure.
  if (!/intent\s*===\s*'publish'|intent\s*!==\s*'save'/.test(problemsFn)) {
    problems.push(
      '`postProblems` applies its rules without regard to intent. Refusing to *save* a draft ' +
        'because the description is not written yet punishes somebody mid-sentence (`DL-125`).',
    );
  }
}

const altMessage = post.match(/'image-without-alt-text':[\s\S]*?,\n/)?.[0] ?? '';
if (!/screen reader/.test(altMessage)) {
  problems.push(
    'The undescribed-image message no longer says who is affected. "Alt text required" is a ' +
      'rule; "a resident using a screen reader gets nothing" is a reason somebody acts on.',
  );
}

const composer = templates.find((file) => file.includes('composer'));
if (composer === undefined) {
  problems.push('The composer template has gone.');
} else {
  const markup = read(composer);
  if (/<details/.test(markup)) {
    problems.push(
      'The composer has a `<details>` disclosure. The description field must sit beside the ' +
        'image; a field reachable only through "advanced" is a field that stays empty (`DL-125`).',
    );
  }
  if (!/copy\.altText\b/.test(markup)) {
    problems.push('The composer no longer renders the image-description field.');
  }
}
notes.push('alt text: required on the type, refused at publish, lenient on save, beside the image');

/* ── 2. Publishing is one-way ─────────────────────────────────────────────── */

const transitions = post.match(/POST_STATUS_TRANSITIONS[\s\S]*?\n\};/)?.[0] ?? '';
if (transitions === '') {
  problems.push('`POST_STATUS_TRANSITIONS` has gone.');
} else {
  const published = /published:\s*\[([^\]]*)\]/.exec(transitions)?.[1] ?? '';
  if (/draft|scheduled/.test(published)) {
    problems.push(
      'A published post can return to draft or scheduled. It cannot: residents have read it, ' +
        'and a status that says otherwise is the software lying about what happened (`DL-124`).',
    );
  }
  if (!/archived/.test(published)) {
    problems.push('A published post has no way to be archived, which is its only real exit.');
  }
}

const publishedBadge = entry(post, 'published');
if (!/cannot be unsent/.test(publishedBadge)) {
  problems.push(
    'The published badge no longer says the post cannot be unsent. The office reads the badge, ' +
      'not the transition map.',
  );
}
const archivedBadge = entry(post, 'archived');
if (!/already read it/.test(archivedBadge)) {
  problems.push(
    'The archived badge no longer says archiving does not reach anybody who already read it. ' +
      'Without that sentence, archive reads as undo.',
  );
}

for (const word of ['unpublish', 'retract', 'unsend', 'recall']) {
  if (new RegExp(word, 'i').test(spoken)) {
    problems.push(
      `A newsfeed screen offers "${word}". Nothing in this module can take a post back from ` +
        'somebody who already read it (`DL-124`).',
    );
  }
}
if (!/It cannot be unsent/.test(copy.replace(/\s+/g, ' '))) {
  problems.push(
    'The publish warning has gone. It is shown *before* the act rather than as a confirmation ' +
      'after it, so it has to exist in the copy.',
  );
}
notes.push('publishing: one-way in the map, on the badge, in the warning, and in the screens');

/* ── 3. Reach is counts, never people ─────────────────────────────────────── */

const DISCLOSING = [
  ['reactedBy', 'names who reacted'],
  ['reactors', 'lists reactors'],
  ['likedBy', 'names who liked'],
  ['reactionList', 'lists reactions individually'],
  ['viewedBy', 'names who read the post'],
  ['readBy', 'names who read the post'],
  ['seenBy', 'names who saw the post'],
  ['engagementList', 'lists engagement per person'],
];
for (const [field, what] of DISCLOSING) {
  for (const [name, text] of [
    ['the post domain', post],
    ['the newsfeed port', ports],
    ['the mock adapter', mock],
    ['a newsfeed screen', featureText],
  ]) {
    if (new RegExp(`\\b${field}\\b`).test(text)) {
      problems.push(
        `${name} ${what} (\`${field}\`). The office is told how many, never which residents ` +
          '(`DL-126`).',
      );
    }
  }
}

const newsfeedPort = ports.match(/export interface NewsfeedRepository \{[\s\S]*?\n\}/)?.[0] ?? '';
if (newsfeedPort === '') {
  problems.push('`NewsfeedRepository` has gone.');
} else if (/ResidentId\[\]|readonly ResidentId/.test(newsfeedPort)) {
  problems.push(
    '`NewsfeedRepository` returns resident identifiers. There must be no method that could ' +
      'answer "who reacted" — the safest way to keep a screen from rendering it is to leave the ' +
      'question unanswerable (`DL-126`).',
  );
}
if (!/reactionCount/.test(post) || !/commentCount/.test(post)) {
  problems.push('The post no longer carries counts, which are what reach is reported as.');
}
notes.push('reach: counts only, and no port method that could answer otherwise');

/* ── 4. Hiding keeps the words; removal deletes them ──────────────────────── */

const commentType = comment.match(/export interface Comment \{[\s\S]*?\n\}/)?.[0] ?? '';
if (commentType === '') {
  problems.push('`Comment` has gone.');
} else if (!/body:\s*string\s*\|\s*null/.test(commentType)) {
  problems.push(
    '`Comment.body` is no longer nullable. Removal deletes the words — keeping abusive text ' +
      'forever to satisfy an append-only rule preserves the harm it did (`DL-127`).',
  );
}
for (const field of ['moderationReason', 'moderatedBy', 'moderatedAt']) {
  if (!new RegExp(`${field}:`).test(commentType)) {
    problems.push(
      `\`Comment.${field}\` has gone. The words may go; who removed them, when and why stays on ` +
        'file (`DL-127`).',
    );
  }
}

const moderation = fn(comment, 'moderationProblems');
if (moderation === '') {
  problems.push('`moderationProblems` has gone.');
} else {
  if (!/reason-required/.test(moderation)) {
    problems.push(
      'Moderation no longer requires a reason. Hiding somebody\'s words is a decision the office ' +
        'has to be able to explain months later.',
    );
  }
  if (!/already-removed/.test(moderation)) {
    problems.push(
      'A removed comment can be moderated again. Offering a restore on words that no longer ' +
        'exist promises something the data cannot deliver (`DL-127`).',
    );
  }
}

const removedBadge = entry(comment, 'removed');
if (!/cannot be restored/.test(removedBadge) || !/stays on file/.test(removedBadge)) {
  problems.push(
    'The removed badge no longer states both halves — the words cannot be restored, and the act ' +
      'stays on file. Half of that sentence is a different promise from the whole.',
  );
}
const hiddenBadge = entry(comment, 'hidden');
if (!/can be put back/.test(hiddenBadge)) {
  problems.push(
    'The hidden badge no longer says the comment can be put back, which is the entire difference ' +
      'between the two outcomes.',
  );
}

const confirm = copy.replace(/\s+/g, ' ');
if (!/cannot be brought back/.test(confirm) || !/Hide it instead/.test(confirm)) {
  problems.push(
    'The removal confirmation no longer offers hiding as the alternative. A confirmation that ' +
      'only warns leaves somebody choosing between removal and nothing.',
  );
}
if (/\bdelete\b/i.test(entry(copy, 'detail').replace(/deleted and cannot be brought back/i, ''))) {
  problems.push(
    'The detail copy calls removal a delete. "Delete" promises the record goes too, and it does ' +
      'not — who removed it, when and why is kept.',
  );
}
notes.push('moderation: nullable body, required reason, terminal removal, and the badge says so');

/* ── 5. Every mutation is reasoned and recorded ───────────────────────────── */

const MUTATORS = [
  'saveDraft',
  'publish',
  'schedule',
  'archive',
  'setPinned',
  'setCommentsEnabled',
  'moderate',
];
for (const mutator of MUTATORS) {
  const signature = new RegExp(`${mutator}\\(([^)]*)\\)`).exec(newsfeedPort)?.[1] ?? '';
  if (signature === '') {
    problems.push(`\`NewsfeedRepository.${mutator}\` has gone.`);
    continue;
  }
  if (mutator === 'moderate') {
    // One parameter serving as the reason for a hide and the words for a
    // reply, which is why `moderationProblems` refuses a blank either way.
    if (!/text:\s*string/.test(signature)) {
      problems.push(
        '`NewsfeedRepository.moderate` no longer takes the text that is either the reason or the ' +
          'reply. Both are required; neither is optional.',
      );
    }
    continue;
  }
  if (mutator !== 'saveDraft' && !/reason:\s*string/.test(signature)) {
    problems.push(
      `\`NewsfeedRepository.${mutator}\` no longer takes a required reason. Every act on a post ` +
        'the public can see is one the office may be asked to justify.',
    );
  }
}
const moveBody = /\n  private move\([\s\S]*?\n  \}\n/.exec(mock)?.[0] ?? '';
if (moveBody === '') {
  problems.push('`MockNewsfeedRepository.move` has gone; three status changes went through it.');
} else if (!/this\.record\(/.test(moveBody)) {
  problems.push(
    '`MockNewsfeedRepository.move` no longer appends to the trail, and every status change goes ' +
      'through it. The record and the change are one act (`DL-54`).',
  );
}
for (const mutator of MUTATORS) {
  const start = mock.indexOf(`\n  ${mutator}(`);
  if (start < 0) {
    problems.push(`\`MockNewsfeedRepository.${mutator}\` has gone.`);
    continue;
  }
  const rest = mock.slice(start + 1);
  const next = rest.search(/\n  (?:private |protected |readonly )?[a-zA-Z]+\(/);
  const body = next < 0 ? rest : rest.slice(0, next);
  // Recording inline, or delegating to `move`, which records. Doing neither
  // means a post changed and nothing anywhere says who changed it.
  if (!/this\.record\(|this\.move\(/.test(body)) {
    problems.push(
      `\`MockNewsfeedRepository.${mutator}\` changes a post without appending to the trail. The ` +
        'record and the change are one act, or the trail is a best effort (`DL-54`).',
    );
  }
}
notes.push(`mutations: ${MUTATORS.length} reasoned on the port and recorded in the adapter`);

/* ── 6. Scheduling is derived, never a promise of a job ───────────────────── */

const live = fn(post, 'isLiveToResidents');
if (live === '') {
  problems.push('`isLiveToResidents` has gone. What residents can see must be derived somewhere.');
} else if (!/scheduledFor/.test(live)) {
  problems.push(
    '`isLiveToResidents` ignores the scheduled time. A scheduled post whose hour has passed is ' +
      'live whether or not anything ran — deriving it from a flag needs a job this application ' +
      'does not have.',
  );
}
for (const promise of ['setTimeout', 'setInterval', 'cron', 'queueMicrotask']) {
  if (new RegExp(`\\b${promise}\\b`).test(post + comment + mock + featureText)) {
    problems.push(
      `The newsfeed uses \`${promise}\`. There is no scheduler here; a post going out on time is ` +
        'the backend\'s job, and a client-side timer is a promise this application cannot keep.',
    );
  }
}

/* ── 7. Nothing is written to the browser ─────────────────────────────────── */

for (const store of ['localStorage', 'sessionStorage', 'document.cookie']) {
  if (new RegExp(store.replace('.', '\\.')).test(featureText)) {
    problems.push(
      `A newsfeed screen writes to ${store}. Draft wording about a family, a flood or an ` +
        'evacuation is personal information and does not belong in a browser store (`DL-110`).',
    );
  }
}

/* ── 8. The seam holds, and residents have no screen here ─────────────────── */

for (const file of featureFiles) {
  if (/@data\/|data\/mock|data\/http/.test(read(file))) {
    problems.push(`${file} imports the data layer directly. Features depend on ports.`);
  }
}
if (/resident-post|resident-feed|ResidentPostPage|ResidentFeed/.test(featureText)) {
  problems.push(
    'A resident-facing newsfeed screen has appeared. This repository is the staff console; the ' +
      'resident contract is types only (`DL-123`).',
  );
}
/**
 * Every newsfeed child route, read out of the block rather than searched for
 * across the file.
 *
 * Three routes here ask for two permissions, so "the string `newsfeed.view`
 * appears somewhere in `app.routes.ts`" is satisfied by a sibling and says
 * nothing about the route that lost its guard.
 */
const newsfeedBlock = (() => {
  const start = routes.indexOf("path: 'newsfeed'");
  if (start < 0) return '';
  const from = routes.indexOf('children: [', start);
  if (from < 0) return '';
  let depth = 0;
  for (let i = routes.indexOf('[', from); i < routes.length; i += 1) {
    if (routes[i] === '[') depth += 1;
    else if (routes[i] === ']') {
      depth -= 1;
      if (depth === 0) return routes.slice(from, i + 1);
    }
  }
  return '';
})();

if (newsfeedBlock === '') {
  problems.push('The newsfeed routes have gone, or no longer sit under one parent.');
} else {
  const EXPECTED = [
    ["''", 'newsfeed.view'],
    ["'new'", 'newsfeed.create'],
    ["':id'", 'newsfeed.view'],
  ];
  const children = newsfeedBlock.split(/\n\s{10}\{/).slice(1);
  if (children.length !== EXPECTED.length) {
    problems.push(
      `The newsfeed has ${children.length} child routes and ${EXPECTED.length} are accounted ` +
        'for. An unlisted route is an unchecked one.',
    );
  }
  for (const [path, permission] of EXPECTED) {
    const child = children.find((text) => new RegExp(`path: ${path}[,\\n]`).test(text));
    if (child === undefined) {
      problems.push(`The newsfeed route ${path} has gone.`);
      continue;
    }
    if (!new RegExp(`permissionGuard\\('${permission}'\\)`).test(child)) {
      problems.push(
        `The newsfeed route ${path} is not guarded by ${permission}. A guard on a sibling route ` +
          'protects nothing here.',
      );
    }
  }
}

// `new` before `:id`, or the composer is read as a post id and 404s. Read out
// of the newsfeed block: another module's `new` route says nothing about this
// one's ordering.
const newAt = newsfeedBlock.indexOf("path: 'new'");
const idAt = newsfeedBlock.indexOf("path: ':id'");
if (newAt >= 0 && idAt >= 0 && newAt > idAt) {
  problems.push(
    "The newsfeed's `:id` route precedes `new`, so the composer resolves as a post id. Order " +
      'matters here and nothing else in the file would show it.',
  );
}

if (!/MOCK_COMMENTS/.test(seed) || !/state: 'removed'/.test(seed) || !/state: 'hidden'/.test(seed)) {
  problems.push(
    'The seed no longer covers both moderation outcomes. A hidden and a removed comment are ' +
      'what make the difference visible to anybody reading the screens.',
  );
}
notes.push('seam: no data imports, no resident screen, routes guarded and ordered');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nNewsfeed check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Newsfeed check passed.');
