import type { Permission } from '../access/permission';
import type { AssistanceRequestStatus } from './assistance-request';

/**
 * The permission each lifecycle move requires.
 *
 * `ASSISTANCE_STATUS_TRANSITIONS` says which moves are *legal*; this says who
 * may make them. Keeping the two separate matters: a social worker endorsing
 * and the head approving are both legal moves out of `assessment`/`endorsed`,
 * and it is the permission — not the lifecycle — that stops one person doing
 * both (`DL-08`).
 *
 * Having it as data rather than as `if` statements inside a component is what
 * lets the data layer enforce the same rule the UI uses to hide the button.
 */
export const TRANSITION_PERMISSIONS: Readonly<Record<AssistanceRequestStatus, Permission>> = {
  draft: 'request.create',
  submitted: 'request.create',
  'intake-review': 'request.intake',
  returned: 'request.intake',
  assessment: 'request.assess',
  endorsed: 'request.endorse',
  approved: 'request.approve',
  rejected: 'request.reject',
  scheduled: 'request.schedule',
  released: 'disbursement.release',
  completed: 'request.close',
  cancelled: 'request.intake',
  expired: 'request.close',
};

export function permissionForTransition(to: AssistanceRequestStatus): Permission {
  return TRANSITION_PERMISSIONS[to];
}
