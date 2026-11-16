import { describe, expect, it } from 'vitest';

import { asIsoDate, centavos } from '@domain/index';

import OFFICE_ASSESSMENT_TEMPLATES from '../fixtures/office-assessment-templates.json';
import OFFICE_DOCUMENT_GRANT from '../fixtures/office-document-grant.json';
import OFFICE_DOCUMENT_REQUESTS from '../fixtures/office-document-requests.json';
import OFFICE_OPEN_ASSESSMENT from '../fixtures/office-open-assessment.json';
import OFFICE_REQUESTS_PAGE from '../fixtures/office-requests-page.json';
import {
  toAssessmentTemplate,
  toAssistanceRequest,
  toDocumentAccessGrant,
  toDocumentRequest,
  toOpenAssessment,
  toWireAssessment,
  toWireAssessmentAnswers,
  toWireDocumentUpload,
} from './assistance-request.mapper';
import { toBarangayIndex } from './resident.mapper';

/**
 * The phase 2b reads and bodies (`DL-178`), held to fixtures composed from the vendored spec. The
 * request itself is read through the adapter in `http-assistance-requests.spec.ts`.
 */
describe('the assistance-request mapper, phase 2b (DL-178)', () => {
  const [OPEN, WITHDRAWN] = OFFICE_DOCUMENT_REQUESTS.data;
  const [TEMPLATE] = OFFICE_ASSESSMENT_TEMPLATES.data;

  it('passes a withheld message through as withheld, never as an empty one', () => {
    expect(toDocumentRequest(WITHDRAWN)).toMatchObject({ message: null, isWithheld: true });
    expect(toDocumentRequest({ ...OPEN, message: null })).toBeNull();
    // Withheld wins over words that should not have been sent.
    expect(toDocumentRequest({ ...OPEN, is_withheld: true })?.message).toBeNull();
  });

  it('refuses a state, a channel or a withheld flag it has no word for', () => {
    expect(toDocumentRequest({ ...OPEN, state: 'expired' })).toBeNull();
    expect(toDocumentRequest({ ...OPEN, channel: 'email' })).toBeNull();
    expect(toDocumentRequest({ ...OPEN, is_withheld: undefined })).toBeNull();
  });

  it('refuses a form with a status or a question it cannot render, rather than drop the question', () => {
    expect(toAssessmentTemplate(TEMPLATE)?.questions.length).toBe(TEMPLATE?.questions.length);
    expect(toAssessmentTemplate({ ...TEMPLATE, status: 'draft' })).toBeNull();
    expect(
      toAssessmentTemplate({
        ...TEMPLATE,
        questions: [...(TEMPLATE?.questions ?? []), { code: 'x', label: 'X', kind: 'slider' }],
      }),
    ).toBeNull();
  });

  it('reads answers as text or null, and refuses any other answer', () => {
    expect(toOpenAssessment(OFFICE_OPEN_ASSESSMENT.data)?.answers).toEqual({
      household_size: '5',
      remarks: null,
    });
    expect(
      toOpenAssessment({ ...OFFICE_OPEN_ASSESSMENT.data, answers: { household_size: 5 } }),
    ).toBeNull();
  });

  it('refuses a grant without the server’s warning', () => {
    expect(toDocumentAccessGrant(OFFICE_DOCUMENT_GRANT.data)?.warning).toBe(
      OFFICE_DOCUMENT_GRANT.data.warning,
    );
    expect(toDocumentAccessGrant({ ...OFFICE_DOCUMENT_GRANT.data, warning: '' })).toBeNull();
  });

  it('sends the recommended amount in integer centavos and the home visit as the assessor said', () => {
    expect(
      toWireAssessment({
        findings: '  Found the household in one rented room. ',
        recommendedAmount: centavos(150_050),
        homeVisitConducted: false,
        recommendation: 'recommend-deny',
        reason: ' Income above the ceiling. ',
      }),
    ).toEqual({
      findings: 'Found the household in one rented room.',
      recommended_amount_centavos: 150_050,
      home_visit_conducted: false,
      recommendation: 'recommend-deny',
      reason: 'Income above the ceiling.',
    });
  });

  it('sends a blank answer as null, and the form codes as they are', () => {
    expect(toWireAssessmentAnswers({ household_size: ' 4 ', remarks: '' })).toEqual({
      answers: { household_size: '4', remarks: null },
    });
  });

  it('leaves out a form field with nothing to say, and the file for a source that holds none', () => {
    const fields = toWireDocumentUpload({
      file: null,
      source: 'external-verification',
      documentNumber: '  ',
      issuedOn: asIsoDate('2026-10-01'),
      expiresOn: null,
      replacesBecause: null,
    });
    expect(fields).toEqual({
      file: undefined,
      source: 'external-verification',
      document_number: undefined,
      issued_on: '2026-10-01',
      expires_on: undefined,
      replaces_because: undefined,
    });
  });
});

/**
 * A self-approval as the server read it from the history (`DL-226`): who endorsed, whether this
 * reader approving now would be their own endorsement, and which approval was. Never worked out here.
 */
describe('the assistance-request mapper, a self-approval (DL-226)', () => {
  const BARANGAYS = toBarangayIndex([
    { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04', name: 'San Juan' },
  ]);
  const ENDORSED = OFFICE_REQUESTS_PAGE.data[1];
  const ENDORSER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c02';
  const APPROVAL = {
    from: 'endorsed',
    to: 'approved',
    reason: 'Within the programme ceiling.',
    actor_id: ENDORSER,
    actor_name: 'Ramon Cruz',
    occurred_at: '2026-11-05T02:00:00.000Z',
    approved_amount_centavos: 300_000,
    approved_in_kind_description: null,
    self_approved: true,
  };

  it('reads who endorsed it, and whether the reader approving now would approve their own', () => {
    expect(ENDORSED?.status).toBe('endorsed');
    const read = toAssistanceRequest({ ...ENDORSED, would_self_approve: true }, BARANGAYS);
    expect(read?.endorsedBy).toBe(ENDORSER);
    expect(read?.wouldSelfApprove).toBe(true);
    expect(read?.selfApproved).toBe(false);
    expect(toAssistanceRequest(ENDORSED, BARANGAYS)?.wouldSelfApprove).toBe(false);
  });

  it('reads the mark on the approval it was made on, and on the request', () => {
    const read = toAssistanceRequest(
      {
        ...ENDORSED,
        status: 'approved',
        approved_amount_centavos: 300_000,
        would_self_approve: false,
        self_approved: true,
        status_history: [...(ENDORSED?.status_history ?? []), APPROVAL],
      },
      BARANGAYS,
    );
    expect(read?.selfApproved).toBe(true);
    expect(read?.statusHistory.map((change) => change.selfApproved)).toEqual([false, false, true]);
  });

  it('reads an absent mark as no self-approval, and a request never endorsed as endorsed by nobody', () => {
    const unmarked = {
      from: APPROVAL.from,
      to: APPROVAL.to,
      reason: APPROVAL.reason,
      actor_id: APPROVAL.actor_id,
      actor_name: APPROVAL.actor_name,
      occurred_at: APPROVAL.occurred_at,
      approved_amount_centavos: APPROVAL.approved_amount_centavos,
      approved_in_kind_description: null,
    };
    const read = toAssistanceRequest(
      { ...ENDORSED, endorsed_by: null, status_history: [unmarked] },
      BARANGAYS,
    );
    expect(read?.endorsedBy).toBeNull();
    expect(read?.statusHistory[0]?.selfApproved).toBe(false);
  });
});
