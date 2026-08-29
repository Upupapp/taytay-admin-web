import type {
  AssessmentAnswers,
  AssessmentQuestion,
  AssessmentQuestionKind,
  AssessmentTemplate,
  AssessmentTemplateStatus,
  OpenAssessment,
} from '@domain/index';

import { bool, str, text } from './wire';

/**
 * The assessment form catalogue and an open assessment, read from the API.
 *
 * ## The templates arrive as a map, not a list
 *
 * `GET admin/assessment-templates` answers `{ templates: { 'aics-general': {…}, … } }` — keyed by
 * code, because the server reads them out of a config file whose keys *are* the codes. The domain
 * wants a list in a stable order, so the keys are sorted rather than left to object-key order,
 * which is not a promise anybody made.
 *
 * ## A form nobody has adopted says so
 *
 * The published templates carry `status: 'placeholder-pending-lgu-approval'`, and the config file
 * is explicit that they are "a plausible AICS-style intake assessment, not Taytay's instrument".
 * Any status this mapper does not recognise is read as **provisional**, not as adopted: the safe
 * direction for an unknown value is the one that keeps the caveat on screen.
 */

const KINDS: readonly AssessmentQuestionKind[] = ['choice', 'integer', 'text'];

function toQuestion(wire: unknown): AssessmentQuestion | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const code = str(row['code']);
  if (code === null) return null;

  const kindValue = str(row['type']);
  const kind = KINDS.find((candidate) => candidate === kindValue) ?? 'text';

  const choices = Array.isArray(row['choices'])
    ? row['choices'].map((choice) => str(choice)).filter((choice): choice is string => choice !== null)
    : [];

  return {
    code,
    // The form's own wording. A question relabelled here is a different question asked.
    label: text(row['label'], code),
    kind,
    required: bool(row['required']),
    choices,
  };
}

function toStatus(wire: unknown): AssessmentTemplateStatus {
  return str(wire) === 'adopted' ? 'adopted' : 'placeholder-pending-lgu-approval';
}

export function toAssessmentTemplate(code: string, wire: unknown): AssessmentTemplate | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const questions = Array.isArray(row['questions'])
    ? row['questions']
        .map((question) => toQuestion(question))
        .filter((question): question is AssessmentQuestion => question !== null)
    : [];

  return {
    code: str(row['code']) ?? code,
    /*
     * `unversioned` is the server's own fallback, kept rather than blanked. An assessment pinned
     * to "unversioned" is a fact about the form, and hiding it would leave the screen implying a
     * version was recorded when none was.
     */
    version: text(row['version'], 'unversioned'),
    label: text(row['label'], code),
    status: toStatus(row['status']),
    questions,
  };
}

export function toAssessmentTemplates(wire: unknown): readonly AssessmentTemplate[] {
  if (typeof wire !== 'object' || wire === null) return [];
  const templates = (wire as Record<string, unknown>)['templates'];
  if (typeof templates !== 'object' || templates === null) return [];

  return Object.keys(templates as Record<string, unknown>)
    .sort()
    .map((code) => toAssessmentTemplate(code, (templates as Record<string, unknown>)[code]))
    .filter((template): template is AssessmentTemplate => template !== null);
}

/**
 * An open assessment and the answers recorded against it.
 *
 * `answers` arrives as a list of `{ question_code, answer_value }` rather than an object, so a
 * question code that is not a valid identifier cannot collide with anything. It is folded into a
 * map here because that is what a form binds to — and a `null` value is preserved rather than
 * dropped, because "asked and left blank" is a different record from "never asked".
 */
export function toOpenAssessment(wire: unknown): OpenAssessment | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const templateCode = str(row['template_code']);
  if (templateCode === null) return null;

  const answers: Record<string, string | null> = {};
  if (Array.isArray(row['answers'])) {
    for (const entry of row['answers']) {
      if (typeof entry !== 'object' || entry === null) continue;
      const answer = entry as Record<string, unknown>;
      const code = str(answer['question_code']);
      if (code === null) continue;
      answers[code] = str(answer['answer_value']);
    }
  }

  return {
    templateCode,
    templateVersion: text(row['template_version'], 'unversioned'),
    completed: str(row['status']) === 'completed',
    answers: answers as AssessmentAnswers,
  };
}
