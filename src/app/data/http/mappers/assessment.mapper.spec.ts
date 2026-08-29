import { describe, expect, it } from 'vitest';

import { toAssessmentTemplates, toOpenAssessment } from './assessment.mapper';

describe('reading the assessment forms', () => {
  const wire = {
    templates: {
      'medical-assistance': {
        code: 'medical-assistance',
        version: '2026.08.1',
        label: 'Medical assistance assessment',
        status: 'placeholder-pending-lgu-approval',
        questions: [
          { code: 'facility', label: 'Attending facility', type: 'text', required: true },
          {
            code: 'billing_status',
            label: 'Billing status',
            type: 'choice',
            required: true,
            choices: ['pending', 'settled'],
          },
        ],
      },
      'aics-general': { code: 'aics-general', version: '2026.08.1', label: 'AICS', questions: [] },
    },
  };

  it('reads the catalogue the API keys by code', () => {
    const templates = toAssessmentTemplates(wire);

    expect(templates.map((template) => template.code)).toEqual([
      'aics-general',
      'medical-assistance',
    ]);
  });

  it('keeps each question in the form’s own words, with its choices', () => {
    const medical = toAssessmentTemplates(wire).find((t) => t.code === 'medical-assistance');

    expect(medical?.questions[1]).toEqual({
      code: 'billing_status',
      label: 'Billing status',
      kind: 'choice',
      required: true,
      choices: ['pending', 'settled'],
    });
  });

  /**
   * A status the mapper does not recognise is read as provisional, never as adopted.
   *
   * The published forms are `placeholder-pending-lgu-approval` — a plausible AICS-style instrument
   * rather than Taytay's own — and the screen carries that caveat. If a future status arrives that
   * this console has never seen, the safe direction is the one that keeps the caveat up: presenting
   * an unadopted form as settled office policy is the failure that matters.
   */
  it('treats an unrecognised status as not yet adopted', () => {
    const templates = toAssessmentTemplates({
      templates: { x: { code: 'x', label: 'X', status: 'something-new', questions: [] } },
    });

    expect(templates[0]?.status).toBe('placeholder-pending-lgu-approval');
  });

  it('keeps the server’s own "unversioned" rather than blanking it', () => {
    const templates = toAssessmentTemplates({
      templates: { x: { code: 'x', label: 'X', questions: [] } },
    });

    expect(templates[0]?.version).toBe('unversioned');
  });

  it('is total: nothing here throws on a payload of the wrong shape', () => {
    expect(toAssessmentTemplates(null)).toEqual([]);
    expect(toAssessmentTemplates({ templates: 'nope' })).toEqual([]);
    expect(toAssessmentTemplates({ templates: { x: 7 } })).toEqual([]);
  });
});

describe('reading an open assessment', () => {
  it('folds the answer list into what a form binds to', () => {
    const assessment = toOpenAssessment({
      template_code: 'aics-general',
      template_version: '2026.08.1',
      status: 'in-progress',
      answers: [
        { question_code: 'immediate_risk', answer_value: 'none' },
        { question_code: 'income_earners', answer_value: '1' },
      ],
    });

    expect(assessment).toEqual({
      templateCode: 'aics-general',
      templateVersion: '2026.08.1',
      completed: false,
      answers: { immediate_risk: 'none', income_earners: '1' },
    });
  });

  /**
   * "Asked and left blank" is preserved as a key with a `null`.
   *
   * Dropping it would make the answer indistinguishable from a question never put to the family,
   * and those are different records — one says the assessor considered it, the other says nobody
   * did.
   */
  it('keeps a blank answer as a recorded blank', () => {
    const assessment = toOpenAssessment({
      template_code: 'aics-general',
      answers: [{ question_code: 'dwelling_observed', answer_value: null }],
    });

    expect(assessment?.answers).toEqual({ dwelling_observed: null });
    expect(Object.keys(assessment?.answers ?? {})).toContain('dwelling_observed');
  });

  it('reports a completed assessment as completed', () => {
    expect(toOpenAssessment({ template_code: 'x', status: 'completed' })?.completed).toBe(true);
  });

  /**
   * A payload with no template code is not an assessment, and is refused rather than patched.
   *
   * The adapter turns this `null` into an error the assessor sees. Substituting a plausible
   * assessment would tell them their form is open and let them write findings into nothing.
   */
  it('refuses a payload that names no form', () => {
    expect(toOpenAssessment({ status: 'in-progress', answers: [] })).toBeNull();
    expect(toOpenAssessment(null)).toBeNull();
  });
});
