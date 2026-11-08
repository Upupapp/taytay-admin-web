#!/usr/bin/env node
/**
 * Events guardrail.
 *
 * The events module manages registrations **made somewhere else** — by
 * residents, on their own phones, in an app this repository does not build.
 * Everything below follows from that, plus the command's own boundaries:
 *
 *   1. **The client counts; the backend decides** (`DL-129`). Capacity carries
 *      the moment it was taken, offers no verdict on whether a place exists,
 *      and promotion from the waitlist is attempted rather than predicted. The
 *      command says in as many words not to invent backend concurrency
 *      guarantees.
 *   2. **Registration availability is derived** (`DL-128`), never stored.
 *   3. **A registrant list is composed, not laid out** (`DL-130`). A closed set
 *      of fields, the display name through the resident disclosure policy, and
 *      no address, birth date, PhilSys, income or sector anywhere near it.
 *   4. **Cancelling is one-way, and past is not completed** (`DL-131`). Nothing
 *      sweeps unmarked registrants into no-shows.
 *   5. **No commercial event platform.** No ticketing, pricing, seat maps,
 *      promo codes or payment. No recurring events. No event chat or comments.
 *   6. **No resident registration from this console.** The office manages what
 *      arrives; it does not sign anybody up (`DL-123`).
 *   7. **A cover is an uploaded image, never an address** (`DL-193`). The
 *      residents' app loads a cover only from the API, so a typed link was never
 *      shown; the composer takes a file through the field that refuses what the
 *      API would refuse before anything is sent, keeps the description beside
 *      it, says what saving does to the image before its button, and every
 *      cover on screen comes through the data layer.
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

/** The body of a named function, so nothing passes on a surviving import. */
const fn = (text, name) => {
  const start = text.indexOf(`export function ${name}(`);
  if (start < 0) return '';
  let depth = 0;
  let seen = false;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') {
      depth += 1;
      seen = true;
    } else if (text[i] === '}') {
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

/** A named interface. */
const iface = (text, name) => {
  const match = new RegExp(`export interface ${name} \\{[\\s\\S]*?\\n\\}`).exec(text);
  return match?.[0] ?? '';
};

const event = read('src/app/domain/events/event.ts');
const registration = read('src/app/domain/events/registration.ts');
const ports = read('src/app/domain/ports/repositories.ts');
const mock = read('src/app/data/mock/mock-event.repository.ts');
const seed = read('src/app/data/mock/seed/events.seed.ts');
const copy = read('src/app/features/events/events.copy.ts');
const routes = read('src/app/app.routes.ts');

const featureFiles = walk('src/app/features/events', new Set(['.ts', '.html'])).filter(
  // A spec quotes the words it forbids in order to prove they are absent, and
  // reaches the adapter through the TestBed on purpose.
  (file) => !file.endsWith('.spec.ts'),
);
const featureText = featureFiles.map((file) => read(file)).join('\n');
const templates = featureFiles.filter((file) => file.endsWith('.html'));

/**
 * The same text with its comments taken out.
 *
 * Every rule below that forbids a *token* runs against this rather than the
 * raw source. A file documenting why it has no ticketing says the word
 * "ticketing"; a method explaining that it never writes a no-show says
 * "no-show". Scanning the comments makes the first person to document a rule
 * the first person to fail it — and their fix is to weaken the rule.
 */
const code = (text) =>
  text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Comment-free sources, for rules about what the code does rather than says. */
const eventCode = code(event);
const registrationCode = code(registration);
const portsCode = code(ports);
const mockCode = code(mock);
const featureCode = code(featureText);

/** What a screen actually says to somebody, comments removed. */
const spoken = featureCode;

/* ── 1. The client counts; the backend decides ────────────────────────────── */

const capacity = iface(registration, 'EventCapacitySummary');
if (capacity === '') {
  problems.push('`EventCapacitySummary` has gone.');
} else {
  if (!/asOf:\s*IsoDateTime;/.test(capacity)) {
    problems.push(
      '`EventCapacitySummary.asOf` is gone or optional. A count with no time on it invites the ' +
        'office to read it as current, which is the whole failure `DL-129` is about.',
    );
  }
  for (const verdict of ['hasRoom', 'canRegister', 'isAvailable', 'isFull', 'placeAvailable']) {
    if (new RegExp(`\\b${verdict}\\b`).test(capacity)) {
      problems.push(
        `\`EventCapacitySummary\` carries \`${verdict}\`. Whether a place exists is the backend's ` +
          'answer; a client-side verdict is the concurrency guarantee the command says not to ' +
          'invent (`DL-129`).',
      );
    }
  }
}

const offer = fn(registration, 'canOfferPromotion');
if (offer === '') {
  problems.push('`canOfferPromotion` has gone.');
} else if (/capacity|registeredCount|summary/.test(offer)) {
  problems.push(
    '`canOfferPromotion` consults the capacity. It must not: the office\'s figures are a ' +
      'snapshot, somebody may have cancelled a second ago, and refusing on them turns a stale ' +
      'number into a closed door (`DL-129`).',
  );
}
if (!/export function promotionExceedsCapacity/.test(registration)) {
  problems.push(
    '`promotionExceedsCapacity` has gone. The over-capacity case is a **warning**, and deleting ' +
      'the warning is how it silently becomes either a block or a surprise.',
  );
}

const remaining = fn(registration, 'placesRemaining');
if (remaining !== '' && !/Math\s*\.\s*max\s*\(0/.test(remaining)) {
  problems.push(
    '`placesRemaining` can report a negative number. A backend that accepted more than capacity ' +
      'has told the office something true; "-3 remaining" turns that into an apparent bug.',
  );
}

const snapshotNote = entry(copy, 'detail').replace(/\s+/g, ' ');
if (!/were true when this screen last asked/.test(snapshotNote)) {
  problems.push(
    'The capacity snapshot note has gone from the copy. The office reads the screen, not the ' +
      'doc comment (`DL-129`).',
  );
}
/*
 * The *value*, not its caption.
 *
 * `{{ copy.asOf }}` renders the words "Counted at". A rule that accepts it is
 * satisfied by a screen that prints the label above a number it never stamps,
 * which is worse than printing nothing — it looks like the count is timed.
 */
if (!templates.some((file) => /\{\{\s*(?!copy\b)[A-Za-z_$][\w$]*(\(\))?\.asOf/.test(read(file)))) {
  problems.push(
    'No template renders the `asOf` value, so the count is presented as though it were current. ' +
      'A caption from the copy file is not a stamped number (`DL-129`).',
  );
}
notes.push('capacity: stamped, verdict-free, warned not blocked, and the screen says so');

/* ── 2. Registration availability is derived ──────────────────────────────── */

const availability = fn(event, 'registrationAvailability');
if (availability === '') {
  problems.push('`registrationAvailability` has gone.');
} else {
  /*
   * Compared, not merely named.
   *
   * `const { opensAt, closesAt, capacity } = event.registration;` mentions all
   * three while every test below it is replaced by `if (false)`, and a plant
   * proved the naming check passes on exactly that.
   */
  const COMPARISONS = [
    ['the opening time', /now\s*<\s*opensAt|opensAt\s*>\s*now/],
    ['the deadline', /now\s*>\s*closesAt|closesAt\s*<\s*now/],
    ['the capacity', /registeredCount\s*>=\s*capacity|capacity\s*<=\s*registeredCount/],
    ['the end of the event', /endsAt\s*<\s*now|now\s*>\s*\w+\.endsAt/],
  ];
  for (const [what, comparison] of COMPARISONS) {
    if (!comparison.test(availability)) {
      problems.push(
        `\`registrationAvailability\` no longer compares against ${what}. It is derived from the ` +
          'plan, the clock and the count, or it is not derived at all (`DL-128`).',
      );
    }
  }
}
for (const stored of ['registrationState', 'registrationStatus', 'isRegistrationOpen']) {
  if (new RegExp(`${stored}\\s*:`).test(event)) {
    problems.push(
      `\`LguEvent\` stores \`${stored}\`. A stored availability needs a job to stay true and is ` +
        'wrong every morning until that job runs, exactly as a stored "overdue" would (`DL-83`).',
    );
  }
}
const visible = fn(event, 'isVisibleToResidents');
if (visible !== '' && !/cancelled/.test(visible)) {
  problems.push(
    'A cancelled event is no longer visible to residents. Somebody who registered has to be able ' +
      'to see that it is off; hiding it is how people turn up to a cancelled mission.',
  );
}
notes.push('availability: derived from the plan, the clock and the count');

/* ── 3. A registrant list is composed, not laid out ───────────────────────── */

const view = iface(registration, 'RegistrantView');
if (view === '') {
  problems.push('`RegistrantView` has gone. Screens would then receive the whole registration.');
} else {
  const ALLOWED = [
    'id',
    'reference',
    'displayName',
    'barangayId',
    'registeredAt',
    'status',
    'attendance',
    'notes',
  ];
  for (const [, field] of view.matchAll(/^\s*readonly (\w+):/gm)) {
    if (!ALLOWED.includes(field)) {
      problems.push(
        `\`RegistrantView\` gained \`${field}\`. The set is closed on purpose: an events clerk ` +
          'marking attendance has no need of anything else, and a screen cannot leak a field it ' +
          'was never handed (`DL-130`).',
      );
    }
  }
}

for (const field of [
  'philsysLastFour',
  'monthlyIncome',
  'birthDate',
  'streetAddress',
  'sectors',
  'householdId',
]) {
  if (new RegExp(`\\b${field}\\b`).test(featureText)) {
    problems.push(
      `An events screen references \`${field}\`. A registrant list is a list of people who signed ` +
        'up for a feeding programme, not an occasion to hand every clerk a resident record ' +
        '(`DL-130`, RA 10173 minimisation).',
    );
  }
}

if (!/discloseResident\(/.test(mock)) {
  problems.push(
    'The events adapter no longer composes the display name through `discloseResident`. A second ' +
      'surface formatting the name itself hands an events clerk the full name of somebody the ' +
      'residents module shows as "Cordero, M." — the protection is one reader, or it is none ' +
      '(`DL-38`).',
  );
}

const registrantsMethod = /registrants\([\s\S]*?\n  \}/.exec(mock)?.[0] ?? '';
if (registrantsMethod !== '' && !/this\s*\.\s*compose\s*\(/.test(registrantsMethod)) {
  problems.push(
    '`MockEventRepository.registrants` no longer composes each row. Returning the stored ' +
      'registration would put a `residentId` on a screen that has no business with one.',
  );
}
const portRegistrants = /registrants\(([^)]*)\):\s*Observable<([^>]*)>/.exec(ports);
if (portRegistrants !== null && !/RegistrantView/.test(portRegistrants[2] ?? '')) {
  problems.push(
    '`EventRepository.registrants` no longer returns `RegistrantView`. The port is where this is ' +
      'guaranteed; a screen cannot be trusted to redact what it was sent (`DL-38`).',
  );
}
notes.push('registrants: closed field set, disclosed name, composed in the data layer');

/* ── 4. Cancelling is one-way, and past is not completed ──────────────────── */

const transitions = event.match(/EVENT_STATUS_TRANSITIONS[\s\S]*?\n\};/)?.[0] ?? '';
if (transitions === '') {
  problems.push('`EVENT_STATUS_TRANSITIONS` has gone.');
} else {
  const cancelled = /cancelled:\s*\[([^\]]*)\]/.exec(transitions)?.[1] ?? '';
  if (/published|draft|completed/.test(cancelled)) {
    problems.push(
      'A cancelled event can be put back. It cannot: everybody registered was told it is off and ' +
        'made other plans, and a status flipping back does not reach them (`DL-131`).',
    );
  }
  const completed = /completed:\s*\[([^\]]*)\]/.exec(transitions)?.[1] ?? '';
  if (/published|draft/.test(completed)) {
    problems.push(
      'A completed event can be reopened. Reopening is how a no-show gets added to somebody\'s ' +
        'name after the fact (`DL-131`).',
    );
  }
}

if (fn(event, 'hasFinished') === '') {
  problems.push(
    '`hasFinished` has gone. "Past" is the clock\'s opinion and `completed` is the office\'s, and ' +
      'the gap between them is where attendance gets marked (`DL-131`).',
  );
}
const pastView = /case 'past':[\s\S]*?return[^;]*;/.exec(eventCode)?.[0] ?? '';
if (pastView !== '' && !/cancelled/.test(pastView)) {
  problems.push(
    'The Past view no longer excludes cancelled events. A cancelled event did not happen, and ' +
      'listing it among the ones that did misreports the office\'s year.',
  );
}

const completeMethod = /complete\(id: LguEventId[\s\S]*?\n  \}/.exec(mockCode)?.[0] ?? '';
if (completeMethod === '') {
  problems.push('`MockEventRepository.complete` has gone.');
} else if (/no-show|noShow/.test(completeMethod)) {
  problems.push(
    'Completing an event writes no-shows. Nothing may sweep the unmarked: a no-show is a claim ' +
      'about a person who registered, and only somebody who was there can make it (`DL-131`).',
  );
}

const unmarked = entry(registration, "'not-checked-in'");
if (!/not the same/.test(unmarked)) {
  problems.push(
    'The "not checked in" badge no longer says it is not the same as absent. That sentence is ' +
      'the distinction the whole attendance design rests on.',
  );
}
const describeAttendance = fn(registration, 'describeAttendance');
if (describeAttendance !== '' && !/not yet marked/.test(describeAttendance)) {
  problems.push(
    '`describeAttendance` no longer reports the unmarked separately. Folding them into no-shows ' +
      'turns an unfinished afternoon into a claim about fifteen families.',
  );
}
const rate = fn(registration, 'attendanceRateOf');
if (rate !== '' && !/!isFinal|isFinal\s*\?|isFinal\s*&&/.test(rate)) {
  problems.push(
    '`attendanceRateOf` no longer waits for attendance to be final. A rate taken mid-afternoon ' +
      'reads as a poor turnout and is really a half-marked list.',
  );
}
notes.push('lifecycle: cancellation one-way, completion terminal, nothing swept into no-shows');

/* ── 5. No commercial event platform, no chat, no recurrence ──────────────── */

/*
 * Matched as a prefix, not a whole word.
 *
 * `ticket` does not match `ticketPrice`, and a plant proved it: the token
 * a commercial feature actually arrives under is always camelCased onto
 * something else.
 */
const COMMERCIAL = [
  ['ticket', 'ticketing'],
  ['seat[ -]?map', 'a seat map'],
  ['promoCode', 'promo codes'],
  ['payment', 'payment'],
  ['price', 'pricing'],
  ['checkout', 'a checkout'],
];
for (const [token, what] of COMMERCIAL) {
  for (const [name, text] of [
    ['The events domain', eventCode + registrationCode],
    ['The events port', portsCode],
    ['The events adapter', mockCode],
    ['An events screen', featureCode],
  ]) {
    // Prefix, not whole word: `\bticket\b` does not match `ticketPrice`, and a
    // commercial field always arrives camelCased onto something else.
    if (new RegExp(`\\b${token}`, 'i').test(text)) {
      problems.push(
        `${name} has ${what}. The command excludes commercial event-platform complexity, and an ` +
          'LGU medical mission is not a product being sold.',
      );
    }
  }
}
for (const token of ['recurringRule', 'recurrence', 'repeatsEvery']) {
  if (new RegExp(`\\b${token}\\b`, 'i').test(event + mock + featureText)) {
    problems.push(
      `The events module has \`${token}\`. Recurring events are explicitly out of scope until ` +
        'somebody asks for them.',
    );
  }
}
for (const token of ['eventChat', 'eventComment', 'discussion']) {
  if (
    new RegExp(`\\b${token}`, 'i').test(
      eventCode + registrationCode + portsCode + mockCode + featureCode,
    )
  ) {
    problems.push(
      `The events module has \`${token}\`. There is no event chat and no event comments — the ` +
        'command excludes both, and moderation lives in the newsfeed.',
    );
  }
}
// Money never enters this module, so the peso pipe has no business here either.
if (/PesoPipe|\| peso/.test(featureCode)) {
  problems.push('An events screen formats money. Nothing in this module has a price.');
}
notes.push('scope: no ticketing, no payment, no recurrence, no chat');

/* ── 6. Nobody is registered from this console ────────────────────────────── */

const port = iface(ports, 'EventRepository');
if (port === '') {
  problems.push('`EventRepository` has gone.');
} else {
  for (const forbidden of ['createRegistration', 'register(', 'addRegistrant', 'signUp']) {
    if (port.includes(forbidden)) {
      problems.push(
        `\`EventRepository\` offers \`${forbidden}\`. Residents register in their own app; an ` +
          'admin method that signs somebody up is this console quietly taking the one capability ' +
          'the resident contract reserves (`DL-123`).',
      );
    }
  }
}
// Both screens carry it: the composer, where registration is configured, and
// the registrant panel, where somebody looks for the "add" button.
if (!/Nobody is added from here/.test(spoken)) {
  problems.push(
    'The registrant panel no longer says that registrations come from the mobile app. It is the ' +
      'thing an admin most reasonably assumes otherwise, and hunting for the missing button is ' +
      'how they would find out.',
  );
}
if (!/Residents register in the mobile app/.test(spoken)) {
  problems.push('The composer no longer says where registrations come from.');
}

/* ── 7. Every act is reasoned, recorded and permitted ─────────────────────── */

const MUTATORS = ['publish', 'cancel', 'complete', 'archive'];
for (const mutator of MUTATORS) {
  const signature = new RegExp(`${mutator}\\(([^)]*)\\)`).exec(port)?.[1] ?? '';
  if (signature === '') {
    problems.push(`\`EventRepository.${mutator}\` has gone.`);
    continue;
  }
  if (!/reason:\s*string/.test(signature)) {
    problems.push(
      `\`EventRepository.${mutator}\` no longer takes a required reason. Every act on an event ` +
        'residents can see is one the office may be asked to justify.',
    );
  }
}
const actSignature = /actOnRegistration\(([\s\S]*?)\):/.exec(port)?.[1] ?? '';
if (actSignature !== '' && !/reason:\s*string/.test(actSignature)) {
  problems.push(
    '`EventRepository.actOnRegistration` no longer takes a reason. Moving somebody\'s place at a ' +
      'payout is a decision the resident can ask about.',
  );
}

const PERMISSIONS = [
  ['publish', 'event.publish'],
  ['cancel', 'event.cancel'],
  ['archive', 'event.archive'],
  ['actOnRegistration', 'event.manage-registrations'],
  ['markAttendance', 'event.mark-attendance'],
  ['exportRegistrants', 'event.export-registrants'],
];
for (const [method, permission] of PERMISSIONS) {
  const start = mock.indexOf(`\n  ${method}(`);
  if (start < 0) {
    problems.push(`\`MockEventRepository.${method}\` has gone.`);
    continue;
  }
  const rest = mock.slice(start + 1);
  const next = rest.search(/\n  (?:private |protected )?[a-zA-Z]+\(/);
  const body = next < 0 ? rest : rest.slice(0, next);
  // The guard, not merely the string: `new PermissionDeniedError('events.x')`
  // in the not-found branch left the permission name in the body while the
  // check itself was gone.
  // `[^]` rather than `[\s\S]`: inside a template literal the backslash is
  // eaten before the RegExp ever sees it, and `[sS]` matches almost nothing.
  const guarded = new RegExp(`denyUnless[^]{0,120}?'${permission}'`).test(body);
  if (!guarded && !/this\s*\.\s*move\s*\(/.test(body)) {
    problems.push(
      `\`MockEventRepository.${method}\` no longer calls \`denyUnless\` with \`${permission}\`. ` +
        'The adapter is where a permission is enforced; hiding a button is not protection, and ' +
        'the permission name appearing in an error message is not a check.',
    );
  }
}

const moveBody = /\n  private move\([\s\S]*?\n  \}\n/.exec(mock)?.[0] ?? '';
if (moveBody === '') {
  problems.push('`MockEventRepository.move` has gone; every status change went through it.');
} else if (!/this\s*\.\s*record\s*\(/.test(moveBody)) {
  problems.push(
    '`MockEventRepository.move` no longer appends to the trail. The record and the change are ' +
      'one act (`DL-54`).',
  );
}
const registrationRecordings = (mockCode.match(/this\s*\.\s*recordRegistration\s*\(/g) ?? []).length;
if (registrationRecordings < 2) {
  problems.push(
    `Only ${registrationRecordings} of the two registration mutators append to the trail. ` +
      'Moving somebody between the waitlist and a place, and marking whether they came, are ' +
      'both changes the resident can ask about (`DL-54`).',
  );
}

const exportBody = /exportRegistrants\([\s\S]*?\n  \}/.exec(mockCode)?.[0] ?? '';
// Twice: once in the manifest the caller reads, once in the file body itself.
// Dropping either leaves a spreadsheet whose conditions live somewhere else.
const noticeUses = (exportBody.match(/REGISTRANT_EXPORT_NOTICE/g) ?? []).length;
if (exportBody !== '' && noticeUses < 2) {
  problems.push(
    'The registrant export no longer carries its handling notice. An export states its ' +
      'conditions **inside** the file, because a spreadsheet found in eight months has no other ' +
      'context (`DL-106`).',
  );
}
notes.push(`acts: ${MUTATORS.length} reasoned, ${PERMISSIONS.length} gated, all recorded`);

/* ── 8. Publication rules, the seam, and the routes ───────────────────────── */

const eventProblemsFn = fn(event, 'eventProblems');
if (eventProblemsFn === '') {
  problems.push('`eventProblems` has gone.');
} else {
  if (!/image-without-alt-text/.test(eventProblemsFn)) {
    problems.push(
      '`eventProblems` no longer refuses an undescribed cover image. Same rule as a post, same ' +
        'reason (`DL-125`).',
    );
  }
  if (!/ends-before-start/.test(eventProblemsFn)) {
    problems.push('`eventProblems` no longer refuses an end before its start.');
  }
  // Checked on a draft too: unlike a missing field it can never become correct
  // by adding to it.
  const backwards = /endsAt <= draft\.startsAt[\s\S]{0,200}?ends-before-start/.test(eventProblemsFn);
  if (!backwards) {
    problems.push('The end-before-start rule no longer reads both dates.');
  }
  if (!/waitlist-without-capacity/.test(eventProblemsFn)) {
    problems.push(
      '`eventProblems` allows a waitlist with no capacity — a queue behind a door that never ' +
        'fills, which nobody would ever be moved off.',
    );
  }
  if (!/intent === 'publish'/.test(eventProblemsFn)) {
    problems.push(
      '`eventProblems` applies every rule regardless of intent. Refusing to save a half-filled ' +
        'form punishes somebody mid-sentence (`DL-125`).',
    );
  }
}

if (!/EVENT_TIMEZONE\b/.test(event)) {
  problems.push('`EVENT_TIMEZONE` has gone. The office runs on one clock and the form says which.');
}
const composer = templates.find((file) => file.includes('composer'));
if (composer !== undefined && !/timezone/i.test(read(composer))) {
  problems.push('The composer no longer states the timezone.');
}

for (const file of featureFiles) {
  if (/@data\/|data\/mock|data\/http/.test(read(file))) {
    problems.push(`${file} imports the data layer directly. Features depend on ports.`);
  }
}
if (/resident-event|ResidentEventPage|resident-registration/.test(featureText)) {
  problems.push(
    'A resident-facing events screen has appeared. This repository is the staff console; the ' +
      'resident contract is types only (`DL-123`).',
  );
}

const eventsBlock = (() => {
  const start = routes.indexOf("path: 'events'");
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

if (eventsBlock === '') {
  problems.push('The events routes have gone, or no longer sit under one parent.');
} else {
  // Read out of the block: two routes ask for `events.view`, so a file-wide
  // search for the string is satisfied by whichever sibling still has it.
  const EXPECTED = [
    ["''", 'event.view'],
    ["'new'", 'event.create'],
    ["':id'", 'event.view'],
  ];
  const children = eventsBlock.split(/\n\s{10}\{/).slice(1);
  if (children.length !== EXPECTED.length) {
    problems.push(
      `Events has ${children.length} child routes and ${EXPECTED.length} are accounted for. An ` +
        'unlisted route is an unchecked one.',
    );
  }
  for (const [path, permission] of EXPECTED) {
    const child = children.find((text) => new RegExp(`path: ${path}[,\\n]`).test(text));
    if (child === undefined) {
      problems.push(`The events route ${path} has gone.`);
      continue;
    }
    if (!new RegExp(`permissionGuard\\('${permission}'\\)`).test(child)) {
      problems.push(
        `The events route ${path} is not guarded by ${permission}. A guard on a sibling route ` +
          'protects nothing here.',
      );
    }
  }
  const newAt = eventsBlock.indexOf("path: 'new'");
  const idAt = eventsBlock.indexOf("path: ':id'");
  if (newAt >= 0 && idAt >= 0 && newAt > idAt) {
    problems.push(
      "The events `:id` route precedes `new`, so the composer resolves as an event id. Order " +
        'matters here and nothing else in the file would show it.',
    );
  }
}

for (const store of ['localStorage', 'sessionStorage', 'document.cookie']) {
  if (new RegExp(store.replace('.', '\\.')).test(featureText)) {
    problems.push(`An events screen writes to ${store}. Nothing here belongs in a browser store.`);
  }
}

// The seed has to make the two counts it demonstrates real, or the waitlist on
// screen looks broken to whoever reads it.
if (!/MOCK_REGISTRATIONS/.test(seed) || !/status: 'waitlisted'/.test(seed)) {
  problems.push('The seed no longer covers a waitlist, which is half of what capacity is for.');
}
if (!/attendance: 'no-show'/.test(seed) || !/attendance: 'attended'/.test(seed)) {
  problems.push('The seed no longer covers both attendance outcomes.');
}
if (/registeredCount:\s*\d/.test(seed)) {
  problems.push(
    'The seed types a registration count in by hand. It is derived from the seeded rows, so the ' +
      'two cannot disagree — a seeded "20 registered" above 17 rows is a demo that contradicts ' +
      'itself.',
  );
}
notes.push('seam: no data imports, no resident screen, routes guarded and ordered');

/* ── 9. The served adapter holds the same lines (`DL-192`) ────────────────── */

/*
 * Sections 1–8 read the domain, the port, the mock and the screens. Since the Node API serves
 * events, the http adapter and its mapper are what an office actually runs against, and each rule
 * below is one the mock was held to, restated for the code that talks to a server. Every rule was
 * validated against a planted regression.
 */
const providers = read('src/app/data/data-access.providers.ts');
const adapterSource = read('src/app/data/http/http-repositories.ts');
const mapperPath = 'src/app/data/http/mappers/event.mapper.ts';
const eventMapper = existsSync(join(root, mapperPath)) ? read(mapperPath) : '';
const mapperCode = code(eventMapper);

/** The class body, from its declaration to the next top-level declaration. */
const httpClass = (() => {
  const start = adapterSource.indexOf('export class HttpEventRepository');
  if (start < 0) return '';
  const rest = adapterSource.slice(start);
  const end = rest.search(/\n\}\n/);
  return end < 0 ? rest : rest.slice(0, end + 2);
})();
const httpCode = code(httpClass);

/** One method's body out of the class, up to the next member. */
const httpMethod = (name) => {
  const start = httpCode.indexOf(`\n  ${name}(`);
  if (start < 0) return '';
  const rest = httpCode.slice(start + 1);
  const next = rest.search(/\n  (?:private |protected )?[a-zA-Z]+\(/);
  return next < 0 ? rest : rest.slice(0, next);
};

/** A mapper function's body. */
const mapperFn = (name) => fn(eventMapper, name);

if (httpClass === '') {
  problems.push('`HttpEventRepository` has gone, so the http configuration has no events adapter.');
} else {
  if (!/provide:\s*EVENT_REPOSITORY,\s*useClass:\s*HttpEventRepository/.test(providers)) {
    problems.push(
      '`EVENT_REPOSITORY` is not bound to `HttpEventRepository` in the http set. The API serves ' +
        'events; an unserved or mock binding tells an office it has no events, or shows it sample ' +
        'ones (`DL-136`, `DL-192`).',
    );
  }

  // Nobody is registered from this console (`DL-123`): no POST to a registrations collection and no
  // idempotency key, which only a resident's own sign-up carries.
  if (/registrations`/.test(httpCode) || /idempotency_key/.test(httpCode + mapperCode)) {
    problems.push(
      '`HttpEventRepository` reaches a registrations collection or sends an idempotency key. Those ' +
        'are the resident\'s own sign-up; an office that can register somebody has taken the one ' +
        'capability the resident contract reserves (`DL-123`).',
    );
  }
  if (/API_ENDPOINTS\s*\.\s*(?!officeEvents\b)\w*[Ee]vent/.test(httpCode)) {
    problems.push(
      '`HttpEventRepository` names an events endpoint other than `officeEvents`. The residents\' ' +
        'routes are the app\'s; this console reads the office\'s.',
    );
  }

  // Reasoned before anything is sent: an empty reason is refused here, with no request.
  for (const mutator of ['publish', 'cancel', 'complete', 'archive', 'actOnRegistration']) {
    const body = httpMethod(mutator);
    const guard = body.search(/reason\s*\.\s*trim\s*\(\s*\)\s*\.\s*length\s*===\s*0/);
    const request = body.search(/this\s*\.\s*(?:api|moved|registrant)\b/);
    if (body === '' || guard < 0 || (request >= 0 && request < guard)) {
      problems.push(
        `\`HttpEventRepository.${mutator}\` no longer refuses an empty reason before it sends. ` +
          'Every act residents can see is one the office may be asked to justify.',
      );
    }
  }

  // The client counts; the server decides (`DL-129`). The adapter never decides a place is free.
  for (const verdict of ['registrationAvailability', 'placesRemaining', 'promotionExceedsCapacity']) {
    if (new RegExp(`\\b${verdict}\\b`).test(httpCode)) {
      problems.push(
        `\`HttpEventRepository\` calls \`${verdict}\`. A promotion is attempted and its answer ` +
          'read back; a client-side verdict is the concurrency guarantee the command says not to ' +
          'invent (`DL-129`).',
      );
    }
  }
  if (/this\s*\.\s*capacity\s*\(/.test(httpMethod('actOnRegistration'))) {
    problems.push(
      '`HttpEventRepository.actOnRegistration` consults the capacity before it sends. The office\'s ' +
        'figure is a snapshot; the server answers the move (`DL-129`).',
    );
  }

  // Completion sweeps nobody (`DL-131`).
  if (/no-show|attendance/.test(httpMethod('complete'))) {
    problems.push(
      '`HttpEventRepository.complete` sends attendance. Completing declares the register final; it ' +
        'never turns an unmarked registrant into a no-show (`DL-131`).',
    );
  }

  for (const [token, what] of COMMERCIAL) {
    if (new RegExp(`\\b${token}`, 'i').test(httpCode + mapperCode)) {
      problems.push(`The events adapter or its mapper has ${what}. Nothing in this module is sold.`);
    }
  }
}

if (eventMapper === '') {
  problems.push(`${mapperPath} has gone; the served adapter cannot read an answer without it.`);
} else {
  // The closed set, refused wider (`DL-130`).
  const closedSet = /const REGISTRANT_FIELDS = \[([\s\S]*?)\]/.exec(eventMapper)?.[1] ?? '';
  const fields = [...closedSet.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  const EXPECTED = ['id', 'reference', 'display_name', 'barangay_id', 'registered_at', 'status', 'attendance'];
  if (fields.length !== EXPECTED.length || EXPECTED.some((name) => !fields.includes(name))) {
    problems.push(
      `The registrant mapper's closed set is [${fields.join(', ')}]. It is the seven fields a ` +
        'RegistrantView is made from and no other — an account id or a contact on that list is a ' +
        'wider read than the screen (`DL-130`).',
    );
  }
  const registrantFn = mapperFn('toRegistrantView');
  if (!/REGISTRANT_FIELDS[\s\S]{0,40}\.includes\(key\)/.test(registrantFn)) {
    problems.push(
      '`toRegistrantView` no longer refuses a row that carries more than the closed set. A server ' +
        'that widens what it discloses must be refused, not trimmed quietly (`DL-130`).',
    );
  }
  if (!/notes:\s*null/.test(code(registrantFn))) {
    problems.push(
      '`toRegistrantView` fills `notes` from somewhere. The API keeps no office notes on a ' +
        'registration; a value there came from a field nobody is meant to read (`DL-192`).',
    );
  }

  // The moment is the server's (`DL-129`).
  for (const name of ['toEventCapacity', 'toEventMetrics']) {
    const body = code(mapperFn(name));
    if (!/field\(\s*wire\s*,\s*'as_of'\s*\)/.test(body) || /new Date\(|Date\s*\.\s*now/.test(body)) {
      problems.push(
        `\`${name}\` no longer takes \`as_of\` from the server, or stamps its own. The count and ` +
          'the moment it was counted travel together, and only the server knows when it counted ' +
          '(`DL-129`).',
      );
    }
  }
  const metricsBody = code(mapperFn('toEventMetrics'));
  if (!/attendanceRateOf\(/.test(metricsBody)) {
    problems.push(
      '`toEventMetrics` computes a rate without `attendanceRateOf`. A rate taken before attendance ' +
        'is final reads as a poor turnout and is really a half-marked list.',
    );
  }

  // The file carries its conditions (`DL-106`), and the office's notice word for word.
  const exportBody = mapperFn('toRegistrantExport');
  if (
    !/handlingNotice\s*!==\s*REGISTRANT_EXPORT_NOTICE/.test(exportBody) ||
    !/content\s*\.\s*includes\(\s*REGISTRANT_EXPORT_NOTICE\s*\)/.test(exportBody)
  ) {
    problems.push(
      '`toRegistrantExport` accepts a file whose handling notice is not the office\'s, in the ' +
        'manifest or in the file itself. The conditions travel inside the file (`DL-106`).',
    );
  }

  // A history row is the office's act with its reason, and claims no recorded fields.
  const historyBody = code(mapperFn('toEventHistoryRow'));
  if (!/field\(\s*wire\s*,\s*'reason'\s*\)/.test(historyBody) || !/null,\s*false,?\s*\)/.test(historyBody)) {
    problems.push(
      '`toEventHistoryRow` drops the reason or claims recorded fields. The history is the office\'s ' +
        'acts with the reason each was given, and records no field names (`DL-54`, `DL-191`).',
    );
  }
}
notes.push('served adapter: bound, nobody signed up, reasoned before sending, closed set, server stamp');

/* ── 10. A cover is an uploaded image, never an address (`DL-193`) ────────── */

/*
 * The residents' app loads an event's cover only from the API's own route (its D-192), so a link the
 * office typed was never shown to anybody, and the field that took one invited something that did
 * nothing. Each rule below was validated against a planted regression.
 */
{
  const coverType = iface(event, 'EventCover');
  if (coverType === '' || !/mediaId:\s*MediaId/.test(coverType) || /\b(url|href|src|link)\??:/.test(code(coverType))) {
    problems.push(
      '`EventCover` is not a stored image named by its `MediaId`, or it carries an address. A cover ' +
        'is uploaded through the API; an address on the model is one a template will load (`DL-193`).',
    );
  }
  const lguEvent = iface(event, 'LguEvent');
  const eventDraft = iface(event, 'EventDraft');
  if (!/image:\s*EventCover \| null/.test(lguEvent) || !/image:\s*EventCoverDraft \| null/.test(eventDraft)) {
    problems.push('`LguEvent` or `EventDraft` no longer holds its cover as `EventCover` / `EventCoverDraft`.');
  }

  // The mapper reads the stored image and never the residents' public address; the body names the
  // stored image and never an address.
  if (/field\(\s*wire\s*,\s*'image_url'\s*\)/.test(mapperCode)) {
    problems.push(
      "The event mapper reads image_url. That is the residents' public route, which answers only once " +
        'an event is published; a template bound to it would load from the API host, not the data layer.',
    );
  }
  // To the end of the function: its parameter types hold braces, so `fn` would stop inside them.
  const wireStart = eventMapper.indexOf('export function toWireEventDraft(');
  const wireDraft = wireStart < 0 ? '' : code(eventMapper.slice(wireStart, eventMapper.indexOf('\n}\n', wireStart)));
  if (!/image_media_id:/.test(wireDraft) || /image_url/.test(wireDraft)) {
    problems.push('`toWireEventDraft` no longer names the cover by `image_media_id`, or sends an address.');
  }

  // The adapter refuses everything it can before the image leaves, uploads it through `POST media`,
  // and reads a cover's bytes with the bearer in a header.
  const save = httpMethod('saveDraft');
  const refusedAt = save.search(/eventProblems\(/);
  const storedAt = save.search(/storedCover\(/);
  if (refusedAt < 0 || storedAt < 0 || storedAt < refusedAt) {
    problems.push(
      '`HttpEventRepository.saveDraft` stores the cover before refusing what the domain refuses, or ' +
        'no longer stores it at all. Nothing is sent for a draft that cannot be saved.',
    );
  }
  const storerStart = httpCode.indexOf('private storedCover(');
  const storer = storerStart < 0 ? '' : httpCode.slice(storerStart, httpCode.indexOf('\n  }\n', storerStart));
  if (!/postForm\(\s*API_ENDPOINTS\s*\.\s*media\s*,\s*toWireMediaUpload\(/.test(storer)) {
    problems.push('The cover is no longer stored through `POST media` with `toWireMediaUpload`.');
  }
  if (!/api\s*\.\s*blob\(\s*`\$\{API_ENDPOINTS\s*\.\s*media\}\/[^`]*\/content`/.test(httpMethod('coverImage'))) {
    problems.push(
      '`coverImage` no longer reads `media/{id}/content` through `ApiClient.blob`. A draft\'s cover is ' +
        'read with the bearer in a header, never from an address.',
    );
  }
  if (!/refusal\(\s*draft\s*\.\s*image\s*\.\s*file\s*\)/.test(mockCode) || !/APP_IMAGE_POLICY/.test(mockCode)) {
    problems.push('The mock stores a chosen cover without refusing what `POST media` refuses.');
  }

  // The composer: a file through the shared field, the description beside it, the effects before
  // the button.
  const composerFile = templates.find((file) => file.includes('composer'));
  const composerHtml = composerFile === undefined ? '' : code(read(composerFile));
  const imageSection = /<section[^>]*aria-labelledby="image-heading"[\s\S]*?<\/section>/.exec(composerHtml)?.[0] ?? '';
  if (!/<app-image-file-field\b/.test(imageSection)) {
    problems.push(
      'The composer no longer takes the cover through `<app-image-file-field>`, the field that refuses ' +
        'a file the API would refuse before anything is sent.',
    );
  }
  if (!/\[value\]="altText\(\)"/.test(imageSection)) {
    problems.push('The cover\'s description is no longer beside the image (`DL-125`).');
  }
  if (/type="url"/.test(imageSection) || /imageUrl|image_url/.test(composerHtml)) {
    problems.push('The composer asks for an image address again. A typed cover is never shown (`DL-193`).');
  }
  // Every mention, not the first: a second copy of the effects below the button is read after the
  // decision is made.
  const effectsAt = Math.max(-1, ...[...composerHtml.matchAll(/copy\s*\.\s*coverEffects\b/g)].map((m) => m.index));
  const buttonAt = composerHtml.search(/<button[^>]*type="submit"/);
  if (effectsAt < 0 || buttonAt < 0 || effectsAt > buttonAt) {
    problems.push('What saving does to the cover image is no longer said before the save button.');
  }
  const coverEffects = entry(copy, 'composer').match(/coverEffects:\s*\[[\s\S]*?\]/)?.[0] ?? '';
  if (!/stays stored/.test(coverEffects) || !/published/.test(coverEffects)) {
    problems.push(
      'The composer no longer says the image is stored first and stays if the event is refused, or ' +
        'when residents see the cover.',
    );
  }

  // Every cover on screen comes through the data layer, from an address this tab made and gives back.
  for (const file of templates) {
    const template = code(read(file));
    for (const [tag] of template.matchAll(/<img\b[^>]*>/g)) {
      const source = /\[src\]="([^"]+)"/.exec(tag)?.[1];
      if (source === undefined || /[.(]/.test(source)) {
        problems.push(`${file} draws an image from ${source ?? 'a fixed address'}. Bytes come through the data layer.`);
      }
    }
    if (/<img\b/.test(template)) {
      // Every holder the component makes is given back when it goes, not merely one of them.
      const component = code(read(file.replace(/\.html$/, '.ts')));
      const holders = [...component.matchAll(/(\w+)\s*=\s*new ObjectUrls\(\)/g)].map((m) => m[1]);
      const destroyAt = component.indexOf('onDestroy(');
      const onDestroy = destroyAt < 0 ? '' : component.slice(destroyAt, destroyAt + 300);
      if (holders.length === 0 || holders.some((holder) => !new RegExp(`this\\s*\\.\\s*${holder}\\s*\\.\\s*revokeAll\\(\\)`).test(onDestroy))) {
        problems.push(`${file} shows an image without every ObjectUrls holder given back on destroy.`);
      }
    }
  }
}
notes.push('covers: uploaded, never an address; refused before sending; described beside; read through the data layer');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nEvents check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Events check passed.');
