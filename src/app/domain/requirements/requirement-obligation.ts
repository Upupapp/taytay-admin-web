/**
 * How firmly a document is asked for.
 *
 * Replaces the `isMandatory` boolean the catalog carried before TAB 14. The
 * master command asks for required / optional / **conditional**, and a boolean
 * cannot say "only if you are claiming for a child" — so the office was forced
 * to record such a document as required (and every applicant without a child
 * appeared to be missing one) or as optional (and nobody chased it from the
 * applicants who did need it).
 *
 * Two sources of truth for "must they bring this?" would be worse than either,
 * so the boolean is gone rather than kept alongside.
 */

export type RequirementObligation = 'required' | 'optional' | 'conditional';

export const REQUIREMENT_OBLIGATIONS: readonly RequirementObligation[] = [
  'required',
  'optional',
  'conditional',
];

export const REQUIREMENT_OBLIGATION_LABELS: Readonly<Record<RequirementObligation, string>> = {
  required: 'Required',
  optional: 'Optional',
  conditional: 'Required in some cases',
};

export const REQUIREMENT_OBLIGATION_DESCRIPTIONS: Readonly<
  Record<RequirementObligation, string>
> = {
  required: 'Every applicant for this programme must present it.',
  optional: 'Helpful, but the request proceeds without it.',
  conditional: 'Needed only in the circumstances stated. A staff member decides whether it applies.',
};

/**
 * Whether a conditional document applies to this applicant.
 *
 * `undecided` is a real state and the default. The alternative — assuming a
 * conditional document does or does not apply — is the software making a
 * determination about somebody's circumstances, which is the same thing
 * `DL-42`, `DL-60` and `DL-66` refuse in three other places. Here it would
 * decide either that an applicant is missing a paper they never needed, or that
 * a paper the office does need was never asked for.
 *
 * A person decides, and the decision is recorded with a reason.
 */
export type ConditionalApplicability = 'undecided' | 'applies' | 'does-not-apply';

export const CONDITIONAL_APPLICABILITY_LABELS: Readonly<
  Record<ConditionalApplicability, string>
> = {
  undecided: 'Not yet decided',
  applies: 'Applies to this applicant',
  'does-not-apply': 'Does not apply to this applicant',
};

/**
 * Is this document outstanding *for this applicant*, right now?
 *
 * The one derivation. Everything that used to read `isMandatory` reads this
 * instead, so a conditional document cannot be counted one way on a checklist
 * and another way in a report.
 *
 * An **undecided conditional** is deliberately *not* outstanding. Nobody has
 * said it applies, so nothing is missing yet — but the checklist marks it as
 * needing a decision, which is a different prompt and belongs to staff rather
 * than to the applicant.
 */
export function isOutstandingObligation(
  obligation: RequirementObligation,
  applicability: ConditionalApplicability,
): boolean {
  switch (obligation) {
    case 'required':
      return true;
    case 'optional':
      return false;
    case 'conditional':
      return applicability === 'applies';
  }
}

/** A conditional document nobody has ruled on yet. Surfaced as staff work. */
export function awaitsApplicabilityDecision(
  obligation: RequirementObligation,
  applicability: ConditionalApplicability,
): boolean {
  return obligation === 'conditional' && applicability === 'undecided';
}
