/**
 * The assessment form the office asks, and what has been answered against it.
 *
 * ## The version is the point
 *
 * Every assessment pins `templateCode` **and** `templateVersion` at the moment it is opened, and
 * the server reads the version once, at open, deliberately. Reading it again at completion would
 * let a change to the form appear to have altered what an assessment asked — and the recorded
 * answers would then be attributed to questions that were not the ones put to that family. It
 * matters most precisely when somebody is disputing a decision made two years ago.
 *
 * So the version travels with the assessment through this console too, and is shown. A version
 * nobody can see is one nobody notices has changed.
 *
 * ## Nothing here scores
 *
 * There is no weight, no total and no threshold on a question, and there must not be. A form that
 * computed an eligibility number would be the automatic decision `DL-60`, `DL-66` and `DL-78` each
 * refuse, wearing a questionnaire's clothes — and it is the easiest of all of them to add by
 * accident, because a numeric answer looks like it wants to be summed.
 */

/** How a question is answered. `integer` is still recorded as text; the office counts, it does not compute. */
export type AssessmentQuestionKind = 'choice' | 'integer' | 'text';

export interface AssessmentQuestion {
  readonly code: string;
  readonly label: string;
  readonly kind: AssessmentQuestionKind;
  readonly required: boolean;
  /** Empty for anything but a `choice`. */
  readonly choices: readonly string[];
}

/**
 * Whether the office has actually adopted this form.
 *
 * The published templates are marked `placeholder-pending-lgu-approval`, and that is not a
 * formality: they are a plausible AICS-style instrument, not Taytay's. This follows the
 * `convention-pending-confirmation` pattern of `DL-68` and `DL-105` — a provisional figure says so
 * on screen until somebody records the check, rather than being quietly presented as settled.
 */
export type AssessmentTemplateStatus = 'placeholder-pending-lgu-approval' | 'adopted';

export interface AssessmentTemplate {
  readonly code: string;
  readonly version: string;
  readonly label: string;
  readonly status: AssessmentTemplateStatus;
  readonly questions: readonly AssessmentQuestion[];
}

/** Answers keyed by question code. A `null` is "asked and left blank", not "not asked". */
export type AssessmentAnswers = Readonly<Record<string, string | null>>;

/** An assessment the office has opened against a case, with whatever has been answered so far. */
export interface OpenAssessment {
  readonly templateCode: string;
  readonly templateVersion: string;
  readonly completed: boolean;
  readonly answers: AssessmentAnswers;
}

/**
 * The required questions still unanswered.
 *
 * The server refuses to complete without these, and it is right to — but a save that fails at the
 * end, after the findings are written, tells the assessor nothing about which question to go back
 * to. This names them, in the form's own words, before the button is pressed.
 *
 * A blank string counts as unanswered. Whitespace typed into a required box is not an answer, and
 * treating it as one is how a required field becomes optional in practice.
 */
export function unansweredRequired(
  template: AssessmentTemplate,
  answers: AssessmentAnswers,
): readonly AssessmentQuestion[] {
  return template.questions.filter((question) => {
    if (!question.required) return false;
    const answer = answers[question.code];
    return answer === undefined || answer === null || answer.trim() === '';
  });
}

/**
 * Whether an answer is one the form will accept.
 *
 * Choice questions are checked against their list; everything else is accepted as written. That
 * permissiveness is deliberate and matches the server: an assessor recording something the form did
 * not anticipate is describing reality, and a validator that refuses it teaches them to pick the
 * nearest wrong option instead — which puts a wrong answer in the record rather than an
 * inconvenient one.
 */
export function acceptsAnswer(question: AssessmentQuestion, value: string | null): boolean {
  if (question.kind !== 'choice' || value === null) return true;
  return question.choices.includes(value);
}
