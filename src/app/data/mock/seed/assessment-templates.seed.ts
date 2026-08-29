import type { AssessmentTemplate } from '@domain/index';

/**
 * The assessment forms, mirroring `config/assessment.php` on the server.
 *
 * **Including `placeholder-pending-lgu-approval`.** These are a plausible AICS-style instrument,
 * not Taytay's — the office has not adopted them — and the server says so on every template. A
 * seed that marked them adopted would be the more convenient mock, and a mock more convenient than
 * the thing it stands in for is one a screen gets built against: the checklist already taught this
 * repository that lesson once, when absent meant unticked here and something else on the server.
 *
 * The versions are the published ones. They are pinned onto an assessment at the moment it is
 * opened, so a stale version here would make a mock assessment claim a form that was never asked.
 */
export const ASSESSMENT_TEMPLATE_SEED: readonly AssessmentTemplate[] = [
  {
    code: 'aics-general',
    version: '2026.08.1',
    label: 'AICS general intake assessment',
    status: 'placeholder-pending-lgu-approval',
    questions: [
      {
        code: 'household_income_bracket',
        label: 'Reported monthly household income bracket',
        kind: 'choice',
        required: true,
        choices: ['none', 'below-5000', '5000-10000', '10000-20000', 'above-20000'],
      },
      {
        code: 'income_earners',
        label: 'Number of income earners in the household',
        kind: 'integer',
        required: true,
        choices: [],
      },
      {
        code: 'dwelling_observed',
        label: 'Dwelling condition observed',
        kind: 'choice',
        required: false,
        choices: ['adequate', 'needs-repair', 'unsafe', 'not-observed'],
      },
      {
        code: 'presenting_problem',
        label: "Presenting problem in the assessor's words",
        kind: 'text',
        required: true,
        choices: [],
      },
      {
        code: 'other_assistance_received',
        label: 'Other assistance received in the last 12 months',
        kind: 'text',
        required: false,
        choices: [],
      },
      {
        code: 'immediate_risk',
        label: 'Is there immediate risk to safety, health or shelter?',
        kind: 'choice',
        required: true,
        choices: ['none', 'possible', 'present'],
      },
    ],
  },
  {
    code: 'medical-assistance',
    version: '2026.08.1',
    label: 'Medical assistance assessment',
    status: 'placeholder-pending-lgu-approval',
    questions: [
      { code: 'facility', label: 'Attending facility', kind: 'text', required: true, choices: [] },
      {
        code: 'billing_status',
        label: 'Billing status',
        kind: 'choice',
        required: true,
        choices: ['pending', 'partially-settled', 'settled', 'unknown'],
      },
      {
        code: 'philhealth_applied',
        label: 'PhilHealth benefit already applied?',
        kind: 'choice',
        required: true,
        choices: ['yes', 'no', 'unknown'],
      },
      {
        code: 'presenting_problem',
        label: "Presenting problem in the assessor's words",
        kind: 'text',
        required: true,
        choices: [],
      },
      /*
       * Deliberately absent, and copied here as an absence rather than silently not typed:
       * diagnosis, and any field inviting one. A diagnosis is health information — the most
       * restricted category under RA 10173 — and an assistance assessment does not need it. What
       * the office decides is whether there is a bill the household cannot meet, which
       * `billing_status` and `philhealth_applied` answer without putting anybody's medical
       * condition in a welfare file ordinary staff can list.
       */
    ],
  },
];
