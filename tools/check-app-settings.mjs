#!/usr/bin/env node
/**
 * check:app-settings — a change to the residents' app's settings is reviewed, and a change that can
 * stop residents using the app is acknowledged, before it is sent (`DL-170`).
 *
 * A newer oldest version can force every resident to update; a new terms or privacy version can make
 * every resident accept again. One stray digit reaches the whole municipality. So:
 *
 *   1. The page's title block says "Residents see this in the Taytay app".
 *   2. The repository's `change` is called once, in `confirm`, which refuses unless the review is open
 *      and — where `needsAcknowledgement()` — the acknowledgement is ticked; `review` sends nothing.
 *   3. The confirmation lists the effects before its button, offers the acknowledgement box when it is
 *      needed, and the button is disabled until it is ticked.
 *   4. The effects say a newer version can force every resident to update, a new terms or privacy
 *      version can make every resident accept again, the notice's text is not changed here, and the
 *      server keeps no record of which setting changed; `asksEveryResident` covers the three.
 *   5. The flags are said not to be secret. (Until `DL-186` this rule also kept the mapper from
 *      reading the privacy notice's text, which no route changed; rule 8 replaces that half, because
 *      the text is now published here and must be read whole.)
 *   6. No `console`, web storage or cookie in the module.
 *   7. `app-config.manage` is in `PERMISSIONS`, named by no role, not read-only, and asked for by the
 *      route and the menu entry.
 *   8. The Terms of Use and the privacy notice (`DL-186`): a new version asks for the acknowledgement
 *      (`asksEveryResident` covers both texts); the effects say, for each, that a new version makes
 *      every resident accept it again in the app, that the same version changes the text without
 *      asking anyone, and that this console writes no legal text — and `appConfigEffects` lists them;
 *      the placeholder is said to have no text, on the page, for both; the editor starts only from
 *      `legalTextDraftFrom`, which gives nothing for the placeholder, and no draft is set to words
 *      written in the code; the placeholder's version is refused; the texts are shown as text, never
 *      rendered as HTML; the mapper reads each text whole and sends each with its version; and the
 *      mock invents no legal text.
 *   9. How long an ID review usually takes (`DL-205`): the effects say what the app will say, in
 *      the words of `reviewTimePhrase`, and that it will stop saying it — and `appConfigEffects` lists
 *      both; `asksEveryResident` leaves it out, because it asks nothing of a resident and a needless
 *      acknowledgement teaches ticking without reading; the preview is `reviewTimePhrase`'s; no range
 *      is written into the page, the copy, the domain or the mapper (only the mock seeds the API's
 *      migration value); an API that does not send the setting is read as unknown and offers nothing
 *      to send; the range goes out whole under its own key and the server's refusal comes back by
 *      input; and each input names its error with `aria-describedby` and `aria-invalid`.
 *  10. The biometric (selfie) consent (`DL-216`): while it is the placeholder the page says, at its
 *      top, that the app cannot take selfies and no resident can verify by selfie, and the copy says
 *      it again where the text would be; the effects say that a first publication lets residents send
 *      a selfie and cannot be undone here, that a new version is agreed to again before the next
 *      selfie and keeps the selfies already sent, and that the same version changes the text without
 *      asking anyone — and `appConfigEffects` lists them; `asksEveryResident` leaves it out, since it
 *      stops nobody using the app; the mapper reads it whole, unknown when absent, and sends it with
 *      its version; the mock's is the API's placeholder; and the checklist of what it has to cover
 *      stands beside the editor as topics with their sources, while every draft is set from nothing
 *      but what was typed, what is published, or empty — so no checklist line can reach the field.
 *
 * Each rule was validated against a planted regression before being trusted.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const read = (...segments) => readFileSync(join(...segments), 'utf8');
const shown = (file) => relative(ROOT, file).split(sep).join('/');

const failures = [];

const FEATURE = join(APP, 'features', 'app-settings');
const PAGE = join(FEATURE, 'app-settings-page.ts');
const TEMPLATE = join(FEATURE, 'app-settings-page.html');
const COPY = join(FEATURE, 'app-settings.copy.ts');
const DOMAIN = join(APP, 'domain', 'app-config', 'app-config.ts');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'app-config.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-app-config.repository.ts');
const REQUIREMENTS = join(APP, 'domain', 'app-config', 'biometric-consent-requirements.ts');

for (const file of [PAGE, TEMPLATE, COPY, DOMAIN, MAPPER, MOCK, REQUIREMENTS]) {
  if (!existsSync(file)) failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
}
if (failures.length > 0) report();

/** Comments explain these rules and must not trip them. */
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

function block(text, start) {
  if (start === -1) return '';
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return '';
}

function methodBody(text, name) {
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?(?:async )?${name}\\(`));
  return start === -1 ? '' : block(text, text.indexOf(')', start));
}

const page = code(readFileSync(PAGE, 'utf8'));
const template = code(readFileSync(TEMPLATE, 'utf8'));
const domain = code(readFileSync(DOMAIN, 'utf8'));
const moduleFiles = [...walk(FEATURE), DOMAIN, MAPPER, MOCK, REQUIREMENTS];

/* ── 1. residents see it ─────────────────────────────────────────────────── */

if (!/subtitle:\s*\n?\s*'Residents see this in the Taytay app/.test(readFileSync(COPY, 'utf8'))) {
  failures.push('The app settings page no longer opens by saying residents see it in the Taytay app.');
}
if (!/\[subtitle\]="copy\.subtitle"/.test(template)) {
  failures.push('The app settings page header no longer shows the sentence saying residents see it.');
}

/* ── 2. sent only from the confirmation, and only when acknowledged ──────── */

const changeCall = /this\s*\.\s*repository\s*\.\s*change\s*\(/g;
const confirm = methodBody(page, 'confirm');
if ([...page.matchAll(changeCall)].length !== 1 || !new RegExp(changeCall.source).test(confirm)) {
  failures.push('The settings are sent from somewhere other than confirm, after the review.');
}
if (
  !/!\s*this\s*\.\s*reviewing\s*\(\s*\)/.test(confirm) ||
  !/this\s*\.\s*needsAcknowledgement\s*\(\s*\)\s*&&\s*!\s*this\s*\.\s*acknowledged\s*\(\s*\)/.test(confirm)
) {
  failures.push('confirm no longer refuses outside the review, or without the acknowledgement it needs.');
}
if (new RegExp(changeCall.source).test(methodBody(page, 'review'))) {
  failures.push('review sends the change. It only opens the confirmation.');
}

/* ── 3. the confirmation ─────────────────────────────────────────────────── */

const modal = template.indexOf('<app-modal');
const effects = template.indexOf('@for (effect of effects()', modal);
const acknowledge = template.indexOf('@if (needsAcknowledgement())', modal);
const button = template.indexOf('(click)="confirm()"', modal);
const buttonTag = template.slice(template.lastIndexOf('<button', button), button);
if (modal === -1 || effects === -1 || acknowledge === -1 || button === -1 || !(effects < button && acknowledge < button)) {
  failures.push('The confirmation no longer lists the effects and the acknowledgement before its button.');
}
if (!/\[disabled\]="[^"]*needsAcknowledgement\s*\(\s*\)\s*&&\s*!\s*acknowledged\s*\(\s*\)/.test(buttonTag)) {
  failures.push("The confirmation's button is no longer disabled until the acknowledgement is ticked.");
}
if ([...template.matchAll(/\(click\)="confirm\(\)"/g)].length !== 1) {
  failures.push('Something besides the confirmation saves the settings.');
}

/* ── 4. what a change does ───────────────────────────────────────────────── */

const effectsText = domain.slice(domain.indexOf('export const APP_CONFIG_EFFECTS'));
for (const [pattern, said] of [
  [/can force every resident[\s\S]{0,80}update/, 'a newer version can force every resident to update'],
  [/can make every resident accept the terms again/, 'a new terms version can make every resident accept again'],
  [/can make every resident accept the privacy notice again/, 'a new privacy version can make every resident accept again'],
  [/text does not change here/, "the notice's text is not changed here"],
  [/not which setting/, 'the server keeps no record of which setting changed'],
]) {
  if (!pattern.test(effectsText)) failures.push(`APP_CONFIG_EFFECTS no longer says ${said}.`);
}
const asks = block(domain, domain.indexOf('export function asksEveryResident'));
for (const field of ['minimumAppVersion', 'termsVersion', 'privacyVersion']) {
  if (!asks.includes(field)) failures.push(`asksEveryResident no longer covers ${field}.`);
}
// A text published under a new version asks every resident too (DL-186). Matched on the version
// compared, because `changes.terms` alone is also the start of `changes.termsVersion`.
for (const text of ['terms', 'privacyNotice']) {
  if (!new RegExp(`isNewLegalVersion\\s*\\(\\s*changes\\s*\\.\\s*${text}\\s*\\.\\s*version`).test(asks)) {
    failures.push(`asksEveryResident no longer covers a new version of ${text} (DL-186).`);
  }
}

/* ── 5. not secret, and not the notice's text ────────────────────────────── */

if (!/Not secret/.test(readFileSync(COPY, 'utf8')) || !/\{\{\s*copy\s*\.\s*flagsLead\s*\}\}/.test(template)) {
  failures.push('The flags are no longer said not to be secret.');
}

/* ── 8. the texts residents accept (DL-186) ──────────────────────────────── */

for (const [pattern, said] of [
  [
    /makes every resident accept the Terms of Use[\s\S]{0,30}again in the app/,
    'a new Terms of Use version makes every resident accept them again in the app',
  ],
  [
    /makes every resident accept the privacy[\s\S]{0,30}notice again in the app/,
    'a new privacy notice version makes every resident accept it again in the app',
  ],
  [/writes, suggests or fills in legal text/, 'this console writes no legal text'],
]) {
  if (!pattern.test(effectsText)) failures.push(`APP_CONFIG_EFFECTS no longer says ${said} (DL-186).`);
}
if ([...effectsText.matchAll(/text changes without asking anyone to accept[\s\S]{0,20}again/g)].length < 2) {
  failures.push(
    'APP_CONFIG_EFFECTS no longer says, for both texts, that the same version changes the text ' +
      'without asking anyone to accept again (DL-186).',
  );
}
const listed = block(domain, domain.indexOf('export function appConfigEffects'));
for (const effect of [
  'APP_CONFIG_EFFECTS.termsPublished',
  'APP_CONFIG_EFFECTS.noticePublished',
  'APP_CONFIG_EFFECTS.asWritten',
]) {
  if (!listed.includes(effect)) {
    failures.push(`appConfigEffects no longer lists ${effect}, so the confirmation would not say it (DL-186).`);
  }
}

// The placeholder has no text, and the page says so for both.
const copyText = readFileSync(COPY, 'utf8');
if ([...copyText.matchAll(/No text has been written yet\./g)].length < 3) {
  failures.push(
    'The copy no longer says, for each of the three texts, that no text has been written yet while ' +
      'the version is the placeholder (DL-186, DL-216).',
  );
}
if (!/@if \(isPlaceholder\(published\)\)\s*\{\s*<p[^>]*>\{\{\s*words\s*\.\s*noText\s*\}\}/.test(template)) {
  failures.push('The page no longer says "no text has been written yet" where the placeholder would be (DL-186).');
}

// Never pre-filled: the editor starts from the published text, or from nothing for the placeholder.
const draftFrom = block(domain, domain.indexOf('export function legalTextDraftFrom'));
if (!/isPlaceholderText\(/.test(draftFrom) || !/\{\s*version:\s*''\s*,\s*bodyMarkdown:\s*''\s*\}/.test(draftFrom)) {
  failures.push("legalTextDraftFrom no longer starts the placeholder's editor empty. Its sentence is not legal text (DL-186).");
}
if (!/legalTextDraftFrom\(/.test(methodBody(page, 'startEditing'))) {
  failures.push('startEditing no longer starts the editor from legalTextDraftFrom (DL-186).');
}
// Every value a draft is given is typed, published or empty: once the empty strings are taken out of
// its argument, no string literal is left in it.
for (const call of page.matchAll(/(?:draftBody|draftVersion)\s*\.\s*(?:set|update)\s*\(/g)) {
  const open = (call.index ?? 0) + call[0].length - 1;
  let end = open;
  for (let i = open, depth = 0; i < page.length; i++) {
    if (page[i] === '(') depth++;
    else if (page[i] === ')' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (/['"`]/.test(page.slice(open + 1, end).replace(/''/g, ''))) {
    failures.push('A legal text draft is set to words written in the code. Nothing here writes legal text (DL-186).');
    break;
  }
}

// The placeholder's version is not a published one.
const textProblems = block(domain, domain.indexOf('function legalTextProblems'));
if (!/isPlaceholderText\(/.test(textProblems) || !/LEGAL_TEXT_PLACEHOLDER_VERSION = 'placeholder'/.test(domain)) {
  failures.push("The placeholder's version is no longer refused before it is sent (DL-186).");
}

// Shown as text: a text rendered as HTML is markup the console vouches for.
for (const file of moduleFiles) {
  const found = /\[innerHTML\]|innerHTML\s*=|bypassSecurityTrust|DomSanitizer/.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} renders HTML (${found[0]}). The texts are shown as written (DL-186).`);
}

// Read whole, sent with its version.
const mapper = code(readFileSync(MAPPER, 'utf8'));
const textOf = block(mapper, mapper.indexOf('function legalTextOf'));
if (
  !/field\(\s*value\s*,\s*'body_markdown'\s*\)/.test(textOf) ||
  !/field\(\s*value\s*,\s*'version'\s*\)/.test(textOf) ||
  !/legalTextOf\(\s*field\(\s*wire\s*,\s*'terms'\s*\)\s*\)/.test(mapper) ||
  !/legalTextOf\(\s*field\(\s*wire\s*,\s*'privacy_notice'\s*\)\s*\)/.test(mapper)
) {
  failures.push('The mapper no longer reads both texts whole, each with its version (DL-186).');
}
const toWireText = block(mapper, mapper.indexOf('function toWireLegalText'));
if (
  !/terms:\s*toWireLegalText\s*\(\s*changes\s*\.\s*terms\s*\)/.test(mapper) ||
  !/privacy_notice:\s*toWireLegalText\s*\(\s*changes\s*\.\s*privacyNotice\s*\)/.test(mapper) ||
  !/version:[\s\S]*body_markdown:/.test(toWireText)
) {
  failures.push('The mapper no longer sends each text with its version, together (DL-186).');
}

// The mock invents no legal text: both texts are the API's placeholders.
const mock = code(readFileSync(MOCK, 'utf8'));
for (const key of ['privacyNotice', 'terms', 'biometricConsent']) {
  if (!new RegExp(`${key}: \\{\\s*version: 'placeholder'`).test(mock)) {
    failures.push(`The mock's ${key} is not the API's placeholder. No legal text is invented, in the demo either (DL-186).`);
  }
}

/* ── 9. how long an ID review usually takes (DL-205) ─────────────────────── */

for (const [pattern, said] of [
  [/reviewTimeStated:[\s\S]{0,80}The app will tell residents an ID review \$\{reviewTimePhrase\(range\)\}/, 'what the app will tell residents, in reviewTimePhrase’s words'],
  [/reviewTimeCleared:\s*\[\s*'The app will stop saying how long an ID review takes\.'/, 'that the app will stop saying how long a review takes'],
]) {
  if (!pattern.test(effectsText)) failures.push(`APP_CONFIG_EFFECTS no longer says ${said} (DL-205).`);
}
for (const effect of ['APP_CONFIG_EFFECTS.reviewTimeStated', 'APP_CONFIG_EFFECTS.reviewTimeCleared']) {
  if (!listed.includes(effect)) {
    failures.push(`appConfigEffects no longer lists ${effect}, so the confirmation would not say it (DL-205).`);
  }
}
if (asks.includes('verificationReviewWorkingDays')) {
  failures.push(
    'asksEveryResident covers the review time. It asks nothing of a resident, and an acknowledgement ' +
      'nobody needs teaches administrators to tick without reading (DL-205).',
  );
}
const phrase = block(domain, domain.indexOf('export function reviewTimePhrase'));
if (!/usually takes \$\{range\.min\}–\$\{range\.max\} working days/.test(phrase) || !/range\.min === range\.max/.test(phrase)) {
  failures.push("reviewTimePhrase no longer words the range by the app's rule: “usually takes {min}–{max} working days”, one number when they are equal (DL-205).");
}
const preview = block(page, page.indexOf('protected readonly reviewPreview'));
if (!/reviewTimePhrase\(/.test(preview) || !/id="settings-review-preview"[\s\S]{0,200}\{\{\s*reviewPreview\(\)\s*\}\}/.test(template)) {
  failures.push('The preview no longer shows the sentence reviewTimePhrase makes, beside the inputs (DL-205).');
}

// No range is invented: the console never fills in the copy the app shipped with, or any other.
const copy = code(copyText);
for (const [file, text] of [[PAGE, page], [TEMPLATE, template], [COPY, copy], [DOMAIN, domain], [MAPPER, code(readFileSync(MAPPER, 'utf8'))]]) {
  const found = /\b(?:min|max)\s*:\s*\d|\b\d+\s*[–-]\s*\d+\s+working\b|setReviewDays\([^,)]*,\s*['"`\d]/.exec(text);
  if (found !== null) {
    failures.push(`${shown(file)} writes a review time of its own (${found[0]}). Only the server says how long a review takes (DL-205).`);
  }
}
// Each end is set to what was typed, what the server sent, or nothing: once the empty strings are
// taken out of its argument, no literal is left in it.
for (const call of page.matchAll(/(?:reviewMin|reviewMax)\s*\.\s*set\s*\(/g)) {
  const open = (call.index ?? 0) + call[0].length - 1;
  let end = open;
  for (let i = open, depth = 0; i < page.length; i++) {
    if (page[i] === '(') depth++;
    else if (page[i] === ')' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (/['"`]|\b\d/.test(page.slice(open + 1, end).replace(/''/g, ''))) {
    failures.push('A review time input is set to a number written in the code. Only the server says how long a review takes (DL-205).');
    break;
  }
}
if (!/verificationReviewWorkingDays:\s*\{\s*min:\s*1,\s*max:\s*3\s*\}/.test(mock)) {
  failures.push("The mock no longer seeds the range the API's migration stores, today's copy in the app (DL-205).");
}

// Not sent is unknown, not "none": read as undefined, shown as such, and never sent.
// Matched on the function's text: its return type is an object literal, which `block` would take.
if (
  !/reviewTimeOf\(\s*field\(\s*wire\s*,\s*'verification_review_working_days'\s*\)\s*\)/.test(mapper) ||
  !/function reviewTimeOf\([\s\S]{0,300}?if \(value === undefined \|\| value === null\)\s*\{\s*return \{ readable: true, days: value \}/.test(mapper) ||
  /reviewTime\s*===\s*null/.test(block(mapper, mapper.indexOf('export function toAppConfig')))
) {
  failures.push('The mapper no longer reads an absent review time as unknown, beside null as the app stating none (DL-205).');
}
if (!/@if \(current\.verificationReviewWorkingDays === undefined\)\s*\{\s*<p[^>]*>\{\{\s*copy\s*\.\s*reviewNotSent\s*\}\}/.test(template)) {
  failures.push('The page no longer says so when the API does not send the review time (DL-205).');
}
if (!/if \(current === undefined\) \{\s*return undefined;/.test(methodBody(page, 'reviewTimeChange'))) {
  failures.push('A review time the API did not send can be sent. What is not known is not offered (DL-205).');
}

// Out whole under its own key; the refusal back by input.
const toWireDays = block(mapper, mapper.indexOf('function toWireWorkingDays'));
if (
  !/verification_review_working_days:\s*toWireWorkingDays\(\s*changes\s*\.\s*verificationReviewWorkingDays\s*\)/.test(mapper) ||
  !/\{\s*min:\s*range\.min,\s*max:\s*range\.max\s*\}/.test(toWireDays)
) {
  failures.push('The mapper no longer sends the review time whole, min and max together, under its own key (DL-205).');
}
if (
  !/'verification_review_working_days\.min':\s*'min'/.test(mapper) ||
  !/'verification_review_working_days\.max':\s*'max'/.test(mapper) ||
  !/catchError\(\s*\(\s*failure\s*:\s*unknown\s*\)\s*=>\s*throwError\(\s*\(\)\s*=>\s*withReviewTimeRefusal\(\s*failure\s*\)\s*\)\s*\)/.test(
    block(
      code(read(APP, 'data', 'http', 'http-repositories.ts')),
      code(read(APP, 'data', 'http', 'http-repositories.ts')).search(/\n\s+change\(changes: AppConfigChanges\)/),
    ),
  )
) {
  failures.push("The server's refusal of a review time no longer comes back by the input it is about (DL-205).");
}
for (const part of ['min', 'max']) {
  const input = template.slice(template.indexOf(`id="settings-review-${part}"`), template.indexOf('/>', template.indexOf(`id="settings-review-${part}"`)));
  if (
    !input.includes(`[attr.aria-describedby]="reviewDescribedBy().${part}"`) ||
    !input.includes(`[attr.aria-invalid]="reviewErrors().${part} === null ? null : 'true'"`) ||
    !template.includes(`class="field__error" id="settings-review-${part}-error"`)
  ) {
    failures.push(`The review time's ${part} input no longer names its error (aria-describedby, aria-invalid, .field__error) (DL-205).`);
  }
}
if (!/`settings-review-\$\{part\}-error`/.test(block(page, page.indexOf('protected readonly reviewDescribedBy')))) {
  failures.push("reviewDescribedBy no longer points each input at its own error (DL-205).");
}

/* ── 10. the biometric (selfie) consent (DL-216) ─────────────────────────── */

/** A sentence as it reads: the string concatenations that wrap it at 100 columns undone. */
const joined = (text) => text.replace(/['`]\s*\+\s*['`]/g, '');
const effectsSaid = joined(effectsText);
const copySaid = joined(copyText);

for (const [pattern, said] of [
  [/biometricFirstPublished:[\s\S]{0,120}Residents can send a selfie from now on/, 'that a first publication lets residents send a selfie'],
  [/biometricFirstPublished:[\s\S]{0,300}no resident could verify their ID by selfie/, 'that until then no resident could verify by selfie'],
  [/biometricFirstPublished:[\s\S]{0,600}This cannot be undone here/, 'that a first publication cannot be undone here'],
  [/biometricPublished:[\s\S]{0,300}must agree to \$\{version\} in the app before sending another selfie/, 'that a new version is agreed to again before the next selfie'],
  [/biometricPublished:[\s\S]{0,400}Selfies already sent are kept/, 'that the selfies already sent are kept'],
  [/biometricPublished:[\s\S]{0,700}text changes without asking anyone to agree/, 'that the same version changes the text without asking anyone to agree again'],
]) {
  if (!pattern.test(effectsSaid)) failures.push(`APP_CONFIG_EFFECTS no longer says ${said} (DL-216).`);
}
for (const effect of ['APP_CONFIG_EFFECTS.biometricFirstPublished', 'APP_CONFIG_EFFECTS.biometricPublished']) {
  if (!listed.includes(effect)) {
    failures.push(`appConfigEffects no longer lists ${effect}, so the confirmation would not say it (DL-216).`);
  }
}
if (!/changes\s*\.\s*biometricConsent !== undefined\s*\)\s*\{\s*effects\s*\.\s*push\(\.\.\.APP_CONFIG_EFFECTS\s*\.\s*asWritten\)/.test(listed)) {
  failures.push('appConfigEffects no longer says the biometric consent is published as written (DL-216).');
}
if (asks.includes('biometricConsent')) {
  failures.push(
    'asksEveryResident covers the biometric consent. It stops nobody using the app, and an ' +
      'acknowledgement nobody needs teaches administrators to tick without reading (DL-216).',
  );
}

// Until it is published, the page says plainly that the app cannot take selfies — at its top.
if (
  !/selfiesRefusedTitle:\s*'The app cannot take selfies\.'/.test(copySaid) ||
  !/selfiesRefused:\s*'No biometric consent is published, so the server refuses every selfie and no resident can verify their ID by selfie\./.test(copySaid) ||
  !/Until the LGU’s approved biometric consent is published here, the app cannot take a selfie, so no resident can verify their ID by selfie/.test(copySaid)
) {
  failures.push('The copy no longer says plainly that the app cannot take selfies, so no resident can verify by selfie (DL-216).');
}
const refusedAt = template.search(/@if \(selfiesRefused\(\)\)\s*\{\s*<p[^>]*>[\s\S]{0,120}copy\s*\.\s*selfiesRefused\s*\}\}/);
const firstFieldset = template.indexOf('<fieldset');
if (refusedAt === -1 || firstFieldset === -1 || refusedAt > firstFieldset) {
  failures.push('The page no longer says at its top, before any setting, that the app cannot take selfies (DL-216).');
}
if (!/config\s*\.\s*biometricConsent !== undefined && isPlaceholderText\(\s*config\s*\.\s*biometricConsent\s*\)/.test(block(domain, domain.indexOf('export function refusesEverySelfie')))) {
  failures.push('refusesEverySelfie no longer says so exactly while the biometric consent is the placeholder (DL-216).');
}
if (!/refusesEverySelfie\(/.test(block(page, page.indexOf('protected readonly selfiesRefused')))) {
  failures.push('selfiesRefused no longer asks refusesEverySelfie (DL-216).');
}

// Read whole, unknown when absent, sent with its version.
const biometricOf = mapper.slice(mapper.indexOf('function biometricConsentOf'), mapper.indexOf('function reviewTimeOf'));
if (
  !/biometricConsentOf\(\s*field\(\s*wire\s*,\s*'biometric_consent'\s*\)\s*\)/.test(mapper) ||
  !/if \(value === undefined\)\s*\{\s*return \{ readable: true, text: undefined \}/.test(biometricOf) ||
  !/legalTextOf\(\s*value\s*\)/.test(biometricOf) ||
  !/!biometricConsent\.readable/.test(block(mapper, mapper.indexOf('export function toAppConfig')))
) {
  failures.push('The mapper no longer reads the biometric consent whole, and as unknown when the API does not send it (DL-216).');
}
if (!/biometric_consent:\s*toWireLegalText\s*\(\s*changes\s*\.\s*biometricConsent\s*\)/.test(mapper)) {
  failures.push('The mapper no longer sends the biometric consent with its version, together (DL-216).');
}

// The checklist: topics with their sources, beside the editor, and never in the field.
const requirementsText = code(readFileSync(REQUIREMENTS, 'utf8'));
const entries = [...requirementsText.matchAll(/\{\s*topic:\s*'([^']+)',\s*detail:[\s\S]*?basis:\s*([\s\S]*?),\s*\}/g)];
if (entries.length < 8 || entries.some((entry) => !/RA 10173|NPC/.test(entry[2]))) {
  failures.push('The biometric consent checklist lost topics, or a topic no longer names its source in RA 10173 or the NPC (DL-216).');
}
for (const topic of ['Purpose', 'How long it is kept', 'Freely given', 'Asked on its own', 'Withdrawing', 'What withdrawing does', 'Declining']) {
  if (!entries.some((entry) => entry[1] === topic)) failures.push(`The biometric consent checklist no longer covers “${topic}” (DL-216).`);
}
if (!/The server erases the resident’s selfies/.test(requirementsText)) {
  failures.push('The checklist no longer says that withdrawing erases the selfies, which the server does (DL-216).');
}
if (/export (?:async )?function|=>/.test(requirementsText)) {
  failures.push('The biometric consent checklist does something. It is data: topics and sources, which decide nothing (DL-216).');
}
const editorAt = template.indexOf('@if (isEditing(kind))');
const textareaAt = template.indexOf('<textarea', editorAt);
const checklistAt = template.search(/@if \(kind === 'biometricConsent'\)\s*\{\s*<aside/);
const putAwayAt = template.indexOf('(click)="stopEditing(kind)"', editorAt);
if (editorAt === -1 || checklistAt === -1 || !(textareaAt < checklistAt && checklistAt < putAwayAt)) {
  failures.push('The checklist of what a biometric consent has to cover no longer stands beside its editor (DL-216).');
}
if (!/@for \(requirement of requirements;[\s\S]{0,600}requirement\s*\.\s*basis/.test(template)) {
  failures.push('The checklist no longer shows each topic with its source (DL-216).');
}
if ([...template.matchAll(/<textarea[\s\S]*?>/g)].some((tag) => !/\[value\]="draftBody\(\)\[kind\]"/.test(tag[0]))) {
  failures.push('A text field shows something other than its own draft (DL-216).');
}
// Every draft is set from what was typed, what is published, or nothing: once the empty strings are
// taken out, the argument names nothing but these. A checklist line put into a draft names more.
const DRAFT_NAMES = new Set(['drafts', 'kind', 'draft', 'version', 'bodyMarkdown', 'value', 'terms', 'privacyNotice', 'biometricConsent']);
for (const call of page.matchAll(/(?:draftBody|draftVersion)\s*\.\s*(?:set|update)\s*\(/g)) {
  const open = (call.index ?? 0) + call[0].length - 1;
  let end = open;
  for (let i = open, depth = 0; i < page.length; i++) {
    if (page[i] === '(') depth++;
    else if (page[i] === ')' && --depth === 0) {
      end = i;
      break;
    }
  }
  const names = page.slice(open + 1, end).replace(/''/g, '').match(/[A-Za-z_$][\w$]*/g) ?? [];
  const stranger = names.find((name) => !DRAFT_NAMES.has(name));
  if (stranger !== undefined) {
    failures.push(`A legal text draft is set from ${stranger}, not from what was typed or published. Nothing here writes legal text (DL-186, DL-216).`);
    break;
  }
}

/* ── 6. no log, no storage ───────────────────────────────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir|group))\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) failures.push(`${shown(file)} uses ${found[1]}. Nothing about the settings is logged or stored.`);
}

/* ── 7. the server's key ─────────────────────────────────────────────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(permission.indexOf('export const PERMISSIONS'), permission.indexOf('] as const;'));
// Everything after the vocabulary: the role definitions and the shared lists they spread.
const roles = permission.slice(permission.indexOf('] as const;'));
if (!vocabulary.includes("'app-config.manage'")) failures.push("PERMISSIONS does not hold 'app-config.manage', the API's own key.");
if (roles.includes("'app-config.manage'")) failures.push("A role lists 'app-config.manage' by name. The API grants it to administrators alone.");
if (code(read(APP, 'domain', 'access', 'permission-matrix.ts')).includes('app-config.manage')) {
  failures.push("'app-config.manage' is classified read-only. It changes what every resident's app does.");
}
if (
  !/path:\s*'app-settings',[\s\S]{0,300}?canActivate:\s*\[servedGuard\('app-config'\),\s*permissionGuard\('app-config\.manage'\)\]/.test(
    read(APP, 'app.routes.ts'),
  )
) {
  failures.push("The /app-settings route does not ask for servedGuard('app-config') and permissionGuard('app-config.manage').");
}
if (!/route:\s*'\/app-settings',[\s\S]{0,120}permissions:\s*\['app-config\.manage'\]/.test(read(APP, 'core', 'navigation', 'navigation.ts'))) {
  failures.push("The menu's App settings entry does not ask for 'app-config.manage'.");
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nApp settings check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `App settings check passed (${moduleFiles.length} files: residents told, sent only after the review, ` +
      'acknowledged where it can stop residents, effects before the button, flags not secret, the key ' +
      'the administrator’s; the Terms of Use and privacy notice published with their version, a new ' +
      'version acknowledged, no legal text written or rendered here; the review time said in the ' +
      'app’s words, never invented, unknown when not sent, and refused beside its input; the ' +
      'biometric consent said missing at the top, its effects before the button, and its checklist ' +
      'beside the editor, never in it).',
  );
}
