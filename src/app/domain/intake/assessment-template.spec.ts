import { describe, expect, it } from 'vitest';

import {
  acceptsAnswer,
  unansweredRequired,
  type AssessmentQuestion,
  type AssessmentTemplate,
} from './assessment-template';

const question = (over: Partial<AssessmentQuestion> = {}): AssessmentQuestion => ({
  code: 'immediate_risk',
  label: 'Is there immediate risk to safety, health or shelter?',
  kind: 'choice',
  required: true,
  choices: ['none', 'possible', 'present'],
  ...over,
});

const template = (questions: readonly AssessmentQuestion[]): AssessmentTemplate => ({
  code: 'aics-general',
  version: '2026.08.1',
  label: 'AICS general intake assessment',
  status: 'placeholder-pending-lgu-approval',
  questions,
});

describe('what the form still needs', () => {
  it('names the required questions nobody has answered', () => {
    const form = template([question(), question({ code: 'facility', required: false })]);

    expect(unansweredRequired(form, {}).map((q) => q.code)).toEqual(['immediate_risk']);
  });

  it('is satisfied by an answer', () => {
    const form = template([question()]);

    expect(unansweredRequired(form, { immediate_risk: 'none' })).toEqual([]);
  });

  /**
   * Whitespace is not an answer.
   *
   * A required box containing a space would satisfy a naive presence check and leave the record
   * saying the assessor was asked about immediate risk and said nothing. The server's own check is
   * on the stored value; this one is what the assessor sees first, and the two must agree.
   */
  it('treats whitespace in a required box as unanswered', () => {
    const form = template([question()]);

    expect(unansweredRequired(form, { immediate_risk: '   ' }).map((q) => q.code)).toEqual([
      'immediate_risk',
    ]);
  });

  /**
   * A `null` is "asked and left blank", and still unanswered when the question is required.
   *
   * The distinction matters one level up — a `null` is preserved through the mapper rather than
   * dropped, because "asked and left blank" is a different record from "never asked" — but for a
   * required question both mean the form cannot be filed.
   */
  it('counts an explicit blank as unanswered', () => {
    const form = template([question()]);

    expect(unansweredRequired(form, { immediate_risk: null })).toHaveLength(1);
  });

  it('never reports an optional question', () => {
    const form = template([question({ required: false })]);

    expect(unansweredRequired(form, {})).toEqual([]);
  });
});

describe('what the form accepts', () => {
  it('accepts a choice from the list', () => {
    expect(acceptsAnswer(question(), 'possible')).toBe(true);
  });

  it('refuses a choice that is not on the list', () => {
    expect(acceptsAnswer(question(), 'catastrophic')).toBe(false);
  });

  /**
   * Free text is accepted as written, deliberately, matching the server.
   *
   * An assessor recording something the form did not anticipate is describing reality. A validator
   * that refuses it teaches them to pick the nearest wrong option instead, which puts a wrong
   * answer in a family's file rather than an inconvenient one.
   */
  it('accepts anything written into a text question', () => {
    expect(acceptsAnswer(question({ kind: 'text', choices: [] }), 'Roof sheets missing')).toBe(true);
  });

  it('accepts a blank on a choice question, because blank is not a wrong choice', () => {
    expect(acceptsAnswer(question(), null)).toBe(true);
  });
});
