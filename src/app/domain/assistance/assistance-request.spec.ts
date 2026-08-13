import { canTransition, nextStatuses } from '../shared/status';
import {
  ASSISTANCE_STATUS_CATALOG,
  ASSISTANCE_STATUS_TRANSITIONS,
  isTerminalAssistanceStatus,
  outstandingRequirements,
  type AssistanceRequest,
  type AssistanceRequestStatus,
  type SubmittedRequirement,
} from './assistance-request';

const ALL_STATUSES = Object.keys(ASSISTANCE_STATUS_CATALOG) as AssistanceRequestStatus[];

describe('assistance request lifecycle', () => {
  it('describes every status in the catalog', () => {
    for (const status of ALL_STATUSES) {
      const descriptor = ASSISTANCE_STATUS_CATALOG[status];
      expect(descriptor.value).toBe(status);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.description.length).toBeGreaterThan(0);
    }
  });

  it('defines transitions for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(ASSISTANCE_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('only ever transitions to a status that exists in the catalog', () => {
    for (const status of ALL_STATUSES) {
      for (const target of ASSISTANCE_STATUS_TRANSITIONS[status]) {
        expect(ALL_STATUSES).toContain(target);
      }
    }
  });

  it('allows the happy path from draft through to completion', () => {
    const path: AssistanceRequestStatus[] = [
      'draft',
      'submitted',
      'intake-review',
      'assessment',
      'endorsed',
      'approved',
      'scheduled',
      'released',
      'completed',
    ];

    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index] as AssistanceRequestStatus;
      const to = path[index + 1] as AssistanceRequestStatus;
      expect(canTransition(ASSISTANCE_STATUS_TRANSITIONS, from, to)).toBe(true);
    }
  });

  it('refuses to skip assessment and approve straight from intake', () => {
    expect(canTransition(ASSISTANCE_STATUS_TRANSITIONS, 'intake-review', 'approved')).toBe(false);
    expect(canTransition(ASSISTANCE_STATUS_TRANSITIONS, 'submitted', 'released')).toBe(false);
  });

  it('treats rejected, completed, cancelled and expired as terminal', () => {
    for (const status of ALL_STATUSES) {
      const terminal = isTerminalAssistanceStatus(status);
      expect(nextStatuses(ASSISTANCE_STATUS_TRANSITIONS, status).length === 0).toBe(terminal);
    }
  });

  it('lets a returned request re-enter intake but never jump to approval', () => {
    expect(canTransition(ASSISTANCE_STATUS_TRANSITIONS, 'returned', 'intake-review')).toBe(true);
    expect(canTransition(ASSISTANCE_STATUS_TRANSITIONS, 'returned', 'approved')).toBe(false);
  });
});

describe('outstandingRequirements', () => {
  function requirement(overrides: Partial<SubmittedRequirement>): SubmittedRequirement {
    return {
      id: 'rq-1' as SubmittedRequirement['id'],
      code: 'valid-id',
      label: 'Valid government ID',
      status: 'pending',
      isMandatory: true,
      submittedAt: null,
      reviewedBy: null,
      remarks: null,
      ...overrides,
    };
  }

  function requestWith(requirements: readonly SubmittedRequirement[]): AssistanceRequest {
    return { requirements } as AssistanceRequest;
  }

  it('ignores optional requirements', () => {
    const request = requestWith([requirement({ isMandatory: false })]);
    expect(outstandingRequirements(request)).toHaveLength(0);
  });

  it('counts a mandatory requirement that is only submitted, not verified', () => {
    const request = requestWith([requirement({ status: 'submitted' })]);
    expect(outstandingRequirements(request)).toHaveLength(1);
  });

  it('clears a requirement that was verified or waived', () => {
    const request = requestWith([
      requirement({ id: 'rq-1' as SubmittedRequirement['id'], status: 'verified' }),
      requirement({ id: 'rq-2' as SubmittedRequirement['id'], status: 'waived' }),
    ]);
    expect(outstandingRequirements(request)).toHaveLength(0);
  });
});
